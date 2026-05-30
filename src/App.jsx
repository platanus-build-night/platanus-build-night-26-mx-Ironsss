import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { processVideo, assessMetric, saveSession, getHistory } from './analysis/engine';
import { DEMO_HISTORY, getProgressionData } from './data/demoHistory';

// ════════════════════════════════════════════════
// LATEX COMPONENT
// ════════════════════════════════════════════════
function Latex({ expr, display = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.katex) {
      try {
        window.katex.render(expr, ref.current, {
          throwOnError: false,
          displayMode: display,
        });
      } catch { /* fallback to raw text */ }
    }
  }, [expr, display]);
  return <span ref={ref} className="latex-formula" />;
}

// ════════════════════════════════════════════════
// APP
// ════════════════════════════════════════════════
export default function App() {
  const [view, setView] = useState('upload'); // upload | processing | dashboard | history
  const [progress, setProgress] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [results, setResults] = useState(null);
  const [videoURL, setVideoURL] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = useCallback(async (file) => {
    if (!file || !file.type.startsWith('video/')) {
      alert('Por favor selecciona un archivo de video');
      return;
    }

    setVideoURL(URL.createObjectURL(file));
    setView('processing');
    setProgressPct(0);

    try {
      const data = await processVideo(
        file,
        (msg) => {
          setProgress(msg);
          const match = msg.match(/(\d+)%/);
          if (match) setProgressPct(parseInt(match[1]));
        },
        null
      );

      if (data.error) {
        alert(data.error);
        setView('upload');
        return;
      }

      setResults(data);
      saveSession(data);
      setView('dashboard');
    } catch (err) {
      console.error(err);
      alert('Error procesando video: ' + err.message);
      setView('upload');
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  return (
    <div className="min-h-screen bg-bone">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-ink text-white px-6 py-0 flex items-center justify-between">
        <button onClick={() => setView('upload')}>
          <img src={import.meta.env.BASE_URL + 'LogoEasyFisio.png'} alt="EasyFisio" className="h-14 object-contain" />
        </button>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <span className={demoMode ? 'text-glow' : 'text-white/50'}>Demo</span>
            <div
              className={`w-10 h-5 rounded-full relative transition-colors ${demoMode ? 'bg-glow' : 'bg-white/20'}`}
              onClick={() => setDemoMode(!demoMode)}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${demoMode ? 'left-5.5' : 'left-0.5'}`}
                style={{ left: demoMode ? '22px' : '2px' }} />
            </div>
          </label>
          <button
            onClick={() => setView('history')}
            className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors"
          >
            Historial
          </button>
        </div>
      </header>

      {/* Views */}
      {view === 'upload' && (
        <UploadView
          onFileSelect={handleFileSelect}
          onDrop={handleDrop}
          fileInputRef={fileInputRef}
        />
      )}
      {view === 'processing' && (
        <ProcessingView progress={progress} progressPct={progressPct} />
      )}
      {view === 'dashboard' && results && (
        <DashboardView
          results={results}
          videoURL={videoURL}
          onNewAnalysis={() => setView('upload')}
        />
      )}
      {view === 'history' && (
        <HistoryView
          demoMode={demoMode}
          onBack={() => setView(results ? 'dashboard' : 'upload')}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
// UPLOAD VIEW
// ════════════════════════════════════════════════
function UploadView({ onFileSelect, onDrop, fileInputRef }) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="max-w-2xl mx-auto px-6 pt-16 pb-24">
      <div className="text-center mb-12">
        <h1 className="font-display text-5xl sm:text-6xl text-ink mb-4 font-extrabold leading-tight">
          Análisis de<br /><span className="text-accent">Movimiento</span>
        </h1>
        <p className="text-ink/60 text-lg max-w-md mx-auto leading-relaxed">
          Sube un video de flexión de bíceps y obtén métricas biomecánicas clínicas al instante.
          Todo se procesa en tu dispositivo.
        </p>
      </div>

      <div
        className={`upload-zone rounded-3xl p-14 text-center cursor-pointer ${dragOver ? 'drag-over' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDrop={(e) => { setDragOver(false); onDrop(e); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
      >
        <div className="text-7xl mb-5">🎬</div>
        <p className="font-display font-bold text-xl text-ink/80 mb-2">Arrastra tu video aquí</p>
        <p className="text-base text-ink/50">o toca para seleccionar</p>
        <p className="text-sm text-ink/40 mt-5">MP4, MOV, WebM • Máx 200MB</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
        />
      </div>

      {/* Tips */}
      <div className="mt-10 bg-white rounded-3xl p-7 shadow-sm">
        <h3 className="font-display text-xl font-bold mb-4">Tips para mejor resultado</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: '📐', text: 'Graba de perfil (vista lateral)' },
            { icon: '💡', text: 'Buena iluminación, evita contraluz' },
            { icon: '💪', text: 'Brazo activo completamente visible' },
            { icon: '📱', text: 'Usa trípode o apoya el celular' },
          ].map(tip => (
            <div key={tip.text} className="flex items-start gap-3 bg-bone rounded-xl p-4">
              <span className="text-2xl flex-shrink-0">{tip.icon}</span>
              <p className="text-sm text-ink/70 leading-relaxed">{tip.text}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap mt-5">
          {['ROM', 'Velocidad', 'Fatiga', 'Compensación', 'Tempo', 'Consistencia', 'Hold Isométrico', 'Ratio C:E'].map(tag => (
            <span key={tag} className="text-xs font-medium bg-mint/10 text-mint px-3 py-1.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// PROCESSING VIEW
// ════════════════════════════════════════════════
function ProcessingView({ progress, progressPct }) {
  const stages = [
    { label: 'Descargando motor de visión', threshold: 5 },
    { label: 'Descargando modelo de pose', threshold: 15 },
    { label: 'Inicializando modelo', threshold: 25 },
    { label: 'Analizando frames', threshold: 30 },
  ];

  const currentStage = [...stages].reverse().find(s => progressPct >= s.threshold) || stages[0];

  return (
    <div className="max-w-md mx-auto px-4 pt-16 text-center">
      <div className="text-6xl mb-6 animate-pulse">🦴</div>
      <h2 className="font-display text-2xl mb-2">Analizando poses</h2>
      <p className="text-sm text-ink/60 mb-6 font-medium">{currentStage.label}</p>

      <div className="w-full bg-ink/10 rounded-full h-4 mb-2 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent to-glow rounded-full transition-all duration-500 ease-out progress-glow"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <p className="font-mono text-2xl font-bold text-ink mb-1">{progressPct}%</p>
      <p className="text-xs text-ink/40 mb-8">{progress}</p>

      {/* Stage indicators */}
      <div className="flex justify-between px-2 mb-10">
        {stages.map((stage, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className={`w-3 h-3 rounded-full transition-colors duration-300 ${
              progressPct >= stage.threshold ? 'bg-glow' : 'bg-ink/15'
            }`} />
            <span className={`text-[10px] max-w-[70px] leading-tight ${
              progressPct >= stage.threshold ? 'text-ink/70' : 'text-ink/30'
            }`}>
              {stage.label}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink/40 max-w-xs mx-auto">
        MediaPipe Pose Landmarker corriendo localmente en tu dispositivo.
        Ningún dato sale de tu navegador.
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════
// ANNOTATED VIDEO PANEL
// ════════════════════════════════════════════════
const POSE_CONNECTIONS = [
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [11, 12],           // shoulders
  [11, 23], [12, 24], // torso
  [23, 24],           // hips
  [23, 25], [25, 27], // left leg
  [24, 26], [26, 28], // right leg
];

function findClosestFrame(frameLandmarks, currentTime) {
  let closest = frameLandmarks[0];
  let minDist = Math.abs(currentTime - closest.timestamp);
  for (let i = 1; i < frameLandmarks.length; i++) {
    const dist = Math.abs(currentTime - frameLandmarks[i].timestamp);
    if (dist < minDist) {
      minDist = dist;
      closest = frameLandmarks[i];
    }
  }
  return closest;
}

// Calculate the actual video render area inside a container with objectFit: contain
function getVideoFitRect(video, containerW, containerH) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return { x: 0, y: 0, w: containerW, h: containerH };

  const containerRatio = containerW / containerH;
  const videoRatio = vw / vh;

  let drawW, drawH, offsetX, offsetY;
  if (videoRatio > containerRatio) {
    // Video wider than container → pillarbox (black bars top/bottom)
    drawW = containerW;
    drawH = containerW / videoRatio;
    offsetX = 0;
    offsetY = (containerH - drawH) / 2;
  } else {
    // Video taller than container → letterbox (black bars left/right)
    drawH = containerH;
    drawW = containerH * videoRatio;
    offsetX = (containerW - drawW) / 2;
    offsetY = 0;
  }
  return { x: offsetX, y: offsetY, w: drawW, h: drawH };
}

function drawSkeletonOnCanvas(ctx, lm, canvasW, canvasH, activeSide, videoFit) {
  ctx.clearRect(0, 0, canvasW, canvasH);
  if (!lm || !videoFit) return;

  const { x: ox, y: oy, w, h } = videoFit;

  // Map landmark normalized coords to canvas pixel coords
  const toX = (nx) => ox + nx * w;
  const toY = (ny) => oy + ny * h;

  // Draw connections
  for (const [a, b] of POSE_CONNECTIONS) {
    const pa = lm[a];
    const pb = lm[b];
    if (!pa || !pb) continue;
    const isActiveArm = activeSide === 'left'
      ? [11, 13, 15].includes(a) && [11, 13, 15].includes(b)
      : [12, 14, 16].includes(a) && [12, 14, 16].includes(b);
    ctx.strokeStyle = isActiveArm ? '#E94560' : 'rgba(22, 199, 154, 0.7)';
    ctx.lineWidth = isActiveArm ? 3.5 : 2;
    ctx.beginPath();
    ctx.moveTo(toX(pa.x), toY(pa.y));
    ctx.lineTo(toX(pb.x), toY(pb.y));
    ctx.stroke();
  }

  // Draw joints
  for (let i = 0; i < lm.length; i++) {
    if (i > 28) break;
    const p = lm[i];
    const isActive = activeSide === 'left'
      ? [11, 13, 15].includes(i)
      : [12, 14, 16].includes(i);
    ctx.fillStyle = isActive ? '#E94560' : 'rgba(22, 199, 154, 0.8)';
    const r = isActive ? 5 : 3;
    ctx.beginPath();
    ctx.arc(toX(p.x), toY(p.y), r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw elbow angle
  const elbowIdx = activeSide === 'left' ? 13 : 14;
  const shoulderIdx = activeSide === 'left' ? 11 : 12;
  const wristIdx = activeSide === 'left' ? 15 : 16;
  if (lm[elbowIdx] && lm[shoulderIdx] && lm[wristIdx]) {
    const elbow = lm[elbowIdx];
    const sh = lm[shoulderIdx];
    const wr = lm[wristIdx];
    const ab = { x: sh.x - elbow.x, y: sh.y - elbow.y };
    const cb = { x: wr.x - elbow.x, y: wr.y - elbow.y };
    const dot = ab.x * cb.x + ab.y * cb.y;
    const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2);
    const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2);
    const cosine = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
    const angleDeg = Math.round(Math.acos(cosine) * (180 / Math.PI));

    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.fillStyle = '#E94560';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    const text = `${angleDeg}°`;
    const tx = toX(elbow.x) + 12;
    const ty = toY(elbow.y) - 8;
    ctx.strokeText(text, tx, ty);
    ctx.fillText(text, tx, ty);
  }
}

function AnnotatedVideoPanel({ videoURL, frameLandmarks, activeSide, totalReps, duration, repMetrics }) {
  const originalVideoRef = useRef(null);
  const skeletonVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const syncingRef = useRef(false);

  const syncVideos = useCallback((sourceRef, targetRef) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (targetRef.current && sourceRef.current) {
      if (Math.abs(targetRef.current.currentTime - sourceRef.current.currentTime) > 0.1) {
        targetRef.current.currentTime = sourceRef.current.currentTime;
      }
    }
    syncingRef.current = false;
  }, []);

  const handlePlay = useCallback((sourceRef, targetRef) => {
    syncVideos(sourceRef, targetRef);
    targetRef.current?.play();
  }, [syncVideos]);

  const handlePause = useCallback((sourceRef, targetRef) => {
    targetRef.current?.pause();
    syncVideos(sourceRef, targetRef);
  }, [syncVideos]);

  const handleSeek = useCallback((sourceRef, targetRef) => {
    syncVideos(sourceRef, targetRef);
  }, [syncVideos]);

  // Skeleton drawing loop
  useEffect(() => {
    const video = skeletonVideoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !frameLandmarks?.length) return;

    const ctx = canvas.getContext('2d');

    const draw = () => {
      const rect = video.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      const videoFit = getVideoFitRect(video, canvas.width, canvas.height);
      const closest = findClosestFrame(frameLandmarks, video.currentTime);
      drawSkeletonOnCanvas(ctx, closest.landmarks, canvas.width, canvas.height, activeSide, videoFit);
      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [frameLandmarks, activeSide]);

  return (
    <div className="space-y-3">
      {/* Original video */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide px-3 pt-2">Original</p>
        <video
          ref={originalVideoRef}
          src={videoURL}
          controls
          loop
          muted
          className="w-full bg-black"
          style={{ maxHeight: '240px', objectFit: 'contain' }}
          onPlay={() => handlePlay(originalVideoRef, skeletonVideoRef)}
          onPause={() => handlePause(originalVideoRef, skeletonVideoRef)}
          onSeeked={() => handleSeek(originalVideoRef, skeletonVideoRef)}
        />
      </div>

      {/* Skeleton overlay video */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide px-3 pt-2">Coordenadas MediaPipe</p>
        <div className="relative">
          <video
            ref={skeletonVideoRef}
            src={videoURL}
            loop
            muted
            className="w-full bg-black"
            style={{ maxHeight: '240px', objectFit: 'contain' }}
            onPlay={() => handlePlay(skeletonVideoRef, originalVideoRef)}
            onPause={() => handlePause(skeletonVideoRef, originalVideoRef)}
            onSeeked={() => handleSeek(skeletonVideoRef, originalVideoRef)}
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <p className="text-xs text-ink/50">
          Brazo {activeSide === 'left' ? 'izquierdo' : 'derecho'} • {totalReps} reps • {Math.round(duration)}s
        </p>
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-accent" />
            <span className="text-xs text-ink/40">Brazo activo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-glow" />
            <span className="text-xs text-ink/40">Cuerpo</span>
          </div>
        </div>
        <p className="text-[9px] text-ink/30 mt-1.5">Los videos están sincronizados — controla cualquiera de los dos.</p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// FEEDBACK VIEW (full-width, dedicated tab)
// ════════════════════════════════════════════════
function FeedbackView({ videoURL, frameLandmarks, activeSide, repMetrics, totalReps, duration }) {
  const originalRef = useRef(null);
  const feedbackRef = useRef(null);
  const feedbackCanvasRef = useRef(null);
  const animRef = useRef(null);
  const syncingRef = useRef(false);

  // Sync both videos
  const sync = useCallback((src, tgt) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (tgt.current && src.current && Math.abs(tgt.current.currentTime - src.current.currentTime) > 0.1) {
      tgt.current.currentTime = src.current.currentTime;
    }
    syncingRef.current = false;
  }, []);

  // Feedback canvas drawing
  useEffect(() => {
    const video = feedbackRef.current;
    const canvas = feedbackCanvasRef.current;
    if (!video || !canvas || !repMetrics?.length || !frameLandmarks?.length) return;

    const ctx = canvas.getContext('2d');

    const draw = () => {
      const rect = video.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      const videoFit = getVideoFitRect(video, canvas.width, canvas.height);
      const t = video.currentTime;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw skeleton
      const closest = findClosestFrame(frameLandmarks, t);
      drawSkeletonOnCanvas(ctx, closest.landmarks, canvas.width, canvas.height, activeSide, videoFit);

      // Find current rep
      const currentRep = repMetrics.find(r => t >= r.startTime && t <= r.endTime);

      if (currentRep) {
        const { findings, score } = repInterpretation(currentRep, repMetrics);
        const sColor = score >= 3 ? '#16C79A' : score >= 2 ? '#F5A623' : '#E94560';
        const sLabel = score >= 3 ? 'Excelente' : score >= 2 ? 'Aceptable' : 'Mejorable';

        const bx = videoFit.x + 16;
        const by = videoFit.y + 16;
        const panelW = Math.min(videoFit.w - 32, 420);

        // Header badge
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.beginPath();
        ctx.roundRect(bx, by, panelW, 48, 12);
        ctx.fill();

        ctx.font = 'bold 22px "Plus Jakarta Sans", "Inter", sans-serif';
        ctx.fillStyle = 'white';
        ctx.fillText(`Rep ${currentRep.repNumber}`, bx + 16, by + 33);

        ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = sColor;
        const labelX = bx + 120;
        ctx.fillText(sLabel, labelX, by + 33);

        // Metrics row
        ctx.font = '16px "Inter", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        const metricsText = `ROM ${currentRep.rom}°  •  TUT ${currentRep.tut}s  •  Tronco ${currentRep.maxTrunkLean}°`;
        ctx.fillText(metricsText, labelX + ctx.measureText(sLabel).width + 16, by + 33);

        // Findings
        findings.slice(0, 3).forEach((f, i) => {
          const fy = by + 60 + i * 38;
          const bgColor = f.type === 'good' ? 'rgba(22,199,154,0.9)' : f.type === 'warn' ? 'rgba(233,69,96,0.9)' : 'rgba(245,166,35,0.9)';
          const icon = f.type === 'good' ? '✓' : f.type === 'warn' ? '✗' : '!';
          const text = f.text.length > 60 ? f.text.substring(0, 60) + '...' : f.text;

          ctx.fillStyle = bgColor;
          ctx.beginPath();
          ctx.roundRect(bx, fy, panelW, 32, 8);
          ctx.fill();

          ctx.font = 'bold 15px "Inter", sans-serif';
          ctx.fillStyle = 'white';
          ctx.fillText(`${icon}  ${text}`, bx + 12, fy + 22);
        });
      } else {
        // Between reps — show "Entre repeticiones"
        const bx = videoFit.x + 16;
        const by = videoFit.y + 16;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.roundRect(bx, by, 240, 40, 10);
        ctx.fill();
        ctx.font = '16px "Inter", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('Entre repeticiones...', bx + 14, by + 27);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [frameLandmarks, activeSide, repMetrics]);

  return (
    <div>
      {/* Two videos side by side, full width */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Original */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-ink/5">
            <p className="text-sm font-semibold text-ink/60 uppercase tracking-wide">Video Original</p>
          </div>
          <video
            ref={originalRef}
            src={videoURL}
            controls
            loop
            muted
            className="w-full bg-black"
            style={{ minHeight: '400px', maxHeight: '70vh', objectFit: 'contain' }}
            onPlay={() => { sync(originalRef, feedbackRef); feedbackRef.current?.play(); }}
            onPause={() => { feedbackRef.current?.pause(); sync(originalRef, feedbackRef); }}
            onSeeked={() => sync(originalRef, feedbackRef)}
          />
        </div>

        {/* Feedback */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden border-2 border-accent/20">
          <div className="px-5 py-3 border-b border-accent/10 bg-accent/5">
            <p className="text-sm font-semibold text-accent uppercase tracking-wide">Feedback en Tiempo Real</p>
            <p className="text-xs text-ink/40 mt-0.5">Skeleton + evaluación por repetición</p>
          </div>
          <div className="relative">
            <video
              ref={feedbackRef}
              src={videoURL}
              loop
              muted
              className="w-full bg-black"
              style={{ minHeight: '400px', maxHeight: '70vh', objectFit: 'contain' }}
              onPlay={() => { sync(feedbackRef, originalRef); originalRef.current?.play(); }}
              onPause={() => { originalRef.current?.pause(); sync(feedbackRef, originalRef); }}
              onSeeked={() => sync(feedbackRef, originalRef)}
            />
            <canvas
              ref={feedbackCanvasRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* Legend + rep timeline */}
      <div className="mt-6 bg-white rounded-3xl p-6 shadow-sm">
        <div className="flex flex-wrap gap-6 items-center">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-glow" />
            <span className="text-sm text-ink/60">Excelente (3/3)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: '#F5A623' }} />
            <span className="text-sm text-ink/60">Aceptable (2/3)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-accent" />
            <span className="text-sm text-ink/60">Mejorable (0-1/3)</span>
          </div>
        </div>

        {/* Rep timeline bar */}
        <div className="mt-5">
          <p className="text-xs text-ink/40 uppercase tracking-wide font-medium mb-3">Timeline de repeticiones</p>
          <div className="flex gap-2">
            {repMetrics.map(rep => {
              const { score } = repInterpretation(rep, repMetrics);
              const color = score >= 3 ? '#16C79A' : score >= 2 ? '#F5A623' : '#E94560';
              return (
                <div key={rep.repNumber} className="flex-1 text-center">
                  <div
                    className="h-10 rounded-xl flex items-center justify-center font-mono font-bold text-white text-sm"
                    style={{ backgroundColor: color }}
                  >
                    R{rep.repNumber}
                  </div>
                  <p className="text-xs text-ink/40 mt-1">{rep.rom}°</p>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-ink/30 mt-4">
          Dale play a cualquiera de los dos videos — están sincronizados. El panel derecho muestra el skeleton de MediaPipe con evaluación en vivo de cada repetición.
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// DASHBOARD VIEW
// ════════════════════════════════════════════════
function computeGlobalScore(summary) {
  const scores = [
    Math.min(100, (summary.meanROM / 140) * 100),
    Math.max(0, 100 - summary.cvROM * 3),
    Math.min(100, Math.max(0, (1 - Math.abs(summary.meanCERatio - 0.55) * 1.5) * 100)),
    Math.max(0, 100 - summary.fatigueIndexROM * 2),
    Math.max(0, 100 - summary.meanTrunkCompensation * 5),
    Math.min(100, summary.meanHoldTime * 100),
  ];
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function DashboardView({ results, videoURL, onNewAnalysis }) {
  const { summary, repMetrics, timeSeries, totalReps, activeSide, duration, frameLandmarks } = results;
  const [activeTab, setActiveTab] = useState('overview');

  const globalScore = computeGlobalScore(summary);
  const scoreColor = globalScore >= 75 ? '#16C79A' : globalScore >= 50 ? '#F5A623' : '#E94560';
  const scoreLabel = globalScore >= 75 ? 'Excelente' : globalScore >= 50 ? 'Bueno' : 'Mejorable';

  const tabs = [
    { id: 'overview', label: 'Resumen' },
    { id: 'feedback', label: 'Feedback' },
    { id: 'reps', label: 'Por Rep' },
    { id: 'timeseries', label: 'Gráficas' },
    { id: 'methodology', label: 'Metodología' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 pb-24">
      {/* Summary header — full width */}
      <div className="bg-ink text-white rounded-3xl p-7 mb-8">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h2 className="font-display text-3xl font-bold">Flexión de Bíceps</h2>
            <p className="text-white/50 text-base mt-1">
              {totalReps} repeticiones • Brazo {activeSide === 'left' ? 'izquierdo' : 'derecho'} • {Math.round(duration)}s
            </p>
          </div>
          <button
            onClick={onNewAnalysis}
            className="text-sm font-medium bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition-colors"
          >
            + Nuevo análisis
          </button>
        </div>

        {/* Global score + quick stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-2xl p-5 flex flex-col items-center justify-center">
            <div
              className="text-5xl font-display font-extrabold mb-1"
              style={{ color: scoreColor }}
            >
              {globalScore}
            </div>
            <p className="text-sm font-medium" style={{ color: scoreColor }}>{scoreLabel}</p>
            <p className="text-white/40 text-xs mt-1">Score global</p>
          </div>
          <QuickStat label="ROM medio" value={`${summary.meanROM}°`} assessment={assessMetric('rom', summary.meanROM)} />
          <QuickStat label="Fatiga" value={`${summary.fatigueIndexROM}%`} assessment={assessMetric('fatigueROM', summary.fatigueIndexROM)} />
          <QuickStat label="Consistencia" value={`CV ${summary.cvROM}%`} assessment={assessMetric('cvROM', summary.cvROM)} />
        </div>
      </div>

      {/* Tab navigation — full width */}
      <div className="flex gap-1 bg-ink/5 rounded-2xl p-1.5 mb-8">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-base rounded-xl transition-all ${
              activeTab === tab.id
                ? 'bg-white text-ink font-semibold shadow-sm'
                : 'text-ink/50 hover:text-ink/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feedback tab: full-width, no sidebar */}
      {activeTab === 'feedback' && videoURL && (
        <FeedbackView
          videoURL={videoURL}
          frameLandmarks={frameLandmarks}
          activeSide={activeSide}
          repMetrics={repMetrics}
          totalReps={totalReps}
          duration={duration}
        />
      )}

      {/* Other tabs: two-column layout with sidebar */}
      {activeTab !== 'feedback' && (
        <div className="flex gap-8 items-start">
          <div className="flex-1 min-w-0">
            {activeTab === 'overview' && <OverviewTab summary={summary} repMetrics={repMetrics} />}
            {activeTab === 'reps' && <RepsTab repMetrics={repMetrics} />}
            {activeTab === 'timeseries' && <TimeseriesTab timeSeries={timeSeries} repMetrics={repMetrics} />}
            {activeTab === 'methodology' && <MethodologyTab repMetrics={repMetrics} summary={summary} />}
          </div>

          {/* Right: sticky video panel (desktop only) */}
          {videoURL && (
            <div className="hidden lg:block w-80 flex-shrink-0 sticky top-20">
              <AnnotatedVideoPanel
                videoURL={videoURL}
                frameLandmarks={frameLandmarks}
                activeSide={activeSide}
                totalReps={totalReps}
                duration={duration}
                repMetrics={repMetrics}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuickStat({ label, value, assessment }) {
  return (
    <div className="bg-white/10 rounded-2xl p-5">
      <p className="text-white/50 text-sm mb-1">{label}</p>
      <p className="font-mono text-2xl font-bold">{value}</p>
      <p className="text-sm mt-1 font-medium" style={{ color: assessment.color }}>
        {assessment.icon} {assessment.label}
      </p>
    </div>
  );
}

// ────────────────────────────────────────────
// OVERVIEW TAB
// ────────────────────────────────────────────
function OverviewTab({ summary, repMetrics }) {
  const radarData = [
    { metric: 'ROM', value: Math.min(100, (summary.meanROM / 140) * 100), fullMark: 100 },
    { metric: 'Consistencia', value: Math.max(0, 100 - summary.cvROM * 3), fullMark: 100 },
    { metric: 'Control Exc.', value: Math.min(100, Math.max(0, (1 - Math.abs(summary.meanCERatio - 0.55) * 1.5) * 100)), fullMark: 100 },
    { metric: 'Resistencia', value: Math.max(0, 100 - summary.fatigueIndexROM * 2), fullMark: 100 },
    { metric: 'Postura', value: Math.max(0, 100 - summary.meanTrunkCompensation * 5), fullMark: 100 },
    { metric: 'Hold', value: Math.min(100, summary.meanHoldTime * 100), fullMark: 100 },
  ];

  return (
    <div className="space-y-4">
      {/* Radar chart */}
      <div className="bg-white rounded-3xl p-6 shadow-sm">
        <h3 className="font-display text-xl font-bold mb-1">Perfil de Movimiento</h3>
        <p className="text-sm text-ink/40 mb-4">Evaluación normalizada 0–100</p>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#1A1A2E15" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#1A1A2E99' }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="value" stroke="#E94560" fill="#E94560" fillOpacity={0.15} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Metric cards grid */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          title="ROM Medio"
          value={`${summary.meanROM}°`}
          subtitle={`σ = ${summary.stdROM}°`}
          assessment={assessMetric('rom', summary.meanROM)}
          detail="Rango de movimiento promedio del codo en todas las repeticiones"
          optimal={{ value: '90–140°', current: summary.meanROM, unit: '°', target: 115, max: 180 }}
        />
        <MetricCard
          title="Ratio C:E"
          value={summary.meanCERatio}
          subtitle="concéntrico/excéntrico"
          assessment={assessMetric('ceRatio', summary.meanCERatio)}
          detail="Ideal ≈ 0.5 (1:2). Excéntrica debe durar el doble que concéntrica"
          optimal={{ value: '0.3–0.8', current: summary.meanCERatio, unit: '', target: 0.55, max: 2 }}
        />
        <MetricCard
          title="Índice Fatiga"
          value={`${summary.fatigueIndexROM}%`}
          subtitle="ROM: primeras vs últimas"
          assessment={assessMetric('fatigueROM', summary.fatigueIndexROM)}
          detail="Degradación del ROM entre primeras y últimas repeticiones"
          optimal={{ value: '< 15%', current: summary.fatigueIndexROM, unit: '%', target: 8, max: 50, lower: true }}
        />
        <MetricCard
          title="Compensación"
          value={`${summary.maxTrunkCompensation}°`}
          subtitle={`media: ${summary.meanTrunkCompensation}°`}
          assessment={assessMetric('trunkLean', summary.maxTrunkCompensation)}
          detail="Inclinación del tronco. > 10° indica peso excesivo"
          optimal={{ value: '< 8°', current: summary.maxTrunkCompensation, unit: '°', target: 5, max: 30, lower: true }}
        />
        <MetricCard
          title="TUT Total"
          value={`${summary.totalTUT}s`}
          subtitle={`${summary.meanTUT}s por rep`}
          assessment={{
            label: summary.meanTUT > 3 ? 'Adecuado' : 'Bajo',
            color: summary.meanTUT > 3 ? '#16C79A' : '#F5A623',
            icon: summary.meanTUT > 3 ? '✓' : '⚡',
            tip: summary.meanTUT > 3
              ? 'Buen tiempo bajo tensión. Cada repetición tiene suficiente duración para estimular el músculo. Mantén este ritmo.'
              : 'Tus repeticiones son muy rápidas. Intenta un tempo controlado: 1-2 segundos subiendo y 2-3 segundos bajando. Más tiempo bajo tensión = más estímulo muscular y mejores resultados.',
          }}
          detail="Tiempo bajo tensión total y por repetición. Para hipertrofia: 3-5s por rep. Para rehabilitación: 4-8s por rep."
          optimal={{ value: '3–5s/rep', current: summary.meanTUT, unit: 's', target: 4, max: 10 }}
        />
        <MetricCard
          title="Hold Pico"
          value={`${summary.meanHoldTime}s`}
          subtitle="en contracción máxima"
          assessment={{
            label: summary.meanHoldTime > 0.3 ? 'Con pausa' : 'Sin pausa',
            color: summary.meanHoldTime > 0.3 ? '#16C79A' : '#F5A623',
            icon: summary.meanHoldTime > 0.3 ? '✓' : '—',
            tip: summary.meanHoldTime > 0.3
              ? 'Buena pausa isométrica en la contracción máxima. Esto mejora la activación muscular y la fuerza en el punto más exigente del ejercicio.'
              : 'No hay pausa en la contracción máxima. Prueba sostener 1-2 segundos arriba (cuando el antebrazo toca el bíceps) antes de bajar. Esto activa más fibras musculares y mejora la conexión mente-músculo.',
          }}
          detail="Tiempo en máxima flexión por repetición. Protocolos isométricos (0.5-2s de pausa) son analgésicos en tendinopatías."
          optimal={{ value: '0.5–2.0s', current: summary.meanHoldTime, unit: 's', target: 1, max: 5 }}
        />
      </div>

      {/* ROM per rep bar chart */}
      <div className="bg-white rounded-3xl p-6 shadow-sm">
        <h3 className="font-display text-xl font-bold mb-1">ROM por Repetición</h3>
        <p className="text-sm text-ink/40 mb-4">Degradación indica fatiga muscular</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={repMetrics}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1A1A2E10" />
            <XAxis dataKey="repNumber" tick={{ fontSize: 11 }} label={{ value: 'Rep', position: 'insideBottom', offset: -2, fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(v) => [`${v}°`, 'ROM']}
            />
            <Bar dataKey="rom" fill="#E94560" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function OptimalBar({ optimal, assessment }) {
  if (!optimal) return null;
  const { current, target, max, lower } = optimal;
  // For "lower is better" metrics, invert the visual
  const clampedCurrent = Math.max(0, Math.min(current, max));
  const currentPct = (clampedCurrent / max) * 100;
  const targetPct = (target / max) * 100;

  // How close to optimal (0 = at target, 1 = far away)
  const distance = Math.abs(current - target);
  const maxDistance = max * 0.5;
  const closeness = Math.max(0, 100 - (distance / maxDistance) * 100);

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-ink/40">Tu valor</span>
        <span className="text-xs text-ink/40">Meta: <strong className="text-ink/60">{optimal.value}</strong></span>
      </div>
      <div className="relative w-full h-4 bg-ink/5 rounded-full overflow-visible">
        {/* Current value bar */}
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
          style={{
            width: `${currentPct}%`,
            backgroundColor: assessment.color,
            opacity: 0.7,
          }}
        />
        {/* Optimal zone marker */}
        <div
          className="absolute top-[-3px] w-0.5 h-[22px] rounded-full bg-ink/60"
          style={{ left: `${targetPct}%` }}
          title={`Óptimo: ${target}${optimal.unit}`}
        />
        <div
          className="absolute top-[-14px] text-[9px] font-mono text-ink/50 -translate-x-1/2"
          style={{ left: `${targetPct}%` }}
        >
          {target}{optimal.unit}
        </div>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs font-mono font-semibold" style={{ color: assessment.color }}>
          {current}{optimal.unit}
        </span>
        <span className="text-xs text-ink/40">
          {closeness >= 80 ? 'En zona óptima' : closeness >= 50 ? 'Cerca del óptimo' : lower ? 'Reducir para mejorar' : 'Aumentar para mejorar'}
        </span>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, assessment, detail, optimal }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="metric-card bg-white rounded-3xl p-5 shadow-sm cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <p className="text-sm text-ink/50 mb-1 font-medium">{title}</p>
      <p className="font-mono text-3xl font-bold text-ink">{value}</p>
      <p className="text-sm text-ink/40 mt-1">{subtitle}</p>
      <div className="mt-3 flex items-center gap-2">
        <span
          className="text-sm font-semibold px-3 py-1 rounded-full"
          style={{ color: assessment.color, backgroundColor: assessment.color + '18' }}
        >
          {assessment.icon} {assessment.label}
        </span>
        <span className="text-xs text-ink/30 ml-auto">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Optimal comparison bar — always visible */}
      <OptimalBar optimal={optimal} assessment={assessment} />

      {expanded && (
        <div className="mt-4 pt-4 border-t border-ink/10 space-y-3">
          <p className="text-sm text-ink/60 leading-relaxed">{detail}</p>
          {assessment.tip && (
            <div className="bg-bone rounded-xl p-4" style={{ borderLeft: `4px solid ${assessment.color}` }}>
              <p className="text-xs font-semibold text-ink/60 mb-1 uppercase tracking-wide">Consejo</p>
              <p className="text-sm text-ink/70 leading-relaxed">{assessment.tip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// REPS TAB
// ────────────────────────────────────────────
function repInterpretation(rep, repMetrics) {
  const findings = [];
  const romAssess = assessMetric('rom', rep.rom);
  const trunkAssess = assessMetric('trunkLean', rep.maxTrunkLean);
  const ceAssess = assessMetric('ceRatio', rep.ceRatio);

  // ROM comparison vs set average
  const avgROM = repMetrics.reduce((s, r) => s + r.rom, 0) / repMetrics.length;
  const romDiff = rep.rom - avgROM;
  if (romDiff < -10) {
    findings.push({ type: 'warn', text: `ROM ${Math.abs(Math.round(romDiff))}° por debajo del promedio del set. Posible fatiga o dolor limitando el rango.` });
  } else if (romDiff > 10) {
    findings.push({ type: 'good', text: `ROM ${Math.round(romDiff)}° por encima del promedio. Buena amplitud en esta repetición.` });
  }

  // Trunk
  if (rep.maxTrunkLean > 15) {
    findings.push({ type: 'warn', text: `Compensación del tronco de ${rep.maxTrunkLean}°. Estás usando impulso lumbar para subir el peso. Reduce la carga o apoya la espalda.` });
  } else if (rep.maxTrunkLean > 8) {
    findings.push({ type: 'caution', text: `Ligera inclinación del tronco (${rep.maxTrunkLean}°). Activa el core y mantén la espalda recta.` });
  } else {
    findings.push({ type: 'good', text: 'Postura estable. El bíceps está haciendo todo el trabajo.' });
  }

  // Tempo
  if (rep.ceRatio > 1.5) {
    findings.push({ type: 'warn', text: `Fase excéntrica demasiado rápida (ratio ${rep.ceRatio}). Estás dejando caer el peso. Baja en 2-3 segundos controlados.` });
  } else if (rep.ceRatio < 0.3) {
    findings.push({ type: 'caution', text: `Excéntrica muy lenta (ratio ${rep.ceRatio}). Bien para rehab de tendones, pero si buscas hipertrofia apunta a un ratio ~0.5.` });
  } else if (rep.ceRatio >= 0.3 && rep.ceRatio <= 0.8) {
    findings.push({ type: 'good', text: `Tempo ideal (${rep.tConcentric}s subiendo, ${rep.tEccentric}s bajando). Buen control concéntrico-excéntrico.` });
  } else {
    findings.push({ type: 'good', text: `Buen control del tempo (${rep.tConcentric}s subiendo, ${rep.tEccentric}s bajando).` });
  }

  // TUT
  if (rep.tut < 2) {
    findings.push({ type: 'warn', text: `Rep muy rápida (${rep.tut}s). El músculo no recibe suficiente estímulo. Intenta mínimo 3 segundos por rep.` });
  } else if (rep.tut > 6) {
    findings.push({ type: 'good', text: `Excelente tiempo bajo tensión (${rep.tut}s). Gran estímulo muscular.` });
  }

  // Hold
  if (rep.holdTime > 0.5) {
    findings.push({ type: 'good', text: `Pausa isométrica de ${rep.holdTime}s en contracción máxima. Excelente para activación muscular.` });
  }

  // Fatigue: late reps
  if (rep.repNumber > repMetrics.length * 0.7 && rep.rom < avgROM * 0.85) {
    findings.push({ type: 'caution', text: 'El rango se acorta en las últimas reps. Señal de fatiga — considera terminar el set aquí en próximas sesiones.' });
  }

  // Overall score for this rep
  const score = (romAssess.color === '#16C79A' ? 1 : 0)
    + (trunkAssess.color === '#16C79A' ? 1 : 0)
    + (ceAssess.color === '#16C79A' ? 1 : 0);

  return { findings, score };
}

function RepsTab({ repMetrics }) {
  const [expandedRep, setExpandedRep] = useState(null);

  return (
    <div className="space-y-3">
      {repMetrics.map((rep) => {
        const { findings, score } = repInterpretation(rep, repMetrics);
        const isExpanded = expandedRep === rep.repNumber;
        const scoreColor = score >= 3 ? '#16C79A' : score >= 2 ? '#F5A623' : '#E94560';
        const scoreLabel = score >= 3 ? 'Excelente' : score >= 2 ? 'Aceptable' : 'Mejorable';

        return (
          <div
            key={rep.repNumber}
            className="bg-white rounded-2xl shadow-sm cursor-pointer transition-all"
            onClick={() => setExpandedRep(isExpanded ? null : rep.repNumber)}
          >
            {/* Header */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h4 className="font-display text-lg">Rep {rep.repNumber}</h4>
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: scoreColor + '20', color: scoreColor }}
                  >
                    {scoreLabel}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-ink/50">{rep.tut}s</span>
                  <span className="text-ink/30 text-xs">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-5 gap-2 text-center">
                <div>
                  <p className="font-mono text-base font-bold" style={{ color: assessMetric('rom', rep.rom).color }}>{rep.rom}°</p>
                  <p className="text-[10px] text-ink/40">ROM</p>
                </div>
                <div>
                  <p className="font-mono text-base font-bold" style={{ color: assessMetric('ceRatio', rep.ceRatio).color }}>{rep.ceRatio}</p>
                  <p className="text-[10px] text-ink/40">C:E Ratio</p>
                </div>
                <div>
                  <p className="font-mono text-base font-bold" style={{ color: assessMetric('trunkLean', rep.maxTrunkLean).color }}>
                    {rep.maxTrunkLean}°
                  </p>
                  <p className="text-[10px] text-ink/40">Tronco</p>
                </div>
                <div>
                  <p className="font-mono text-base font-bold">{rep.holdTime}s</p>
                  <p className="text-[10px] text-ink/40">Hold</p>
                </div>
                <div>
                  <p className="font-mono text-base font-bold">{rep.peakVelocity}°/s</p>
                  <p className="text-[10px] text-ink/40">Vel. pico</p>
                </div>
              </div>

              {/* Tempo bar */}
              <div className="mt-3">
                <div className="flex h-2 rounded-full overflow-hidden bg-ink/5">
                  <div
                    className="bg-accent h-full rounded-l-full"
                    style={{ width: `${rep.tut > 0 ? (rep.tConcentric / rep.tut) * 100 : 50}%` }}
                  />
                  <div
                    className="bg-glow h-full rounded-r-full"
                    style={{ width: `${rep.tut > 0 ? (rep.tEccentric / rep.tut) * 100 : 50}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-accent">Conc. {rep.tConcentric}s</span>
                  <span className="text-[10px] text-glow">Exc. {rep.tEccentric}s</span>
                </div>
              </div>
            </div>

            {/* Expanded: findings */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-1 border-t border-ink/5">
                <p className="text-[10px] font-medium text-ink/50 mb-2 uppercase tracking-wide">Interpretación</p>
                <div className="space-y-2">
                  {findings.map((f, i) => (
                    <div
                      key={i}
                      className="flex gap-2 items-start text-xs rounded-lg p-2"
                      style={{
                        backgroundColor: f.type === 'good' ? '#16C79A10' : f.type === 'warn' ? '#E9456010' : '#F5A62310',
                        borderLeft: `3px solid ${f.type === 'good' ? '#16C79A' : f.type === 'warn' ? '#E94560' : '#F5A623'}`,
                      }}
                    >
                      <span className="flex-shrink-0 mt-0.5">
                        {f.type === 'good' ? '✓' : f.type === 'warn' ? '⚠️' : '⚡'}
                      </span>
                      <p className="text-ink/70 leading-relaxed">{f.text}</p>
                    </div>
                  ))}
                </div>

                {/* Angle range detail */}
                <div className="mt-3 bg-bone rounded-lg p-3">
                  <p className="text-[10px] font-medium text-ink/50 mb-1">Detalle de ángulo</p>
                  <div className="flex gap-4 text-xs text-ink/60">
                    <span>Mín: <strong className="text-ink">{rep.minAngle}°</strong> (máx flexión)</span>
                    <span>Máx: <strong className="text-ink">{rep.maxAngle}°</strong> (extensión)</span>
                    <span>Vel. media: <strong className="text-ink">{rep.meanVelocity}°/s</strong></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────
// TIMESERIES TAB
// ────────────────────────────────────────────
function TimeseriesTab({ timeSeries, repMetrics }) {
  const chartData = timeSeries.timestamps.map((t, i) => ({
    time: Math.round(t * 100) / 100,
    angle: Math.round(timeSeries.elbowAngles[i] * 10) / 10,
    trunk: Math.round(timeSeries.trunkAngles[i] * 10) / 10,
    // Optimal zones as constant fields for ReferenceArea
    optAngleHigh: 180,
    optAngleLow: 0,
  }));

  // Custom reference area component for optimal zones
  const CustomAngleRefArea = ({ yAxisId }) => (
    <>
      {/* Green zone: 90-140° (Normal ROM zone) */}
      <ReferenceArea y1={90} y2={140} fill="#16C79A" fillOpacity={0.08} label={{ value: 'ROM Normal', position: 'insideTopRight', fontSize: 10, fill: '#16C79A88' }} />
      {/* Yellow zone: 60-90° */}
      <ReferenceArea y1={60} y2={90} fill="#F5A623" fillOpacity={0.06} />
      {/* Red zone: 0-60° */}
      <ReferenceArea y1={0} y2={60} fill="#E94560" fillOpacity={0.05} />
    </>
  );

  return (
    <div className="space-y-5">
      {/* Legend */}
      <div className="flex gap-4 flex-wrap px-1">
        <span className="flex items-center gap-1.5 text-xs text-ink/60">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#16C79A22', border: '1px solid #16C79A44' }} />
          Zona óptima
        </span>
        <span className="flex items-center gap-1.5 text-xs text-ink/60">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#F5A62322', border: '1px solid #F5A62344' }} />
          Moderado
        </span>
        <span className="flex items-center gap-1.5 text-xs text-ink/60">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#E9456022', border: '1px solid #E9456044' }} />
          Atención
        </span>
        <span className="flex items-center gap-1.5 text-xs text-ink/60">
          <span className="w-3 h-1 rounded" style={{ backgroundColor: '#0F3460' }} />
          Tu señal
        </span>
      </div>

      {/* Elbow angle over time */}
      <div className="bg-white rounded-3xl p-6 shadow-sm">
        <h3 className="font-display text-xl font-bold mb-1">Ángulo del Codo</h3>
        <p className="text-sm text-ink/40 mb-4">Flexión/extensión con zonas óptimas superpuestas</p>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="angleGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E94560" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#E94560" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1A1A2E10" />
            {/* Optimal zones */}
            <ReferenceArea y1={90} y2={140} fill="#16C79A" fillOpacity={0.1} />
            <ReferenceArea y1={60} y2={90} fill="#F5A623" fillOpacity={0.08} />
            <ReferenceArea y1={0} y2={60} fill="#E94560" fillOpacity={0.06} />
            {/* Rep start markers */}
            {repMetrics.map(rep => (
              <ReferenceLine
                key={rep.repNumber}
                x={Math.round(rep.startTime * 100) / 100}
                stroke="#1A1A2E30"
                strokeDasharray="4 4"
                label={{ value: `R${rep.repNumber}`, position: 'top', fontSize: 10, fill: '#1A1A2E66' }}
              />
            ))}
            <XAxis dataKey="time" tick={{ fontSize: 11 }} label={{ value: 'Tiempo (s)', position: 'insideBottom', offset: -2, fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, 180]} label={{ value: '°', position: 'insideLeft', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ fontSize: 13, borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(v) => [`${v}°`, 'Ángulo codo']}
              labelFormatter={(v) => `${v}s`}
            />
            <ReferenceLine y={140} stroke="#16C79A" strokeDasharray="6 3" strokeOpacity={0.5} />
            <ReferenceLine y={90} stroke="#16C79A" strokeDasharray="6 3" strokeOpacity={0.5} />
            <Area type="monotone" dataKey="angle" stroke="#E94560" fill="url(#angleGrad)" strokeWidth={2.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Trunk lean over time */}
      <div className="bg-white rounded-3xl p-6 shadow-sm">
        <h3 className="font-display text-xl font-bold mb-1">Compensación del Tronco</h3>
        <p className="text-sm text-ink/40 mb-4">Inclinación lateral — la zona verde es postura correcta</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="trunkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0F3460" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#0F3460" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1A1A2E10" />
            {/* Optimal zones for trunk */}
            <ReferenceArea y1={0} y2={8} fill="#16C79A" fillOpacity={0.1} />
            <ReferenceArea y1={8} y2={15} fill="#F5A623" fillOpacity={0.08} />
            <ReferenceArea y1={15} y2={30} fill="#E94560" fillOpacity={0.06} />
            {/* Rep markers */}
            {repMetrics.map(rep => (
              <ReferenceLine
                key={rep.repNumber}
                x={Math.round(rep.startTime * 100) / 100}
                stroke="#1A1A2E20"
                strokeDasharray="4 4"
              />
            ))}
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, 'auto']} />
            <Tooltip
              contentStyle={{ fontSize: 13, borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(v) => [`${v}°`, 'Tronco']}
            />
            <ReferenceLine y={8} stroke="#16C79A" strokeDasharray="6 3" strokeOpacity={0.5} label={{ value: '8° ideal', fontSize: 10, fill: '#16C79A' }} />
            <ReferenceLine y={15} stroke="#E94560" strokeDasharray="4 2" strokeOpacity={0.5} label={{ value: '15° límite', fontSize: 10, fill: '#E94560' }} />
            <Area type="monotone" dataKey="trunk" stroke="#0F3460" fill="url(#trunkGrad)" strokeWidth={2.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Per-rep comparison table */}
      <div className="bg-white rounded-3xl p-6 shadow-sm">
        <h3 className="font-display text-xl font-bold mb-1">Comparativa por Rep</h3>
        <p className="text-sm text-ink/40 mb-4">Cada repetición vs rangos óptimos — rojo indica dónde corregir</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10">
                <th className="text-left py-2 px-2 text-ink/50 font-medium">Rep</th>
                <th className="text-center py-2 px-2 text-ink/50 font-medium">ROM</th>
                <th className="text-center py-2 px-2 text-ink/50 font-medium">TUT</th>
                <th className="text-center py-2 px-2 text-ink/50 font-medium">C:E</th>
                <th className="text-center py-2 px-2 text-ink/50 font-medium">Tronco</th>
                <th className="text-center py-2 px-2 text-ink/50 font-medium">Hold</th>
              </tr>
            </thead>
            <tbody>
              {repMetrics.map(rep => {
                const romColor = rep.rom >= 90 ? '#16C79A' : rep.rom >= 60 ? '#F5A623' : '#E94560';
                const tutColor = rep.tut >= 3 ? '#16C79A' : rep.tut >= 2 ? '#F5A623' : '#E94560';
                const ceColor = rep.ceRatio >= 0.3 && rep.ceRatio <= 0.8 ? '#16C79A' : rep.ceRatio <= 1.5 ? '#F5A623' : '#E94560';
                const trunkColor = rep.maxTrunkLean <= 8 ? '#16C79A' : rep.maxTrunkLean <= 15 ? '#F5A623' : '#E94560';
                const holdColor = rep.holdTime >= 0.5 ? '#16C79A' : rep.holdTime >= 0.2 ? '#F5A623' : '#E94560';
                return (
                  <tr key={rep.repNumber} className="border-b border-ink/5">
                    <td className="py-2.5 px-2 font-mono font-bold text-ink/70">#{rep.repNumber}</td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="font-mono font-semibold px-2 py-0.5 rounded-md" style={{ color: romColor, backgroundColor: romColor + '15' }}>{rep.rom}°</span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="font-mono font-semibold px-2 py-0.5 rounded-md" style={{ color: tutColor, backgroundColor: tutColor + '15' }}>{rep.tut}s</span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="font-mono font-semibold px-2 py-0.5 rounded-md" style={{ color: ceColor, backgroundColor: ceColor + '15' }}>{rep.ceRatio}</span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="font-mono font-semibold px-2 py-0.5 rounded-md" style={{ color: trunkColor, backgroundColor: trunkColor + '15' }}>{rep.maxTrunkLean}°</span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="font-mono font-semibold px-2 py-0.5 rounded-md" style={{ color: holdColor, backgroundColor: holdColor + '15' }}>{rep.holdTime}s</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// METHODOLOGY TAB
// ════════════════════════════════════════════════
const METRICS_INFO = [
  {
    name: 'ROM — Rango de Movimiento',
    what: 'Mide cuántos grados recorre tu codo en cada repetición, desde la extensión máxima (brazo estirado) hasta la flexión máxima (mano cerca del hombro).',
    how: 'Se detectan 3 puntos del cuerpo con la cámara: hombro, codo y muñeca. Con esos 3 puntos se forma un ángulo en el codo. La fórmula es el arcocoseno del producto punto entre los vectores hombro→codo y muñeca→codo, convertido a grados.',
    formulas: [
      '\\theta = \\arccos\\!\\left(\\frac{\\vec{A} \\cdot \\vec{B}}{\\|\\vec{A}\\|\\;\\|\\vec{B}\\|}\\right) \\quad \\text{donde } \\vec{A}=\\text{hombro}-\\text{codo},\\; \\vec{B}=\\text{muñeca}-\\text{codo}',
      '\\text{ROM}_{\\text{rep}} = \\theta_{\\max} - \\theta_{\\min}',
    ],
    ranges: [
      { label: 'Limitado', value: '< 60°', color: '#E94560' },
      { label: 'Moderado', value: '60–90°', color: '#F5A623' },
      { label: 'Normal', value: '90–140°', color: '#16C79A' },
      { label: 'Excelente', value: '> 140°', color: '#16C79A' },
    ],
    reference: 'Norkin & White, Measurement of Joint Motion: A Guide to Goniometry, 6th Ed.',
  },
  {
    name: 'Velocidad Angular',
    what: 'Mide qué tan rápido o lento se mueve tu codo durante el ejercicio. Velocidad alta = movimiento explosivo. Velocidad baja = movimiento controlado.',
    how: 'Se calcula el cambio de ángulo entre un frame y el siguiente, dividido por el tiempo entre frames. Luego se obtiene la velocidad pico (máxima instantánea) y la velocidad media de cada repetición.',
    formulas: [
      '\\omega_{\\text{inst}} = \\frac{|\\theta(t) - \\theta(t-1)|}{\\Delta t} \\quad [°/\\text{s}]',
      '\\omega_{\\text{pico}} = \\max(\\omega_{\\text{inst}}) \\quad \\text{dentro de la fase}',
    ],
    ranges: [
      { label: 'Muy lento (rehab)', value: '15–30 °/s', color: '#F5A623' },
      { label: 'Controlado', value: '40–80 °/s', color: '#16C79A' },
      { label: 'Explosivo', value: '100–200 °/s', color: '#E94560' },
    ],
    reference: 'Winter, D.A., Biomechanics and Motor Control of Human Movement, 4th Ed.',
  },
  {
    name: 'TUT — Tiempo Bajo Tensión',
    what: 'Es el tiempo total que tu músculo está trabajando durante cada repetición y durante todo el set. Más TUT = más estímulo para el músculo.',
    how: 'Se mide el tiempo desde que empieza el movimiento de la repetición (el ángulo empieza a cambiar) hasta que vuelve a la posición inicial. La suma de todas las reps da el TUT total.',
    formulas: [
      '\\text{TUT}_{\\text{rep}} = t_{\\text{fin}} - t_{\\text{inicio}}',
      '\\text{TUT}_{\\text{total}} = \\sum_{i=1}^{n} \\text{TUT}_{\\text{rep}_i}',
    ],
    ranges: [
      { label: 'Fuerza máxima', value: '1–3s por rep', color: '#F5A623' },
      { label: 'Hipertrofia', value: '3–5s por rep', color: '#16C79A' },
      { label: 'Resistencia/rehab', value: '4–8s por rep', color: '#16C79A' },
    ],
    reference: 'Burd et al. (2012), Muscle time under tension during resistance exercise, J Physiol.',
  },
  {
    name: 'Ratio C:E — Concéntrico vs Excéntrico',
    what: 'Compara cuánto tardas subiendo el peso (fase concéntrica) vs bajándolo (fase excéntrica). Lo ideal es bajar más lento de lo que subes.',
    how: 'Dentro de cada repetición, se identifica el punto de máxima flexión (ángulo mínimo). Todo antes de ese punto es la fase concéntrica (subir), todo después es la fase excéntrica (bajar). Se divide el tiempo concéntrico entre el excéntrico.',
    formulas: [
      '\\text{Ratio}_{\\text{C:E}} = \\frac{t_{\\text{concéntrico}}}{t_{\\text{excéntrico}}}',
      '\\text{Ideal} \\approx 0.5 \\quad (\\text{ej. } 1\\text{s subir}, \\; 2\\text{s bajar})',
    ],
    ranges: [
      { label: 'Exc. muy lento', value: '< 0.3', color: '#F5A623' },
      { label: 'Ideal', value: '0.3–0.8', color: '#16C79A' },
      { label: 'Aceptable', value: '0.8–1.5', color: '#16C79A' },
      { label: 'Sin control exc.', value: '> 1.5', color: '#E94560' },
    ],
    reference: 'Alfredson H. et al. (1998), Heavy-load eccentric calf muscle training, Am J Sports Med.',
  },
  {
    name: 'Índice de Fatiga',
    what: 'Mide cuánto se deteriora tu rango de movimiento entre las primeras y las últimas repeticiones del set. Más fatiga = el músculo se cansa y el movimiento se acorta.',
    how: 'Se compara el ROM promedio de las 3 primeras reps con el de las 3 últimas. La diferencia, expresada como porcentaje, es el índice de fatiga.',
    formulas: [
      '\\text{FI}_{\\text{ROM}} = \\frac{\\overline{\\text{ROM}}_{\\text{1\\text{-}3}} - \\overline{\\text{ROM}}_{\\text{últ. 3}}}{\\overline{\\text{ROM}}_{\\text{1\\text{-}3}}} \\times 100\\%',
    ],
    ranges: [
      { label: 'Mínima', value: '< 15%', color: '#16C79A' },
      { label: 'Moderada', value: '15–30%', color: '#F5A623' },
      { label: 'Excesiva', value: '> 30%', color: '#E94560' },
    ],
    reference: 'Enoka & Duchateau (2008), Muscle fatigue: what, why and how it influences muscle function, J Physiol.',
  },
  {
    name: 'Compensación del Tronco',
    what: 'Mide cuánto inclinas el torso hacia atrás durante el ejercicio. Si te inclinas mucho, estás usando impulso del cuerpo en vez de fuerza del bíceps.',
    how: 'Se detectan los puntos del hombro y la cadera. Se calcula el ángulo que forma la línea hombro-cadera respecto a la vertical. Cualquier desviación de la vertical es compensación.',
    formulas: [
      '\\theta_{\\text{tronco}} = \\arctan2\\!\\left(x_{\\text{hombro}} - x_{\\text{cadera}},\\; y_{\\text{cadera}} - y_{\\text{hombro}}\\right)',
      '\\text{Compensación} = |\\theta_{\\text{tronco}}| \\quad [°]',
    ],
    ranges: [
      { label: 'Ideal', value: '< 8°', color: '#16C79A' },
      { label: 'Leve', value: '8–15°', color: '#F5A623' },
      { label: 'Significativa', value: '> 15°', color: '#E94560' },
    ],
    reference: 'Sahrmann, S., Movement System Impairment Syndromes of the Extremities.',
  },
  {
    name: 'CV — Consistencia entre Reps',
    what: 'Mide qué tan parecidas son tus repeticiones entre sí. Un CV bajo significa que cada rep es casi idéntica (buen control motor). Un CV alto significa movimiento errático.',
    how: 'Se calcula la desviación estándar del ROM de todas las repeticiones y se divide por el ROM promedio. El resultado se expresa como porcentaje.',
    formulas: [
      '\\text{CV} = \\frac{\\sigma_{\\text{ROM}}}{\\mu_{\\text{ROM}}} \\times 100\\%',
      '\\sigma = \\sqrt{\\frac{1}{n-1}\\sum_{i=1}^{n}(\\text{ROM}_i - \\mu)^2}',
    ],
    ranges: [
      { label: 'Alta consistencia', value: '< 10%', color: '#16C79A' },
      { label: 'Normal', value: '10–20%', color: '#F5A623' },
      { label: 'Inconsistente', value: '> 20%', color: '#E94560' },
    ],
    reference: 'Stergiou & Decker (2011), Human Movement Variability, Nonlinear Dynamics, and Pathology.',
  },
  {
    name: 'Hold Time — Pausa Isométrica',
    what: 'Mide cuánto tiempo sostienes la contracción máxima (el punto más alto del curl, cuando el antebrazo toca el bíceps). Una pausa intencional aumenta la activación muscular.',
    how: 'Se define un umbral cerca del ángulo mínimo de cada rep (ángulo mínimo + 10°). Se mide cuánto tiempo el ángulo permanece por debajo de ese umbral.',
    formulas: [
      '\\theta_{\\text{umbral}} = \\theta_{\\min} + 10°',
      't_{\\text{hold}} = \\sum \\Delta t \\quad \\text{donde } \\theta < \\theta_{\\text{umbral}}',
    ],
    ranges: [
      { label: 'Sin pausa', value: '< 0.3s', color: '#F5A623' },
      { label: 'Pausa controlada', value: '0.5–2.0s', color: '#16C79A' },
      { label: 'Isométrico terapéutico', value: '2–5s', color: '#16C79A' },
    ],
    reference: 'Rio et al. (2015), Isometric exercise induces analgesia in patellar tendinopathy, Br J Sports Med.',
  },
];

function buildExamples(repMetrics, summary) {
  if (!repMetrics || repMetrics.length < 1) return {};
  const r1 = repMetrics[0];
  const rN = repMetrics[repMetrics.length - 1];
  const n = repMetrics.length;

  return {
    0: { // ROM
      rep1: `Rep 1: ángulo máx = ${r1.maxAngle}°, ángulo mín = ${r1.minAngle}° → ROM = ${r1.maxAngle}° − ${r1.minAngle}° = ${r1.rom}°`,
      repN: `Rep ${rN.repNumber}: ángulo máx = ${rN.maxAngle}°, ángulo mín = ${rN.minAngle}° → ROM = ${rN.maxAngle}° − ${rN.minAngle}° = ${rN.rom}°`,
      insight: r1.rom > rN.rom
        ? `Tu ROM bajó ${Math.round((r1.rom - rN.rom) * 10) / 10}° entre la primera y última rep — señal de fatiga muscular.`
        : r1.rom < rN.rom
        ? `Tu ROM subió ${Math.round((rN.rom - r1.rom) * 10) / 10}° — posiblemente calentaste mejor conforme avanzó el set.`
        : 'Tu ROM se mantuvo estable durante todo el set.',
    },
    1: { // Velocidad Angular
      rep1: `Rep 1: velocidad pico = ${r1.peakVelocity} °/s, velocidad media = ${r1.meanVelocity} °/s`,
      repN: `Rep ${rN.repNumber}: velocidad pico = ${rN.peakVelocity} °/s, velocidad media = ${rN.meanVelocity} °/s`,
      insight: rN.meanVelocity < r1.meanVelocity * 0.8
        ? `La velocidad bajó un ${Math.round((1 - rN.meanVelocity / r1.meanVelocity) * 100)}% al final — tu sistema neuromuscular se fatigó.`
        : 'La velocidad se mantuvo consistente durante el set — buen control neuromuscular.',
    },
    2: { // TUT
      rep1: `Rep 1: duró ${r1.tut}s (concéntrica ${r1.tConcentric}s + excéntrica ${r1.tEccentric}s)`,
      repN: `Rep ${rN.repNumber}: duró ${rN.tut}s (concéntrica ${rN.tConcentric}s + excéntrica ${rN.tEccentric}s)`,
      insight: `TUT total del set: ${summary.totalTUT}s en ${n} reps = promedio de ${summary.meanTUT}s por rep. ${summary.meanTUT >= 3 ? 'Buen rango para hipertrofia.' : 'Intenta hacer cada rep más lenta para mayor estímulo.'}`,
    },
    3: { // Ratio C:E
      rep1: `Rep 1: subida ${r1.tConcentric}s ÷ bajada ${r1.tEccentric}s = ratio ${r1.ceRatio}`,
      repN: `Rep ${rN.repNumber}: subida ${rN.tConcentric}s ÷ bajada ${rN.tEccentric}s = ratio ${rN.ceRatio}`,
      insight: r1.ceRatio <= 0.7
        ? 'Buen control excéntrico — la bajada es más lenta que la subida, lo que maximiza el estímulo.'
        : 'La bajada es rápida respecto a la subida. Intenta bajar en el doble de tiempo que subes (ratio ~0.5).',
    },
    4: { // Fatiga
      rep1: (() => {
        const nF = Math.min(3, Math.floor(n / 2));
        const first3 = repMetrics.slice(0, nF).map(r => r.rom);
        const last3 = repMetrics.slice(-nF).map(r => r.rom);
        const avgFirst = Math.round(first3.reduce((a, b) => a + b, 0) / first3.length * 10) / 10;
        const avgLast = Math.round(last3.reduce((a, b) => a + b, 0) / last3.length * 10) / 10;
        return `Promedio ROM primeras ${nF}: ${avgFirst}° | Promedio ROM últimas ${nF}: ${avgLast}°`;
      })(),
      repN: `Índice de fatiga = (${(() => {
        const nF = Math.min(3, Math.floor(n / 2));
        const first3 = repMetrics.slice(0, nF).map(r => r.rom);
        const last3 = repMetrics.slice(-nF).map(r => r.rom);
        const avgFirst = Math.round(first3.reduce((a, b) => a + b, 0) / first3.length * 10) / 10;
        const avgLast = Math.round(last3.reduce((a, b) => a + b, 0) / last3.length * 10) / 10;
        return `${avgFirst}° − ${avgLast}°) ÷ ${avgFirst}°`;
      })()} × 100 = ${summary.fatigueIndexROM}%`,
      insight: summary.fatigueIndexROM < 10
        ? 'Fatiga mínima — la carga es apropiada para tu nivel.'
        : summary.fatigueIndexROM < 25
        ? 'Fatiga moderada — estás cerca de tu límite, lo cual es bueno para progresar.'
        : 'Fatiga alta — considera reducir el peso o las repeticiones.',
    },
    5: { // Trunk Compensation
      rep1: `Rep 1: inclinación máxima del tronco = ${r1.maxTrunkLean}°`,
      repN: `Rep ${rN.repNumber}: inclinación máxima del tronco = ${rN.maxTrunkLean}°`,
      insight: rN.maxTrunkLean > r1.maxTrunkLean + 3
        ? `Tu compensación aumentó ${Math.round((rN.maxTrunkLean - r1.maxTrunkLean) * 10) / 10}° del inicio al final — conforme te cansas, usas más impulso del cuerpo.`
        : 'Tu postura se mantuvo estable durante el set — buena activación del core.',
    },
    6: { // CV
      rep1: (() => {
        const roms = repMetrics.map(r => r.rom);
        const avg = Math.round(roms.reduce((a, b) => a + b, 0) / roms.length * 10) / 10;
        return `ROMs de tus ${n} reps: [${roms.join('°, ')}°] → promedio = ${avg}°`;
      })(),
      repN: `Desviación estándar = ${summary.stdROM}° → CV = ${summary.stdROM}° ÷ ${summary.meanROM}° × 100 = ${summary.cvROM}%`,
      insight: summary.cvROM < 5
        ? 'Alta consistencia — tus reps son casi idénticas. Excelente control motor.'
        : summary.cvROM < 15
        ? 'Variabilidad normal — cada rep difiere un poco, lo cual es esperable.'
        : 'Tus reps varían bastante entre sí. Enfócate en hacer cada movimiento igual.',
    },
    7: { // Hold Time
      rep1: `Rep 1: mantuviste la contracción máxima por ${r1.holdTime}s`,
      repN: `Rep ${rN.repNumber}: mantuviste la contracción máxima por ${rN.holdTime}s`,
      insight: r1.holdTime >= 0.5
        ? 'Buena pausa isométrica — estás maximizando la activación en el pico de contracción.'
        : 'No hay pausa significativa en el pico. Intenta sostener 1-2 segundos arriba para mayor activación.',
    },
  };
}

function MethodologyTab({ repMetrics, summary }) {
  const [openMetric, setOpenMetric] = useState(null);
  const examples = buildExamples(repMetrics, summary);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <h3 className="font-display text-xl mb-2">Cómo funciona EasyFisio</h3>
        <div className="space-y-3 text-sm text-ink/70 leading-relaxed">
          <p>
            <strong className="text-ink">1. Detección de pose:</strong> Tu video se procesa completamente en el navegador usando
            <strong> MediaPipe Pose Landmarker</strong>, un modelo de inteligencia artificial de Google que detecta 33 puntos del cuerpo humano en cada frame del video. Ningún dato sale de tu dispositivo.
          </p>
          <p>
            <strong className="text-ink">2. Extracción de ángulos:</strong> Con los puntos del hombro, codo y muñeca se calcula
            el ángulo del codo en cada frame (a 15 fps). La señal se suaviza con un promedio móvil de 5 frames para eliminar ruido.
          </p>
          <p>
            <strong className="text-ink">3. Detección de repeticiones:</strong> Un algoritmo de máquina de estados detecta cada repetición
            identificando ciclos de flexión y extensión. Los umbrales se adaptan automáticamente al rango de movimiento real de tu video.
          </p>
          <p>
            <strong className="text-ink">4. Cálculo de métricas:</strong> Para cada repetición y para el set completo se calculan
            las 8 métricas clínicas que se describen a continuación, basadas en literatura de biomecánica y rehabilitación.
          </p>
        </div>
      </div>

      <p className="text-xs text-ink/40 uppercase tracking-wide font-medium px-1">Las 8 métricas clínicas</p>

      {METRICS_INFO.map((metric, i) => {
        const isOpen = openMetric === i;
        return (
          <div
            key={i}
            className="bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer"
            onClick={() => setOpenMetric(isOpen ? null : i)}
          >
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-ink/5 flex items-center justify-center text-xs font-mono font-bold text-ink/50">
                  {i + 1}
                </span>
                <h4 className="font-display text-base">{metric.name}</h4>
              </div>
              <span className="text-ink/30 text-xs">{isOpen ? '▲' : '▼'}</span>
            </div>

            {isOpen && (
              <div className="px-4 pb-4 space-y-4 border-t border-ink/5 pt-3">
                {/* What */}
                <div>
                  <p className="text-[10px] font-medium text-ink/40 uppercase tracking-wide mb-1">Qué mide</p>
                  <p className="text-sm text-ink/70 leading-relaxed">{metric.what}</p>
                </div>

                {/* How */}
                <div>
                  <p className="text-[10px] font-medium text-ink/40 uppercase tracking-wide mb-1">Cómo se calcula</p>
                  <p className="text-sm text-ink/70 leading-relaxed">{metric.how}</p>
                </div>

                {/* Formulas */}
                <div className="bg-ink/5 rounded-lg p-4">
                  <p className="text-[10px] font-medium text-ink/40 uppercase tracking-wide mb-3">Fórmulas</p>
                  <div className="space-y-3">
                    {metric.formulas.map((f, j) => (
                      <div key={j} className="overflow-x-auto py-1 text-center">
                        <Latex expr={f} display={true} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Worked example with real data */}
                {examples[i] && (
                  <div className="bg-glow/5 border border-glow/20 rounded-lg p-4 space-y-2">
                    <p className="text-[10px] font-medium text-glow uppercase tracking-wide mb-2">Ejemplo con tus datos</p>
                    <div className="space-y-1.5 text-sm font-mono">
                      <p className="text-ink/80 bg-white/60 rounded px-2 py-1">{examples[i].rep1}</p>
                      <p className="text-ink/80 bg-white/60 rounded px-2 py-1">{examples[i].repN}</p>
                    </div>
                    <p className="text-sm text-ink/70 leading-relaxed mt-2 pt-2 border-t border-glow/15">
                      {examples[i].insight}
                    </p>
                  </div>
                )}

                {/* Ranges */}
                <div>
                  <p className="text-[10px] font-medium text-ink/40 uppercase tracking-wide mb-2">Rangos de referencia</p>
                  <div className="flex flex-wrap gap-2">
                    {metric.ranges.map((r, j) => (
                      <div
                        key={j}
                        className="flex items-center gap-2 text-xs rounded-lg px-3 py-1.5"
                        style={{ backgroundColor: r.color + '15', border: `1px solid ${r.color}30` }}
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                        <span className="font-medium" style={{ color: r.color }}>{r.label}</span>
                        <span className="text-ink/50">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reference */}
                <div className="border-t border-ink/5 pt-3">
                  <p className="text-[10px] text-ink/40 italic">Ref: {metric.reference}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════
// HISTORY VIEW
// ════════════════════════════════════════════════
function HistoryView({ demoMode, onBack }) {
  const history = demoMode ? DEMO_HISTORY : getHistory();
  const progression = demoMode ? getProgressionData() : [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
      <button onClick={onBack} className="text-sm text-ink/50 hover:text-ink mb-4 flex items-center gap-1">
        ← Volver
      </button>

      <h2 className="font-display text-2xl mb-1">
        {demoMode ? 'Historial Demo' : 'Tu Historial'}
      </h2>
      <p className="text-sm text-ink/50 mb-6">
        {demoMode
          ? 'Datos simulados: 6 semanas de rehabilitación de bíceps'
          : `${history.length} sesiones guardadas en este dispositivo`}
      </p>

      {demoMode && progression.length > 0 && (
        <div className="space-y-4 mb-8">
          {/* ROM progression */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-display text-lg mb-1">Progresión del ROM</h3>
            <p className="text-xs text-ink/40 mb-3">Tendencia a lo largo de las sesiones</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={progression}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A2E10" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[60, 150]} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Line type="monotone" dataKey="rom" stroke="#E94560" strokeWidth={2.5} dot={{ fill: '#E94560', r: 4 }} name="ROM (°)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Fatigue + CV progression */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-display text-lg mb-1">Fatiga y Consistencia</h3>
            <p className="text-xs text-ink/40 mb-3">Ambas métricas deben disminuir con la rehabilitación</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={progression}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A2E10" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Line type="monotone" dataKey="fatigue" stroke="#E94560" strokeWidth={2} dot={{ fill: '#E94560', r: 3 }} name="Fatiga (%)" />
                <Line type="monotone" dataKey="cv" stroke="#0F3460" strokeWidth={2} dot={{ fill: '#0F3460', r: 3 }} name="CV ROM (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Trunk compensation trend */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-display text-lg mb-1">Compensación del Tronco</h3>
            <p className="text-xs text-ink/40 mb-3">Reducción indica mejor técnica y fuerza adecuada</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={progression}>
                <defs>
                  <linearGradient id="trunkProgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F5A623" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#F5A623" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A2E10" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <ReferenceLine y={5} stroke="#16C79A" strokeDasharray="4 2" label={{ value: 'Ideal', fontSize: 9, fill: '#16C79A' }} />
                <Area type="monotone" dataKey="trunk" stroke="#F5A623" fill="url(#trunkProgGrad)" strokeWidth={2} dot={{ fill: '#F5A623', r: 3 }} name="Tronco (°)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Session list */}
      <div className="space-y-3">
        {history.map((session, i) => (
          <div key={session.id || i} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-display text-base">
                  {session.label || `Sesión ${i + 1}`}
                </h4>
                <p className="text-xs text-ink/40">
                  {new Date(session.savedAt || session.analyzedAt).toLocaleDateString('es-MX', {
                    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-lg font-bold text-accent">{session.totalReps} reps</p>
                <p className="text-xs text-ink/40">ROM {session.summary?.meanROM || '—'}°</p>
              </div>
            </div>
            {session.summary && (
              <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-ink/5">
                <MiniStat label="TUT" value={`${session.summary.totalTUT}s`} />
                <MiniStat label="Fatiga" value={`${session.summary.fatigueIndexROM}%`} />
                <MiniStat label="CV" value={`${session.summary.cvROM}%`} />
                <MiniStat label="Tronco" value={`${session.summary.meanTrunkCompensation}°`} />
              </div>
            )}
          </div>
        ))}
      </div>

      {history.length === 0 && (
        <div className="text-center py-16 text-ink/30">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-sm">No hay sesiones guardadas aún</p>
          <p className="text-xs mt-1">Activa el toggle de Demo para ver datos de ejemplo</p>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="text-center">
      <p className="font-mono text-sm font-bold text-ink">{value}</p>
      <p className="text-[9px] text-ink/40">{label}</p>
    </div>
  );
}
