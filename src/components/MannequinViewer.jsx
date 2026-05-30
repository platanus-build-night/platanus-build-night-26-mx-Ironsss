import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ─── Landmark indices ───
const LM = {
  NOSE: 0,
  LEFT_EAR: 7, RIGHT_EAR: 8,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
};

// ─── Body anatomy ───
const BODY_SEGMENTS = [
  { from: 'MID_SHOULDER', to: 'MID_HIP', rTop: 0.075, rBot: 0.065, cat: 'torso' },
  { from: 'MID_SHOULDER', to: LM.LEFT_SHOULDER, rTop: 0.035, rBot: 0.040, cat: 'torso' },
  { from: 'MID_SHOULDER', to: LM.RIGHT_SHOULDER, rTop: 0.035, rBot: 0.040, cat: 'torso' },
  { from: 'MID_HIP', to: LM.LEFT_HIP, rTop: 0.035, rBot: 0.045, cat: 'torso' },
  { from: 'MID_HIP', to: LM.RIGHT_HIP, rTop: 0.035, rBot: 0.045, cat: 'torso' },
  { from: 'MID_SHOULDER', to: 'HEAD_CENTER', rTop: 0.030, rBot: 0.030, cat: 'head' },
  { from: LM.LEFT_SHOULDER, to: LM.LEFT_ELBOW, rTop: 0.040, rBot: 0.035, cat: 'leftArm' },
  { from: LM.LEFT_ELBOW, to: LM.LEFT_WRIST, rTop: 0.033, rBot: 0.025, cat: 'leftArm' },
  { from: LM.RIGHT_SHOULDER, to: LM.RIGHT_ELBOW, rTop: 0.040, rBot: 0.035, cat: 'rightArm' },
  { from: LM.RIGHT_ELBOW, to: LM.RIGHT_WRIST, rTop: 0.033, rBot: 0.025, cat: 'rightArm' },
  { from: LM.LEFT_HIP, to: LM.LEFT_KNEE, rTop: 0.055, rBot: 0.045, cat: 'leftLeg' },
  { from: LM.LEFT_KNEE, to: LM.LEFT_ANKLE, rTop: 0.042, rBot: 0.032, cat: 'leftLeg' },
  { from: LM.RIGHT_HIP, to: LM.RIGHT_KNEE, rTop: 0.055, rBot: 0.045, cat: 'rightLeg' },
  { from: LM.RIGHT_KNEE, to: LM.RIGHT_ANKLE, rTop: 0.042, rBot: 0.032, cat: 'rightLeg' },
];

const JOINTS = [
  { at: 'HEAD_CENTER', r: 0.070, cat: 'head' },
  { at: 'MID_SHOULDER', r: 0.038, cat: 'torso' },
  { at: LM.LEFT_SHOULDER, r: 0.040, cat: 'leftArm' },
  { at: LM.RIGHT_SHOULDER, r: 0.040, cat: 'rightArm' },
  { at: LM.LEFT_ELBOW, r: 0.035, cat: 'leftArm' },
  { at: LM.RIGHT_ELBOW, r: 0.035, cat: 'rightArm' },
  { at: LM.LEFT_WRIST, r: 0.028, cat: 'leftArm' },
  { at: LM.RIGHT_WRIST, r: 0.028, cat: 'rightArm' },
  { at: 'MID_HIP', r: 0.040, cat: 'torso' },
  { at: LM.LEFT_HIP, r: 0.045, cat: 'leftLeg' },
  { at: LM.RIGHT_HIP, r: 0.045, cat: 'rightLeg' },
  { at: LM.LEFT_KNEE, r: 0.040, cat: 'leftLeg' },
  { at: LM.RIGHT_KNEE, r: 0.040, cat: 'rightLeg' },
  { at: LM.LEFT_ANKLE, r: 0.032, cat: 'leftLeg' },
  { at: LM.RIGHT_ANKLE, r: 0.032, cat: 'rightLeg' },
];

// ─── Transform landmarks to 3D world coords ───
function landmarksToWorld(landmarks, scale = 2.5) {
  // landmarks is array of MediaPipe landmark objects {x, y, z, visibility}
  const points = landmarks.map(l => new THREE.Vector3(
    (l.x - 0.5) * scale,
    -(l.y - 0.5) * scale,
    -(l.z || 0) * scale * 0.8
  ));

  const MID_SHOULDER = new THREE.Vector3()
    .addVectors(points[LM.LEFT_SHOULDER], points[LM.RIGHT_SHOULDER]).multiplyScalar(0.5);
  const MID_HIP = new THREE.Vector3()
    .addVectors(points[LM.LEFT_HIP], points[LM.RIGHT_HIP]).multiplyScalar(0.5);
  const HEAD_CENTER = new THREE.Vector3()
    .addVectors(points[LM.LEFT_EAR], points[LM.RIGHT_EAR]).multiplyScalar(0.5);
  HEAD_CENTER.y += 0.06;

  return { points, MID_SHOULDER, MID_HIP, HEAD_CENTER };
}

function getPoint(data, ref) {
  return typeof ref === 'number' ? data.points[ref] : data[ref];
}

// ─── Orient cylinder between two points ───
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();

function orientCylinder(mesh, pA, pB) {
  _dir.subVectors(pB, pA);
  const len = _dir.length();
  if (len < 0.001) return;
  mesh.position.lerpVectors(pA, pB, 0.5);
  mesh.scale.set(1, len, 1);
  _dir.normalize();
  _quat.setFromUnitVectors(_up, _dir);
  mesh.quaternion.copy(_quat);
}

// ─── Score-based color for body parts ───
// score: 0-3, where 3=green, 2=yellow, 0-1=red
function scoreToColor(score) {
  if (score >= 3) return 0x16C79A; // green
  if (score >= 2) return 0xF5A623; // yellow
  return 0xE94560; // red
}

const GREY = 0x9e9e9e;
const HEAD_GREY = 0xbdbdbd;

// ─── Component ───
export default function MannequinViewer({
  frameLandmarks,
  activeSide = 'right',
  repMetrics,
  currentTime,
  onTimeUpdate,
  getRepScore, // (repNumber) => 0-3
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const segRef = useRef([]);
  const jntRef = useRef([]);
  const matsRef = useRef({});
  const rafRef = useRef(null);
  const angleLabelRef = useRef(null);

  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const playRef = useRef(false);
  const frameIdxRef = useRef(0);
  const total = frameLandmarks?.length || 0;

  const activeArm = activeSide === 'left' ? 'leftArm' : 'rightArm';

  // Find which rep a given time falls into
  const getRepAtTime = useCallback((t) => {
    if (!repMetrics) return null;
    return repMetrics.find(r => t >= r.startTime && t <= r.endTime) || null;
  }, [repMetrics]);

  // Initialize Three.js scene
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !frameLandmarks?.length) return;
    const W = el.clientWidth, H = el.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 6, 14);

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(0, 0.3, 3.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.5;
    controls.maxDistance = 8;
    controls.target.set(0, 0, 0);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x6688cc, 0.4);
    fill.position.set(-3, 2, -2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xe94560, 0.3);
    rim.position.set(0, 1, -4);
    scene.add(rim);

    // Floor + grid
    const grid = new THREE.GridHelper(8, 20, 0x333355, 0x222244);
    grid.position.y = -1.5;
    scene.add(grid);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.ShadowMaterial({ opacity: 0.3 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.5;
    floor.receiveShadow = true;
    scene.add(floor);

    // Materials — we'll update colors dynamically
    const matBase = new THREE.MeshStandardMaterial({ color: GREY, roughness: 0.7, metalness: 0.1 });
    const matHead = new THREE.MeshStandardMaterial({ color: HEAD_GREY, roughness: 0.6, metalness: 0.05 });
    const matActiveArm = new THREE.MeshStandardMaterial({ color: GREY, roughness: 0.5, metalness: 0.15, emissive: 0x000000, emissiveIntensity: 0.1 });
    const matActiveShoulder = new THREE.MeshStandardMaterial({ color: GREY, roughness: 0.5, metalness: 0.15, emissive: 0x000000, emissiveIntensity: 0.1 });

    matsRef.current = { base: matBase, head: matHead, activeArm: matActiveArm, activeShoulder: matActiveShoulder };

    const pickMat = (cat) => {
      if (cat === activeArm) return matActiveArm;
      if (cat === 'head') return matHead;
      return matBase;
    };

    // Build mannequin segments
    const segs = BODY_SEGMENTS.map(s => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(s.rTop, s.rBot, 1, 12), pickMat(s.cat));
      m.castShadow = true;
      scene.add(m);
      return { mesh: m, from: s.from, to: s.to, cat: s.cat };
    });
    segRef.current = segs;

    // Build joints
    const jnts = JOINTS.map(j => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(j.r, 16, 12), pickMat(j.cat));
      m.castShadow = true;
      scene.add(m);
      return { mesh: m, at: j.at, cat: j.cat };
    });
    jntRef.current = jnts;

    // Angle label sprite
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 128;
    labelCanvas.height = 64;
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: labelTexture, transparent: true })
    );
    sprite.scale.set(0.35, 0.175, 1);
    scene.add(sprite);
    angleLabelRef.current = { sprite, canvas: labelCanvas, ctx: labelCanvas.getContext('2d'), texture: labelTexture };

    sceneRef.current = { scene, camera, renderer, controls };

    // Render loop
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    addEventListener('resize', onResize);

    return () => {
      removeEventListener('resize', onResize);
      cancelAnimationFrame(rafRef.current);
      renderer.dispose();
      controls.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [frameLandmarks, activeSide]);

  // Apply pose + update colors based on current rep score
  const applyPose = useCallback((idx) => {
    if (!frameLandmarks?.[idx]) return;
    const lm = frameLandmarks[idx].landmarks;
    const t = frameLandmarks[idx].timestamp;
    const data = landmarksToWorld(lm);

    // Update segments
    segRef.current.forEach(s => {
      const a = getPoint(data, s.from), b = getPoint(data, s.to);
      if (a && b) orientCylinder(s.mesh, a, b);
    });

    // Update joints
    jntRef.current.forEach(j => {
      const p = getPoint(data, j.at);
      if (p) j.mesh.position.copy(p);
    });

    // Color active arm based on rep score
    const rep = getRepAtTime(t);
    const mats = matsRef.current;
    if (rep && getRepScore) {
      const score = getRepScore(rep.repNumber);
      const color = scoreToColor(score);
      mats.activeArm.color.setHex(color);
      mats.activeArm.emissive.setHex(color);
      mats.activeShoulder.color.setHex(color);
      mats.activeShoulder.emissive.setHex(color);
    } else {
      mats.activeArm.color.setHex(GREY);
      mats.activeArm.emissive.setHex(0x000000);
      mats.activeShoulder.color.setHex(GREY);
      mats.activeShoulder.emissive.setHex(0x000000);
    }

    // Update angle label near elbow
    const elbowIdx = activeSide === 'left' ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW;
    const shoulderIdx = activeSide === 'left' ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;
    const wristIdx = activeSide === 'left' ? LM.LEFT_WRIST : LM.RIGHT_WRIST;

    if (lm[elbowIdx] && lm[shoulderIdx] && lm[wristIdx] && angleLabelRef.current) {
      const sh = lm[shoulderIdx], el2 = lm[elbowIdx], wr = lm[wristIdx];
      const ab = { x: sh.x - el2.x, y: sh.y - el2.y };
      const cb = { x: wr.x - el2.x, y: wr.y - el2.y };
      const dot = ab.x * cb.x + ab.y * cb.y;
      const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2);
      const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2);
      const cosine = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
      const angleDeg = Math.round(Math.acos(cosine) * (180 / Math.PI));

      const { sprite, canvas, ctx, texture } = angleLabelRef.current;
      ctx.clearRect(0, 0, 128, 64);

      const repScore = rep && getRepScore ? getRepScore(rep.repNumber) : 0;
      const bgColor = repScore >= 3 ? '#16C79A' : repScore >= 2 ? '#F5A623' : '#E94560';
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.roundRect(0, 0, 128, 64, 12);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 30px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${angleDeg}\u00B0`, 64, 32);
      texture.needsUpdate = true;

      const elbowWorld = getPoint(data, elbowIdx);
      if (elbowWorld) {
        sprite.position.copy(elbowWorld);
        sprite.position.x += 0.18;
        sprite.position.y += 0.12;
      }
    }
  }, [frameLandmarks, activeSide, getRepAtTime, getRepScore]);

  // Apply pose when frameIdx changes
  useEffect(() => { applyPose(frameIdx); }, [frameIdx, applyPose]);

  // Sync from external currentTime (from the video)
  useEffect(() => {
    if (currentTime == null || !frameLandmarks?.length || playing) return;
    // Find closest frame to currentTime
    let bestIdx = 0, bestDist = Infinity;
    for (let i = 0; i < frameLandmarks.length; i++) {
      const d = Math.abs(frameLandmarks[i].timestamp - currentTime);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (bestIdx !== frameIdxRef.current) {
      frameIdxRef.current = bestIdx;
      setFrameIdx(bestIdx);
    }
  }, [currentTime, frameLandmarks, playing]);

  // Playback loop
  useEffect(() => {
    playRef.current = playing;
    if (!playing) return;
    let last = performance.now();
    const ms = (1000 / 24) / speed;
    const tick = () => {
      if (!playRef.current) return;
      const now = performance.now();
      if (now - last >= ms) {
        last = now;
        setFrameIdx(p => {
          const n = p + 1;
          if (n >= total) { setPlaying(false); return 0; }
          frameIdxRef.current = n;
          if (onTimeUpdate && frameLandmarks[n]) onTimeUpdate(frameLandmarks[n].timestamp);
          return n;
        });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [playing, speed, total, onTimeUpdate, frameLandmarks]);

  // Camera presets
  const setView = (v) => {
    if (!sceneRef.current) return;
    const { camera: c, controls: ct } = sceneRef.current;
    const views = {
      front: [0, 0.3, 3.5],
      side: [3.5, 0.3, 0],
      top: [0, 4, 0.01],
      angle: [2.5, 1.5, 2.5],
      back: [0, 0.3, -3.5],
    };
    c.position.set(...(views[v] || views.front));
    ct.target.set(0, 0, 0);
    ct.update();
  };

  // Rep info for current frame
  const currentT = frameLandmarks?.[frameIdx]?.timestamp ?? 0;
  const currentRep = getRepAtTime(currentT);
  const currentScore = currentRep && getRepScore ? getRepScore(currentRep.repNumber) : null;
  const scoreLabelText = currentScore != null
    ? (currentScore >= 3 ? 'Excelente' : currentScore >= 2 ? 'Aceptable' : 'Mejorable')
    : null;
  const scoreColorHex = currentScore != null
    ? (currentScore >= 3 ? '#16C79A' : currentScore >= 2 ? '#F5A623' : '#E94560')
    : null;

  if (!total) return <p className="text-ink/40 text-center py-12">Sin datos de landmarks</p>;

  return (
    <div className="space-y-4">
      {/* 3D Viewport */}
      <div className="relative">
        <div
          ref={containerRef}
          className="w-full bg-ink rounded-2xl overflow-hidden"
          style={{ height: '500px', touchAction: 'none' }}
        />

        {/* Status overlay */}
        {currentRep && (
          <div
            className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{ backgroundColor: scoreColorHex + '30', backdropFilter: 'blur(8px)' }}
          >
            <span className="font-display font-bold text-white text-lg">Rep {currentRep.repNumber}</span>
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ color: scoreColorHex, backgroundColor: scoreColorHex + '40' }}
            >
              {scoreLabelText}
            </span>
          </div>
        )}

        {/* Camera preset buttons */}
        <div className="absolute top-4 right-4 flex gap-1.5">
          {[
            { id: 'front', label: 'Frontal' },
            { id: 'side', label: 'Lateral' },
            { id: 'angle', label: '3/4' },
            { id: 'back', label: 'Espalda' },
            { id: 'top', label: 'Arriba' },
          ].map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className="text-[10px] font-medium text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Time indicator */}
        <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg">
          <span className="font-mono text-xs text-white/60">{currentT.toFixed(1)}s</span>
        </div>
      </div>

      {/* Playback controls */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPlaying(!playing)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-ink text-white hover:bg-ink/80 transition-colors text-lg"
          >
            {playing ? '\u23F8' : '\u25B6'}
          </button>
          <input
            type="range"
            min={0}
            max={total - 1}
            value={frameIdx}
            onChange={e => {
              setPlaying(false);
              const idx = +e.target.value;
              frameIdxRef.current = idx;
              setFrameIdx(idx);
              if (onTimeUpdate && frameLandmarks[idx]) onTimeUpdate(frameLandmarks[idx].timestamp);
            }}
            className="flex-1 accent-accent"
          />
          <span className="font-mono text-xs text-ink/40 w-20 text-right">
            {frameIdx + 1}/{total}
          </span>
        </div>

        {/* Speed controls + rep jumps */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-1.5">
            {[0.25, 0.5, 1, 2].map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`text-[10px] px-2.5 py-1 rounded-lg transition-colors ${
                  speed === s
                    ? 'bg-accent text-white font-bold'
                    : 'bg-ink/5 text-ink/50 hover:bg-ink/10'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Rep jump buttons */}
          {repMetrics && (
            <div className="flex gap-1">
              {repMetrics.map(rep => {
                const score = getRepScore ? getRepScore(rep.repNumber) : 2;
                const color = score >= 3 ? '#16C79A' : score >= 2 ? '#F5A623' : '#E94560';
                const isActive = currentRep?.repNumber === rep.repNumber;
                return (
                  <button
                    key={rep.repNumber}
                    onClick={() => {
                      setPlaying(false);
                      // Find closest frame to rep start
                      let bestIdx = 0, bestDist = Infinity;
                      for (let i = 0; i < frameLandmarks.length; i++) {
                        const d = Math.abs(frameLandmarks[i].timestamp - rep.startTime);
                        if (d < bestDist) { bestDist = d; bestIdx = i; }
                      }
                      frameIdxRef.current = bestIdx;
                      setFrameIdx(bestIdx);
                      if (onTimeUpdate) onTimeUpdate(rep.startTime);
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white transition-all ${isActive ? 'ring-2 ring-white scale-110' : 'hover:scale-110'}`}
                    style={{ backgroundColor: color }}
                    title={`Rep ${rep.repNumber}`}
                  >
                    {rep.repNumber}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#9e9e9e' }} />
          <span className="text-[11px] text-ink/40">Cuerpo (default)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#16C79A' }} />
          <span className="text-[11px] text-ink/40">Bien</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F5A623' }} />
          <span className="text-[11px] text-ink/40">Aceptable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#E94560' }} />
          <span className="text-[11px] text-ink/40">Mejorable</span>
        </div>
        <span className="text-[10px] text-ink/30 ml-auto">Arrastra para rotar la vista</span>
      </div>
    </div>
  );
}
