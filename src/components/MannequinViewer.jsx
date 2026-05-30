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

// ─── Anatomical body segments with realistic radii ───
// Human proportions: total height ~7.5 heads. Scale=2.5 → ~2.5 units tall.
// Radii tuned so limbs look like a smooth mannequin (department store dummy).
const BODY_SEGMENTS = [
  // Torso core: chest to pelvis (thick, tapers slightly)
  { from: 'MID_SHOULDER', to: 'MID_HIP', rTop: 0.11, rBot: 0.09, cat: 'torso', segs: 16 },
  // Clavicles: thin, connecting center to shoulders
  { from: 'MID_SHOULDER', to: LM.LEFT_SHOULDER, rTop: 0.045, rBot: 0.050, cat: 'torso', segs: 8 },
  { from: 'MID_SHOULDER', to: LM.RIGHT_SHOULDER, rTop: 0.045, rBot: 0.050, cat: 'torso', segs: 8 },
  // Pelvis: hips widen
  { from: 'MID_HIP', to: LM.LEFT_HIP, rTop: 0.05, rBot: 0.06, cat: 'torso', segs: 8 },
  { from: 'MID_HIP', to: LM.RIGHT_HIP, rTop: 0.05, rBot: 0.06, cat: 'torso', segs: 8 },
  // Neck
  { from: 'MID_SHOULDER', to: 'NECK_TOP', rTop: 0.038, rBot: 0.035, cat: 'head', segs: 8 },
  // Upper arms (deltoid → elbow, tapers)
  { from: LM.LEFT_SHOULDER, to: LM.LEFT_ELBOW, rTop: 0.048, rBot: 0.038, cat: 'leftArm', segs: 10 },
  { from: LM.RIGHT_SHOULDER, to: LM.RIGHT_ELBOW, rTop: 0.048, rBot: 0.038, cat: 'rightArm', segs: 10 },
  // Forearms (elbow → wrist, tapers more)
  { from: LM.LEFT_ELBOW, to: LM.LEFT_WRIST, rTop: 0.036, rBot: 0.025, cat: 'leftArm', segs: 10 },
  { from: LM.RIGHT_ELBOW, to: LM.RIGHT_WRIST, rTop: 0.036, rBot: 0.025, cat: 'rightArm', segs: 10 },
  // Thighs (wide → knee)
  { from: LM.LEFT_HIP, to: LM.LEFT_KNEE, rTop: 0.070, rBot: 0.048, cat: 'leftLeg', segs: 12 },
  { from: LM.RIGHT_HIP, to: LM.RIGHT_KNEE, rTop: 0.070, rBot: 0.048, cat: 'rightLeg', segs: 12 },
  // Calves (knee → ankle, muscular taper)
  { from: LM.LEFT_KNEE, to: LM.LEFT_ANKLE, rTop: 0.046, rBot: 0.030, cat: 'leftLeg', segs: 12 },
  { from: LM.RIGHT_KNEE, to: LM.RIGHT_ANKLE, rTop: 0.046, rBot: 0.030, cat: 'rightLeg', segs: 12 },
];

// Joints: smooth spheres at articulation points
const JOINTS = [
  { at: 'MID_SHOULDER', r: 0.055, cat: 'torso' },
  { at: LM.LEFT_SHOULDER, r: 0.052, cat: 'leftArm' },
  { at: LM.RIGHT_SHOULDER, r: 0.052, cat: 'rightArm' },
  { at: LM.LEFT_ELBOW, r: 0.040, cat: 'leftArm' },
  { at: LM.RIGHT_ELBOW, r: 0.040, cat: 'rightArm' },
  { at: LM.LEFT_WRIST, r: 0.028, cat: 'leftArm' },
  { at: LM.RIGHT_WRIST, r: 0.028, cat: 'rightArm' },
  { at: 'MID_HIP', r: 0.058, cat: 'torso' },
  { at: LM.LEFT_HIP, r: 0.058, cat: 'leftLeg' },
  { at: LM.RIGHT_HIP, r: 0.058, cat: 'rightLeg' },
  { at: LM.LEFT_KNEE, r: 0.046, cat: 'leftLeg' },
  { at: LM.RIGHT_KNEE, r: 0.046, cat: 'rightLeg' },
  { at: LM.LEFT_ANKLE, r: 0.032, cat: 'leftLeg' },
  { at: LM.RIGHT_ANKLE, r: 0.032, cat: 'rightLeg' },
];

// ─── Create a capsule-like organic limb geometry ───
// Uses LatheGeometry with a profile curve that bulges in the middle
function createLimbGeometry(rTop, rBot, heightSegs) {
  const points = [];
  const steps = heightSegs;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 = top, 1 = bottom
    const baseR = rTop + (rBot - rTop) * t;
    // Slight belly in the middle (muscle bulge) — sinusoidal bump
    const bulge = Math.sin(t * Math.PI) * 0.012;
    const r = baseR + bulge;
    const y = 0.5 - t; // height=1, centered
    points.push(new THREE.Vector2(r, y));
  }
  return new THREE.LatheGeometry(points, 16);
}

// ─── Create anatomical head ───
// Slightly elongated sphere (ellipsoid) for realistic head shape
function createHeadGeometry() {
  const geo = new THREE.SphereGeometry(0.08, 20, 16);
  // Stretch slightly vertically for skull shape
  geo.scale(0.85, 1.0, 0.9);
  return geo;
}

// ─── Transform landmarks to 3D world coords ───
function landmarksToWorld(landmarks, scale = 2.5) {
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
  HEAD_CENTER.y += 0.10; // Raise to skull center

  // Neck top: between head center and mid-shoulder
  const NECK_TOP = new THREE.Vector3().lerpVectors(MID_SHOULDER, HEAD_CENTER, 0.55);

  return { points, MID_SHOULDER, MID_HIP, HEAD_CENTER, NECK_TOP };
}

function getPoint(data, ref) {
  return typeof ref === 'number' ? data.points[ref] : data[ref];
}

// ─── Orient cylinder/limb between two points ───
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();

function orientLimb(mesh, pA, pB) {
  _dir.subVectors(pB, pA);
  const len = _dir.length();
  if (len < 0.001) return;
  mesh.position.lerpVectors(pA, pB, 0.5);
  mesh.scale.set(1, len, 1);
  _dir.normalize();
  _quat.setFromUnitVectors(_up, _dir);
  mesh.quaternion.copy(_quat);
}

// ─── Score → color ───
function scoreToColor(score) {
  if (score >= 3) return 0x16C79A;
  if (score >= 2) return 0xF5A623;
  return 0xE94560;
}

function scoreToCSS(score) {
  if (score >= 3) return '#16C79A';
  if (score >= 2) return '#F5A623';
  return '#E94560';
}

const GREY = 0xC0B8B0;      // Warm mannequin grey (like a display dummy)
const HEAD_GREY = 0xD0C8C0;  // Slightly lighter head

// ─── Component ───
export default function MannequinViewer({
  frameLandmarks,
  activeSide = 'right',
  repMetrics,
  currentTime,
  getRepScore,
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const segRef = useRef([]);
  const jntRef = useRef([]);
  const headRef = useRef(null);
  const matsRef = useRef({});
  const rafRef = useRef(null);
  const angleLabelRef = useRef(null);
  const frameIdxRef = useRef(0);

  const total = frameLandmarks?.length || 0;
  const activeArm = activeSide === 'left' ? 'leftArm' : 'rightArm';

  const getRepAtTime = useCallback((t) => {
    if (!repMetrics) return null;
    return repMetrics.find(r => t >= r.startTime && t <= r.endTime) || null;
  }, [repMetrics]);

  // ── Initialize Three.js scene ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !frameLandmarks?.length) return;
    const W = el.clientWidth, H = el.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 7, 16);

    // Camera — slightly elevated for a natural viewing angle
    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
    camera.position.set(0, 0.2, 3.8);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    el.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 1.5;
    controls.maxDistance = 8;
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI * 0.9;

    // ── Lighting (studio-style, 3-point) ──
    scene.add(new THREE.AmbientLight(0xffeedd, 0.45));

    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 15;
    key.shadow.bias = -0.001;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x8899bb, 0.35);
    fill.position.set(-4, 2, -2);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffeedd, 0.25);
    rim.position.set(0, 3, -5);
    scene.add(rim);

    // Bottom bounce (simulates floor reflection)
    const bounce = new THREE.HemisphereLight(0x222244, 0x665544, 0.15);
    scene.add(bounce);

    // ── Floor ──
    const grid = new THREE.GridHelper(8, 24, 0x333355, 0x252540);
    grid.position.y = -1.5;
    scene.add(grid);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.ShadowMaterial({ opacity: 0.25 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.5;
    floor.receiveShadow = true;
    scene.add(floor);

    // ── Materials ──
    const matBase = new THREE.MeshStandardMaterial({
      color: GREY, roughness: 0.55, metalness: 0.05, flatShading: false,
    });
    const matHead = new THREE.MeshStandardMaterial({
      color: HEAD_GREY, roughness: 0.5, metalness: 0.03,
    });
    const matActiveArm = new THREE.MeshStandardMaterial({
      color: GREY, roughness: 0.45, metalness: 0.08,
      emissive: 0x000000, emissiveIntensity: 0.15,
    });
    matsRef.current = { base: matBase, head: matHead, activeArm: matActiveArm };

    const pickMat = (cat) => {
      if (cat === activeArm) return matActiveArm;
      if (cat === 'head') return matHead;
      return matBase;
    };

    // ── Build body segments (organic limb shapes) ──
    const segs = BODY_SEGMENTS.map(s => {
      const geo = createLimbGeometry(s.rTop, s.rBot, s.segs);
      const m = new THREE.Mesh(geo, pickMat(s.cat));
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      return { mesh: m, from: s.from, to: s.to, cat: s.cat };
    });
    segRef.current = segs;

    // ── Build joints (smooth spheres) ──
    const jnts = JOINTS.map(j => {
      const geo = new THREE.SphereGeometry(j.r, 20, 14);
      const m = new THREE.Mesh(geo, pickMat(j.cat));
      m.castShadow = true;
      scene.add(m);
      return { mesh: m, at: j.at, cat: j.cat };
    });
    jntRef.current = jnts;

    // ── Head (ellipsoid) ──
    const headGeo = createHeadGeometry();
    const headMesh = new THREE.Mesh(headGeo, matHead);
    headMesh.castShadow = true;
    scene.add(headMesh);
    headRef.current = headMesh;

    // ── Angle label sprite ──
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 160;
    labelCanvas.height = 80;
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false })
    );
    sprite.scale.set(0.32, 0.16, 1);
    scene.add(sprite);
    angleLabelRef.current = {
      sprite,
      canvas: labelCanvas,
      ctx: labelCanvas.getContext('2d'),
      texture: labelTexture,
    };

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

    // Initial pose
    applyPoseToScene(0);

    return () => {
      removeEventListener('resize', onResize);
      cancelAnimationFrame(rafRef.current);
      renderer.dispose();
      controls.dispose();
      matBase.dispose();
      matHead.dispose();
      matActiveArm.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [frameLandmarks, activeSide]);

  // ── Apply pose for a given frame index ──
  const applyPoseToScene = useCallback((idx) => {
    if (!frameLandmarks?.[idx]) return;
    const lm = frameLandmarks[idx].landmarks;
    const t = frameLandmarks[idx].timestamp;
    const data = landmarksToWorld(lm);

    // Update segments
    segRef.current.forEach(s => {
      const a = getPoint(data, s.from), b = getPoint(data, s.to);
      if (a && b) orientLimb(s.mesh, a, b);
    });

    // Update joints
    jntRef.current.forEach(j => {
      const p = getPoint(data, j.at);
      if (p) j.mesh.position.copy(p);
    });

    // Update head position
    if (headRef.current && data.HEAD_CENTER) {
      headRef.current.position.copy(data.HEAD_CENTER);
    }

    // Color active arm based on rep score
    const rep = getRepAtTime(t);
    const mats = matsRef.current;
    if (rep && getRepScore) {
      const score = getRepScore(rep.repNumber);
      const color = scoreToColor(score);
      mats.activeArm.color.setHex(color);
      mats.activeArm.emissive.setHex(color);
    } else {
      mats.activeArm.color.setHex(GREY);
      mats.activeArm.emissive.setHex(0x000000);
    }

    // Update angle label near elbow
    const elbowIdx = activeSide === 'left' ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW;
    const shoulderIdx = activeSide === 'left' ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;
    const wristIdx = activeSide === 'left' ? LM.LEFT_WRIST : LM.RIGHT_WRIST;

    if (lm[elbowIdx] && lm[shoulderIdx] && lm[wristIdx] && angleLabelRef.current) {
      const sh = lm[shoulderIdx], elb = lm[elbowIdx], wr = lm[wristIdx];
      const ab = { x: sh.x - elb.x, y: sh.y - elb.y, z: (sh.z || 0) - (elb.z || 0) };
      const cb = { x: wr.x - elb.x, y: wr.y - elb.y, z: (wr.z || 0) - (elb.z || 0) };
      const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
      const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2 + ab.z ** 2);
      const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2 + cb.z ** 2);
      const cosine = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
      const angleDeg = Math.round(Math.acos(cosine) * (180 / Math.PI));

      const { sprite, canvas, ctx, texture } = angleLabelRef.current;
      ctx.clearRect(0, 0, 160, 80);

      const repScore = rep && getRepScore ? getRepScore(rep.repNumber) : 0;
      const bgColor = scoreToCSS(repScore);

      // Rounded rectangle background
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.roundRect(4, 4, 152, 72, 16);
      ctx.fill();

      // White text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${angleDeg}\u00B0`, 80, 40);
      texture.needsUpdate = true;

      const elbowWorld = getPoint(data, elbowIdx);
      if (elbowWorld) {
        sprite.position.copy(elbowWorld);
        sprite.position.x += (activeSide === 'left' ? -0.2 : 0.2);
        sprite.position.y += 0.12;
      }
    }
  }, [frameLandmarks, activeSide, getRepAtTime, getRepScore]);

  // ── Sync from external currentTime (from the video) ──
  useEffect(() => {
    if (currentTime == null || !frameLandmarks?.length) return;
    let bestIdx = 0, bestDist = Infinity;
    for (let i = 0; i < frameLandmarks.length; i++) {
      const d = Math.abs(frameLandmarks[i].timestamp - currentTime);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (bestIdx !== frameIdxRef.current) {
      frameIdxRef.current = bestIdx;
      applyPoseToScene(bestIdx);
    }
  }, [currentTime, frameLandmarks, applyPoseToScene]);

  // Camera presets
  const setView = (v) => {
    if (!sceneRef.current) return;
    const { camera: c, controls: ct } = sceneRef.current;
    const views = {
      front: [0, 0.2, 3.8],
      side: [3.8, 0.2, 0],
      top: [0, 4.5, 0.01],
      angle: [2.5, 1.2, 2.8],
      back: [0, 0.2, -3.8],
    };
    c.position.set(...(views[v] || views.front));
    ct.target.set(0, 0, 0);
    ct.update();
  };

  // Current rep info
  const currentT = currentTime ?? 0;
  const currentRep = getRepAtTime(currentT);
  const currentScore = currentRep && getRepScore ? getRepScore(currentRep.repNumber) : null;
  const scoreLabelText = currentScore != null
    ? (currentScore >= 3 ? 'Excelente' : currentScore >= 2 ? 'Aceptable' : 'Mejorable')
    : null;
  const scoreColorHex = currentScore != null ? scoreToCSS(currentScore) : null;

  if (!total) return <p className="text-ink/40 text-center py-12">Sin datos de landmarks</p>;

  return (
    <div className="space-y-3">
      {/* 3D Viewport */}
      <div className="relative">
        <div
          ref={containerRef}
          className="w-full bg-ink rounded-2xl overflow-hidden"
          style={{ height: '450px', touchAction: 'none' }}
        />

        {/* Status overlay */}
        {currentRep && (
          <div
            className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ backgroundColor: scoreColorHex + '30', backdropFilter: 'blur(8px)' }}
          >
            <span className="font-display font-bold text-white text-base">Rep {currentRep.repNumber}</span>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ color: scoreColorHex, backgroundColor: scoreColorHex + '40' }}
            >
              {scoreLabelText}
            </span>
          </div>
        )}

        {/* Camera presets */}
        <div className="absolute top-3 right-3 flex gap-1">
          {[
            { id: 'front', label: 'Frontal' },
            { id: 'side', label: 'Lateral' },
            { id: 'angle', label: '3/4' },
            { id: 'back', label: 'Espalda' },
          ].map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className="text-[10px] font-medium text-white/60 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded-lg transition-colors"
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#C0B8B0' }} />
          <span className="text-[10px] text-ink/40">Cuerpo</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#16C79A' }} />
          <span className="text-[10px] text-ink/40">Bien</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#F5A623' }} />
          <span className="text-[10px] text-ink/40">OK</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#E94560' }} />
          <span className="text-[10px] text-ink/40">Corregir</span>
        </div>
        <span className="text-[9px] text-ink/25 ml-auto">Arrastra para rotar</span>
      </div>
    </div>
  );
}
