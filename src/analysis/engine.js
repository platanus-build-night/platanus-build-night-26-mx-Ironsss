import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

// ──────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────
const LANDMARKS = {
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
};

const ANALYSIS_FPS = 24; // Higher sample rate for better accuracy
const SMOOTHING_WINDOW = 7; // Wider window for smoother signal
const REP_ANGLE_THRESHOLD = 90; // Angle below which we consider "in flexion"
const MIN_REP_DURATION_MS = 800; // Minimum rep duration to filter noise
const MIN_LANDMARK_CONFIDENCE = 0.5; // Discard frames below this visibility
const MAX_ANGLE_JUMP = 35; // Max degrees change between consecutive frames (outlier filter)

// ──────────────────────────────────────────────
// MATH UTILITIES
// ──────────────────────────────────────────────
function vectorAngle(a, b, c) {
  // Angle at vertex b, formed by points a-b-c
  const ab = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
  const cb = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) };
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2 + ab.z ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2 + cb.z ** 2);
  if (magAB === 0 || magCB === 0) return 0;
  const cosine = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return Math.acos(cosine) * (180 / Math.PI);
}

function trunkLeanAngle(shoulder, hip) {
  const dx = shoulder.x - hip.x;
  const dy = hip.y - shoulder.y; // Y is inverted in screen coords
  return Math.atan2(dx, dy) * (180 / Math.PI);
}

// Remove outlier spikes: if a value jumps more than MAX_ANGLE_JUMP from both neighbors, replace with average of neighbors
function removeOutliers(data) {
  const result = [...data];
  for (let i = 1; i < result.length - 1; i++) {
    const prev = result[i - 1];
    const curr = result[i];
    const next = result[i + 1];
    if (Math.abs(curr - prev) > MAX_ANGLE_JUMP && Math.abs(curr - next) > MAX_ANGLE_JUMP) {
      result[i] = (prev + next) / 2;
    }
  }
  return result;
}

// Median filter: replaces each value with the median of its window (removes noise spikes better than mean)
function medianFilter(data, windowSize) {
  const half = Math.floor(windowSize / 2);
  return data.map((_, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(data.length, i + half + 1);
    const slice = data.slice(start, end).sort((a, b) => a - b);
    return slice[Math.floor(slice.length / 2)];
  });
}

function movingAverage(data, window) {
  const half = Math.floor(window / 2);
  return data.map((_, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(data.length, i + half + 1);
    const slice = data.slice(start, end);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1));
}

// ──────────────────────────────────────────────
// POSE LANDMARKER SETUP
// ──────────────────────────────────────────────
let poseLandmarker = null;

export async function initPoseLandmarker(onProgress) {
  onProgress?.('Descargando módulos de visión... (5%)');
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
  );

  onProgress?.('Descargando modelo de pose full (~18MB)... (15%)');
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.6,
    minPosePresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
  });

  onProgress?.('Modelo listo, preparando análisis... (25%)');
  return poseLandmarker;
}

// ──────────────────────────────────────────────
// VIDEO PROCESSING
// ──────────────────────────────────────────────
export async function processVideo(videoFile, onProgress, onFrame) {
  if (!poseLandmarker) {
    await initPoseLandmarker(onProgress);
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(videoFile);
    video.src = url;

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      const frameInterval = 1 / ANALYSIS_FPS;
      const totalFrames = Math.floor(duration * ANALYSIS_FPS);
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      const rawData = [];
      let frameIndex = 0;

      const processNextFrame = () => {
        if (frameIndex >= totalFrames) {
          URL.revokeObjectURL(url);
          video.remove();
          const results = analyzeSession(rawData);
          resolve(results);
          return;
        }

        const targetTime = frameIndex * frameInterval;
        video.currentTime = Math.min(targetTime, duration - 0.01);
      };

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
          const timestamp = Math.round(video.currentTime * 1000);
          const result = poseLandmarker.detectForVideo(canvas, timestamp);

          if (result.landmarks && result.landmarks.length > 0) {
            const lm = result.landmarks[0];

            // Check confidence of key landmarks (shoulders, elbows, wrists, hips)
            const keyIndices = [11, 12, 13, 14, 15, 16, 23, 24];
            const keyConfidence = mean(keyIndices.map(idx => lm[idx]?.visibility || 0));

            // Skip frame if key landmarks are not confident enough
            if (keyConfidence < MIN_LANDMARK_CONFIDENCE) {
              frameIndex++;
              const pct = 30 + Math.round((frameIndex / totalFrames) * 70);
              onProgress?.(`Analizando frame ${frameIndex}/${totalFrames} (${pct}%) — frame descartado por baja confianza`);
              setTimeout(processNextFrame, 0);
              return;
            }

            const leftElbowAngle = vectorAngle(
              lm[LANDMARKS.LEFT_SHOULDER], lm[LANDMARKS.LEFT_ELBOW], lm[LANDMARKS.LEFT_WRIST]
            );
            const rightElbowAngle = vectorAngle(
              lm[LANDMARKS.RIGHT_SHOULDER], lm[LANDMARKS.RIGHT_ELBOW], lm[LANDMARKS.RIGHT_WRIST]
            );

            const leftTrunk = trunkLeanAngle(lm[LANDMARKS.LEFT_SHOULDER], lm[LANDMARKS.LEFT_HIP]);
            const rightTrunk = trunkLeanAngle(lm[LANDMARKS.RIGHT_SHOULDER], lm[LANDMARKS.RIGHT_HIP]);

            rawData.push({
              timestamp: video.currentTime,
              frameIndex,
              leftElbowAngle,
              rightElbowAngle,
              trunkLean: (leftTrunk + rightTrunk) / 2,
              landmarks: lm,
              confidence: keyConfidence,
            });

            onFrame?.({
              frameIndex,
              totalFrames,
              landmarks: lm,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
            });
          }
        } catch (e) {
          console.warn('Frame processing error:', e);
        }

        frameIndex++;
        const pct = 30 + Math.round((frameIndex / totalFrames) * 70);
        onProgress?.(`Analizando frame ${frameIndex}/${totalFrames} (${pct}%)`);

        // Use setTimeout to avoid blocking the UI
        setTimeout(processNextFrame, 0);
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Error al cargar el video'));
      };

      onProgress?.(`Iniciando análisis: ${totalFrames} frames a ${ANALYSIS_FPS} fps (30%)`);
      processNextFrame();
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Error al cargar el video'));
    };
  });
}

// ──────────────────────────────────────────────
// SESSION ANALYSIS
// ──────────────────────────────────────────────
function analyzeSession(rawData) {
  if (rawData.length < 10) {
    return { error: 'Video demasiado corto o no se detectaron poses' };
  }

  // Determine active arm: the one with larger ROM
  const leftAngles = rawData.map(d => d.leftElbowAngle);
  const rightAngles = rawData.map(d => d.rightElbowAngle);
  const leftROM = Math.max(...leftAngles) - Math.min(...leftAngles);
  const rightROM = Math.max(...rightAngles) - Math.min(...rightAngles);
  const activeSide = leftROM > rightROM ? 'left' : 'right';

  const elbowAngles = activeSide === 'left' ? leftAngles : rightAngles;
  const timestamps = rawData.map(d => d.timestamp);
  const trunkAngles = rawData.map(d => d.trunkLean);

  // Smoothing pipeline: outlier removal → median filter → moving average
  const cleanedAngles = removeOutliers(elbowAngles);
  const medianAngles = medianFilter(cleanedAngles, 3);
  const smoothedAngles = movingAverage(medianAngles, SMOOTHING_WINDOW);

  const cleanedTrunk = removeOutliers(trunkAngles);
  const smoothedTrunk = movingAverage(cleanedTrunk, SMOOTHING_WINDOW);

  // Detect reps
  const reps = detectReps(smoothedAngles, timestamps);

  if (reps.length === 0) {
    return {
      error: 'No se detectaron repeticiones. Asegúrate de grabar un curl de bíceps de perfil con buena iluminación y rango de movimiento amplio.',
    };
  }

  // Calculate per-rep metrics
  const repMetrics = reps.map((rep, i) => {
    const repAngles = smoothedAngles.slice(rep.startIdx, rep.endIdx + 1);
    const repTimestamps = timestamps.slice(rep.startIdx, rep.endIdx + 1);
    const repTrunk = smoothedTrunk.slice(rep.startIdx, rep.endIdx + 1);

    const minAngle = Math.min(...repAngles);
    const maxAngle = Math.max(...repAngles);
    const rom = maxAngle - minAngle;

    // Find the peak flexion index within this rep
    const peakFlexIdx = repAngles.indexOf(minAngle);
    const tTotal = repTimestamps[repTimestamps.length - 1] - repTimestamps[0];

    // Concentric = from start to peak flexion (angle decreasing = curling up)
    const tConcentric = peakFlexIdx > 0
      ? repTimestamps[peakFlexIdx] - repTimestamps[0]
      : tTotal / 2;

    // Eccentric = from peak flexion to end (angle increasing = lowering)
    const tEccentric = peakFlexIdx < repTimestamps.length - 1
      ? repTimestamps[repTimestamps.length - 1] - repTimestamps[peakFlexIdx]
      : tTotal / 2;

    // Angular velocities
    const velocities = [];
    for (let j = 1; j < repAngles.length; j++) {
      const dt = repTimestamps[j] - repTimestamps[j - 1];
      if (dt > 0) {
        velocities.push(Math.abs(repAngles[j] - repAngles[j - 1]) / dt);
      }
    }
    const peakVelocity = velocities.length ? Math.max(...velocities) : 0;
    const meanVelocity = velocities.length ? mean(velocities) : 0;

    // Peak hold time (time near maximum flexion)
    const holdThreshold = minAngle + 10;
    let holdTime = 0;
    for (let j = 1; j < repAngles.length; j++) {
      if (repAngles[j] < holdThreshold) {
        holdTime += repTimestamps[j] - repTimestamps[j - 1];
      }
    }

    // Trunk compensation for this rep
    const maxTrunkLean = Math.max(...repTrunk.map(Math.abs));
    const meanTrunkLean = mean(repTrunk.map(Math.abs));

    return {
      repNumber: i + 1,
      rom: Math.round(rom * 10) / 10,
      minAngle: Math.round(minAngle * 10) / 10,
      maxAngle: Math.round(maxAngle * 10) / 10,
      tut: Math.round(tTotal * 100) / 100,
      tConcentric: Math.round(tConcentric * 100) / 100,
      tEccentric: Math.round(tEccentric * 100) / 100,
      ceRatio: tEccentric > 0 ? Math.round((tConcentric / tEccentric) * 100) / 100 : 0,
      peakVelocity: Math.round(peakVelocity * 10) / 10,
      meanVelocity: Math.round(meanVelocity * 10) / 10,
      holdTime: Math.round(holdTime * 100) / 100,
      maxTrunkLean: Math.round(maxTrunkLean * 10) / 10,
      meanTrunkLean: Math.round(meanTrunkLean * 10) / 10,
      startTime: repTimestamps[0],
      endTime: repTimestamps[repTimestamps.length - 1],
    };
  });

  // Global metrics
  const allROMs = repMetrics.map(r => r.rom);
  const allTUTs = repMetrics.map(r => r.tut);
  const allVelocities = repMetrics.map(r => r.meanVelocity);

  // Fatigue index (first 3 vs last 3)
  const n = Math.min(3, Math.floor(repMetrics.length / 2));
  const firstROMs = allROMs.slice(0, n);
  const lastROMs = allROMs.slice(-n);
  const firstVels = allVelocities.slice(0, n);
  const lastVels = allVelocities.slice(-n);

  const fatigueROM = mean(firstROMs) > 0
    ? Math.round(((mean(firstROMs) - mean(lastROMs)) / mean(firstROMs)) * 1000) / 10
    : 0;
  const fatigueVel = mean(firstVels) > 0
    ? Math.round(((mean(firstVels) - mean(lastVels)) / mean(firstVels)) * 1000) / 10
    : 0;

  // Coefficient of variation
  const cvROM = mean(allROMs) > 0
    ? Math.round((stdDev(allROMs) / mean(allROMs)) * 1000) / 10
    : 0;

  // Store landmarks per frame for skeleton overlay
  const frameLandmarks = rawData.map(d => ({
    timestamp: d.timestamp,
    landmarks: d.landmarks,
  }));

  return {
    activeSide,
    totalReps: reps.length,
    duration: timestamps[timestamps.length - 1] - timestamps[0],
    repMetrics,
    frameLandmarks,
    timeSeries: {
      timestamps,
      elbowAngles: smoothedAngles,
      trunkAngles: smoothedTrunk,
      rawElbowAngles: elbowAngles,
    },
    summary: {
      meanROM: Math.round(mean(allROMs) * 10) / 10,
      stdROM: Math.round(stdDev(allROMs) * 10) / 10,
      cvROM,
      meanTUT: Math.round(mean(allTUTs) * 100) / 100,
      totalTUT: Math.round(allTUTs.reduce((a, b) => a + b, 0) * 100) / 100,
      meanVelocity: Math.round(mean(allVelocities) * 10) / 10,
      meanCERatio: Math.round(mean(repMetrics.map(r => r.ceRatio)) * 100) / 100,
      fatigueIndexROM: fatigueROM,
      fatigueIndexVelocity: fatigueVel,
      maxTrunkCompensation: repMetrics.length ? Math.round(Math.max(...repMetrics.map(r => r.maxTrunkLean)) * 10) / 10 : 0,
      meanTrunkCompensation: Math.round(mean(repMetrics.map(r => r.meanTrunkLean)) * 10) / 10,
      meanHoldTime: Math.round(mean(repMetrics.map(r => r.holdTime)) * 100) / 100,
    },
    analyzedAt: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────
// REP DETECTION
// ──────────────────────────────────────────────
function detectReps(angles, timestamps) {
  // Adaptive thresholds based on actual signal range
  const minAngle = Math.min(...angles);
  const maxAngle = Math.max(...angles);
  const range = maxAngle - minAngle;

  // If range is too small, no real movement detected
  if (range < 15) return [];

  // Thresholds: enter flexion at 65% of range, exit at 55% (more forgiving)
  const FLEX_THRESHOLD = minAngle + range * 0.65;
  const EXT_THRESHOLD = minAngle + range * 0.55;
  const RISE_THRESHOLD = range * 0.20;

  const reps = [];
  let state = 'IDLE';
  let repStartIdx = 0;
  let minAngleInRep = 180;

  for (let i = 1; i < angles.length; i++) {
    const angle = angles[i];

    switch (state) {
      case 'IDLE':
        if (angle < FLEX_THRESHOLD) {
          state = 'FLEXING';
          repStartIdx = Math.max(0, i - 3);
          minAngleInRep = angle;
        }
        break;

      case 'FLEXING':
        if (angle < minAngleInRep) {
          minAngleInRep = angle;
        }
        if (angle > minAngleInRep + RISE_THRESHOLD) {
          state = 'EXTENDING';
        }
        break;

      case 'EXTENDING':
        if (angle > EXT_THRESHOLD) {
          const repDuration = (timestamps[i] - timestamps[repStartIdx]) * 1000;
          if (repDuration > MIN_REP_DURATION_MS) {
            reps.push({
              startIdx: repStartIdx,
              endIdx: i,
              minAngle: minAngleInRep,
            });
          }
          state = 'IDLE';
          minAngleInRep = 180;
        }
        break;
    }
  }

  // Capture last rep if video ends mid-extension
  if (state === 'EXTENDING' || state === 'FLEXING') {
    const i = angles.length - 1;
    const repDuration = (timestamps[i] - timestamps[repStartIdx]) * 1000;
    if (repDuration > MIN_REP_DURATION_MS && minAngleInRep < FLEX_THRESHOLD) {
      reps.push({
        startIdx: repStartIdx,
        endIdx: i,
        minAngle: minAngleInRep,
      });
    }
  }

  return reps;
}

// ──────────────────────────────────────────────
// CLINICAL ASSESSMENT HELPERS
// ──────────────────────────────────────────────
export function assessMetric(metric, value) {
  const assessments = {
    rom: [
      { max: 80, label: 'Limitado', color: '#E94560', icon: '⚠️',
        tip: 'Tu rango de movimiento es bajo. Intenta extender el brazo completamente antes de cada rep y flexionar hasta que la mano se acerque al hombro. Si hay dolor, reduce el peso y consulta a tu fisioterapeuta.' },
      { max: 110, label: 'Moderado', color: '#F5A623', icon: '⚡',
        tip: 'Buen progreso pero aún puedes mejorar. Enfócate en estirar completamente el brazo abajo y subir la mancuerna hasta el hombro. Un calentamiento previo con movilidad articular puede ayudar.' },
      { max: 140, label: 'Normal', color: '#16C79A', icon: '✓',
        tip: 'Rango de movimiento saludable. Mantén esta amplitud en cada repetición. Si buscas más desafío, incrementa el peso gradualmente manteniendo el mismo rango.' },
      { max: 999, label: 'Excelente', color: '#16C79A', icon: '★',
        tip: 'Rango de movimiento completo y óptimo. Estás aprovechando toda la amplitud articular del codo. Sigue así.' },
    ],
    fatigueROM: [
      { max: 10, label: 'Mínima', color: '#16C79A', icon: '✓',
        tip: 'Excelente resistencia muscular. El rango se mantiene estable durante todo el set. El peso es adecuado para tu nivel actual.' },
      { max: 25, label: 'Moderada', color: '#F5A623', icon: '⚡',
        tip: 'Fatiga normal para un set exigente. Si quieres mejorar, prueba reducir 1-2 reps o bajar un poco el peso. También ayuda descansar 90-120 segundos entre sets.' },
      { max: 999, label: 'Excesiva', color: '#E94560', icon: '⚠️',
        tip: 'Tu forma se deteriora mucho al final del set. Reduce el peso un 15-20% o haz menos repeticiones. Es mejor hacer 8 reps con buena forma que 12 con técnica pobre.' },
    ],
    cvROM: [
      { max: 5, label: 'Alta consistencia', color: '#16C79A', icon: '★',
        tip: 'Movimiento muy consistente, señal de excelente control motor. Cada repetición es prácticamente idéntica. Dominas bien este ejercicio.' },
      { max: 15, label: 'Normal', color: '#F5A623', icon: '✓',
        tip: 'Variabilidad aceptable. Para mejorar la consistencia, usa un espejo o grábate de perfil. Concéntrate en hacer cada rep con la misma velocidad y amplitud.' },
      { max: 999, label: 'Inconsistente', color: '#E94560', icon: '⚠️',
        tip: 'Cada repetición es muy diferente. Esto suele indicar fatiga, peso excesivo, o un patrón de movimiento no consolidado. Reduce el peso y haz reps lentas y controladas enfocándote en la técnica.' },
    ],
    trunkLean: [
      { max: 5, label: 'Ideal', color: '#16C79A', icon: '✓',
        tip: 'Postura excelente. Tu tronco se mantiene recto, lo que significa que el bíceps está haciendo todo el trabajo sin compensaciones.' },
      { max: 10, label: 'Leve', color: '#F5A623', icon: '⚡',
        tip: 'Hay una ligera inclinación del tronco. Intenta pegar la espalda contra una pared o usar un banco con respaldo para eliminar la compensación. Activa el core antes de cada rep.' },
      { max: 999, label: 'Significativa', color: '#E94560', icon: '⚠️',
        tip: 'Estás usando el tronco para impulsar el peso, lo que reduce el trabajo del bíceps y puede lesionar la zona lumbar. Baja el peso significativamente y haz el ejercicio sentado con respaldo, o de pie con la espalda contra la pared.' },
    ],
    ceRatio: [
      { max: 0.4, label: 'Exc. muy lento', color: '#F5A623', icon: '⚡',
        tip: 'La fase excéntrica (bajar) es muy lenta respecto a la concéntrica (subir). Está bien para protocolos de rehabilitación de tendones, pero si buscas hipertrofia general, intenta un tempo 1:2 (1s subir, 2s bajar).' },
      { max: 0.7, label: 'Ideal', color: '#16C79A', icon: '★',
        tip: 'Tempo perfecto. Subes controlado y bajas más lento, maximizando el estímulo muscular. Este ratio es ideal tanto para rehabilitación como para fortalecimiento.' },
      { max: 1.2, label: 'Aceptable', color: '#16C79A', icon: '✓',
        tip: 'Buen control general. Para optimizar, intenta bajar el peso un poco más lento (cuenta "uno-dos" mientras bajas). La fase excéntrica es donde más se fortalece el músculo.' },
      { max: 999, label: 'Sin control exc.', color: '#E94560', icon: '⚠️',
        tip: 'Estás dejando caer el peso en lugar de bajarlo con control. Esto reduce la efectividad del ejercicio y aumenta el riesgo de lesión. Baja el peso un 20% y enfócate en bajar lento: cuenta 2-3 segundos mientras extiendes el brazo.' },
    ],
  };

  const rules = assessments[metric];
  if (!rules) return { label: '—', color: '#999', icon: '', tip: '' };
  for (const rule of rules) {
    if (value <= rule.max) return rule;
  }
  return rules[rules.length - 1];
}

// ──────────────────────────────────────────────
// STORAGE (localStorage for MVP)
// ──────────────────────────────────────────────
const STORAGE_KEY = 'rehab_motion_history';

export function saveSession(sessionData) {
  try {
    const history = getHistory();
    history.push({
      ...sessionData,
      id: Date.now().toString(36),
      savedAt: new Date().toISOString(),
    });
    // Keep last 20 sessions
    if (history.length > 20) history.shift();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('Could not save session:', e);
  }
}

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}
