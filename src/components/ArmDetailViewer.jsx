import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ─── Landmark indices ───
const LM = {
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
};

// ─── Stress color ramp: blue → cyan → green → yellow → red ───
// t ∈ [0, 1] where 0 = no stress, 1 = max stress
function stressColor(t) {
  t = Math.max(0, Math.min(1, t));
  // 5-stop gradient matching FEA tools (COMSOL/ANSYS jet colormap)
  const stops = [
    { t: 0.0, r: 0.05, g: 0.15, b: 0.60 },  // deep blue
    { t: 0.25, r: 0.0, g: 0.55, b: 0.85 },   // cyan-blue
    { t: 0.45, r: 0.1, g: 0.78, b: 0.35 },   // green
    { t: 0.65, r: 0.90, g: 0.85, b: 0.10 },  // yellow
    { t: 0.85, r: 0.95, g: 0.45, b: 0.05 },  // orange
    { t: 1.0, r: 0.85, g: 0.08, b: 0.08 },   // red
  ];

  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].t && t <= stops[i + 1].t) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const f = hi.t === lo.t ? 0 : (t - lo.t) / (hi.t - lo.t);
  return {
    r: lo.r + (hi.r - lo.r) * f,
    g: lo.g + (hi.g - lo.g) * f,
    b: lo.b + (hi.b - lo.b) * f,
  };
}

// ─── Build anatomical arm mesh ───
// Creates a tube-like geometry with cross-section profiles that vary
// along the arm to simulate muscle anatomy:
//   shoulder cap → deltoid bulge → bicep belly → elbow → forearm → wrist
// Returns { geometry, wireGeometry } with vertex colors pre-allocated
function buildArmGeometry() {
  const lengthSegs = 64;    // subdivisions along arm length
  const radialSegs = 24;    // subdivisions around circumference

  // Anatomical cross-section radius profile along normalized length [0=shoulder, 1=wrist]
  // Each entry: { t, rx, ry } where rx=lateral radius, ry=anterior/posterior radius
  const profile = [
    { t: 0.00, rx: 0.065, ry: 0.060 },  // shoulder cap
    { t: 0.05, rx: 0.072, ry: 0.068 },  // deltoid insertion
    { t: 0.12, rx: 0.075, ry: 0.072 },  // deltoid peak
    { t: 0.22, rx: 0.065, ry: 0.070 },  // upper arm
    { t: 0.32, rx: 0.060, ry: 0.075 },  // bicep belly (thicker anterior)
    { t: 0.40, rx: 0.058, ry: 0.072 },  // mid bicep
    { t: 0.48, rx: 0.050, ry: 0.055 },  // approaching elbow
    { t: 0.50, rx: 0.048, ry: 0.048 },  // elbow joint
    { t: 0.52, rx: 0.046, ry: 0.050 },  // just past elbow
    { t: 0.58, rx: 0.048, ry: 0.052 },  // brachioradialis bulge
    { t: 0.65, rx: 0.044, ry: 0.046 },  // mid forearm
    { t: 0.78, rx: 0.038, ry: 0.038 },  // lower forearm
    { t: 0.90, rx: 0.030, ry: 0.028 },  // wrist tendons
    { t: 1.00, rx: 0.025, ry: 0.024 },  // wrist
  ];

  function interpProfile(t) {
    t = Math.max(0, Math.min(1, t));
    for (let i = 0; i < profile.length - 1; i++) {
      if (t >= profile[i].t && t <= profile[i + 1].t) {
        const f = (t - profile[i].t) / (profile[i + 1].t - profile[i].t);
        // Smooth interpolation (smoothstep)
        const s = f * f * (3 - 2 * f);
        return {
          rx: profile[i].rx + (profile[i + 1].rx - profile[i].rx) * s,
          ry: profile[i].ry + (profile[i + 1].ry - profile[i].ry) * s,
        };
      }
    }
    return { rx: profile[profile.length - 1].rx, ry: profile[profile.length - 1].ry };
  }

  // Build vertices: arm along Y axis, height = 1 (will be scaled at render time)
  const vertCount = (lengthSegs + 1) * (radialSegs + 1);
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);
  // Store which muscle zone each vertex belongs to (for targeted coloring)
  const zoneData = new Float32Array(vertCount); // 0=shoulder, 0.5=elbow, 1=wrist

  let vi = 0;
  for (let j = 0; j <= lengthSegs; j++) {
    const tLen = j / lengthSegs;
    const y = 0.5 - tLen; // top=0.5 (shoulder), bottom=-0.5 (wrist)
    const { rx, ry } = interpProfile(tLen);

    for (let i = 0; i <= radialSegs; i++) {
      const theta = (i / radialSegs) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      // Elliptical cross-section
      const x = cos * rx;
      const z = sin * ry;

      positions[vi * 3] = x;
      positions[vi * 3 + 1] = y;
      positions[vi * 3 + 2] = z;

      // Normal (approximation for ellipse)
      const nx = cos / rx;
      const nz = sin / ry;
      const nLen = Math.sqrt(nx * nx + nz * nz);
      normals[vi * 3] = nx / nLen;
      normals[vi * 3 + 1] = 0;
      normals[vi * 3 + 2] = nz / nLen;

      // Default: neutral grey
      colors[vi * 3] = 0.7;
      colors[vi * 3 + 1] = 0.7;
      colors[vi * 3 + 2] = 0.7;

      zoneData[vi] = tLen;
      vi++;
    }
  }

  // Build indices
  const indices = [];
  for (let j = 0; j < lengthSegs; j++) {
    for (let i = 0; i < radialSegs; i++) {
      const a = j * (radialSegs + 1) + i;
      const b = a + 1;
      const c = a + (radialSegs + 1);
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);

  // Wireframe geometry (same verts, different material)
  const wireGeometry = new THREE.WireframeGeometry(geometry);

  return { geometry, wireGeometry, zoneData, radialSegs, lengthSegs };
}

// ─── Compute stress distribution on the arm ───
// Maps biomechanical metrics to per-vertex stress values
// elbowAngle: current angle in degrees (180=extended, 30=fully flexed)
// velocity: angular velocity (higher = more dynamic load)
// repScore: 0-3 overall rep quality
function computeStress(zoneData, elbowAngle, velocity, repScore, radialSegs, lengthSegs) {
  const stressValues = new Float32Array(zoneData.length);
  const normalizedAngle = 1 - Math.min(1, Math.max(0, (elbowAngle - 30) / 120));
  // 0 = arm extended (low stress), 1 = fully flexed (high stress on bicep)

  const normalizedVelocity = Math.min(1, velocity / 300);
  const qualityPenalty = repScore != null ? (1 - repScore / 3) * 0.3 : 0;

  for (let j = 0; j <= lengthSegs; j++) {
    const tLen = j / lengthSegs; // 0=shoulder, 1=wrist

    for (let i = 0; i <= radialSegs; i++) {
      const vi = j * (radialSegs + 1) + i;
      const theta = (i / radialSegs) * Math.PI * 2;

      // Anterior side (bicep) = theta near PI (front of arm)
      // Posterior side (tricep) = theta near 0 or 2*PI (back of arm)
      const anteriorFactor = (1 + Math.cos(theta - Math.PI)) / 2; // 1 at front, 0 at back
      const posteriorFactor = (1 + Math.cos(theta)) / 2;           // 1 at back, 0 at front

      let stress = 0;

      // === Bicep stress zone (tLen 0.20–0.48, anterior) ===
      // Peak stress during flexion (concentric) on the bicep belly
      if (tLen >= 0.18 && tLen <= 0.50) {
        const zonePeak = 1 - Math.abs(tLen - 0.34) / 0.16; // peaks at ~0.34 (bicep belly)
        const clampedPeak = Math.max(0, Math.min(1, zonePeak));
        stress += clampedPeak * anteriorFactor * normalizedAngle * 0.8;
      }

      // === Tricep stress zone (tLen 0.20–0.48, posterior) ===
      // Stress during eccentric (extension) phase
      if (tLen >= 0.20 && tLen <= 0.48) {
        const zonePeak = 1 - Math.abs(tLen - 0.32) / 0.14;
        const clampedPeak = Math.max(0, Math.min(1, zonePeak));
        stress += clampedPeak * posteriorFactor * (1 - normalizedAngle) * 0.5;
      }

      // === Elbow joint stress (tLen 0.46–0.56) ===
      // Always some stress at the joint, increases with angle and velocity
      if (tLen >= 0.44 && tLen <= 0.58) {
        const jointPeak = 1 - Math.abs(tLen - 0.50) / 0.07;
        const clampedJoint = Math.max(0, Math.min(1, jointPeak));
        stress += clampedJoint * (0.3 + normalizedVelocity * 0.4 + qualityPenalty);
      }

      // === Brachioradialis (tLen 0.55–0.70, lateral) ===
      if (tLen >= 0.53 && tLen <= 0.72) {
        const lateralFactor = (1 + Math.cos(theta - Math.PI * 0.5)) / 2;
        const zonePeak = 1 - Math.abs(tLen - 0.60) / 0.10;
        const clamped = Math.max(0, Math.min(1, zonePeak));
        stress += clamped * lateralFactor * normalizedAngle * 0.4;
      }

      // === Deltoid / shoulder cap (tLen 0–0.15) ===
      if (tLen <= 0.18) {
        const shoulderPeak = 1 - tLen / 0.18;
        stress += shoulderPeak * 0.25 * (normalizedAngle * 0.5 + qualityPenalty);
      }

      // === Wrist tendon stress (tLen 0.85–1.0) ===
      if (tLen >= 0.83) {
        const wristPeak = (tLen - 0.83) / 0.17;
        stress += wristPeak * 0.2 * (normalizedAngle * 0.3 + normalizedVelocity * 0.3);
      }

      // Dynamic velocity overlay — everywhere, but mild
      stress += normalizedVelocity * 0.1;

      stressValues[vi] = Math.min(1, Math.max(0, stress));
    }
  }

  return stressValues;
}

// ─── Update vertex colors from stress values ───
function applyStressColors(colorAttr, stressValues) {
  for (let i = 0; i < stressValues.length; i++) {
    const c = stressColor(stressValues[i]);
    colorAttr.setXYZ(i, c.r, c.g, c.b);
  }
  colorAttr.needsUpdate = true;
}

// ─── Orient mesh between two 3D points ───
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();

function orientBetween(mesh, pA, pB) {
  _dir.subVectors(pB, pA);
  const len = _dir.length();
  if (len < 0.001) return;
  mesh.position.lerpVectors(pA, pB, 0.5);
  mesh.scale.set(1, len, 1);
  _dir.normalize();
  _quat.setFromUnitVectors(_up, _dir);
  mesh.quaternion.copy(_quat);
}

// ─── Landmark to world coords ───
function lmToWorld(l, scale = 2.5) {
  return new THREE.Vector3(
    (l.x - 0.5) * scale,
    -(l.y - 0.5) * scale,
    -(l.z || 0) * scale * 0.8
  );
}

function computeAngle(sh, el, wr) {
  const ab = { x: sh.x - el.x, y: sh.y - el.y, z: (sh.z || 0) - (el.z || 0) };
  const cb = { x: wr.x - el.x, y: wr.y - el.y, z: (wr.z || 0) - (el.z || 0) };
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2 + ab.z ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2 + cb.z ** 2);
  if (magAB === 0 || magCB === 0) return 180;
  const cosine = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return Math.acos(cosine) * (180 / Math.PI);
}

// ─── Color scale bar (canvas texture) ───
function createColorScaleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 60;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(0, 0, 60, 300, 8);
  ctx.fill();

  // Gradient bar
  const barX = 10, barY = 30, barW = 16, barH = 230;
  for (let y = 0; y < barH; y++) {
    const t = 1 - y / barH;
    const c = stressColor(t);
    ctx.fillStyle = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
    ctx.fillRect(barX, barY + y, barW, 1);
  }

  // Labels
  ctx.fillStyle = '#fff';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Max', barX + barW + 4, barY + 8);
  ctx.fillText('Min', barX + barW + 4, barY + barH - 2);

  // Title
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Stress', 30, 18);

  // Units
  ctx.font = '9px sans-serif';
  ctx.fillText('N/mm\u00B2', 30, 288);

  return canvas;
}

// ═══════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════
export default function ArmDetailViewer({
  frameLandmarks,
  activeSide = 'right',
  repMetrics,
  currentTime,
  getRepScore,
  isPaused,
  onPlay,
  onPause,
  onSeek,
}) {
  const containerRef = useRef(null);
  const stateRef = useRef(null);
  const lastIdxRef = useRef(-1);
  const prevAngleRef = useRef(180);

  const getRepAtTime = useCallback((t) => {
    if (!repMetrics) return null;
    return repMetrics.find(r => t >= r.startTime && t <= r.endTime) || null;
  }, [repMetrics]);

  // ── Initialize scene ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !frameLandmarks?.length) return;
    const W = el.clientWidth, H = el.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0d1a);

    const camera = new THREE.PerspectiveCamera(35, W / H, 0.01, 50);
    camera.position.set(0.15, 0, 1.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 0.3;
    controls.maxDistance = 3;
    controls.target.set(0, 0, 0);

    // Lighting — soft studio for FEA view
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(2, 3, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8899cc, 0.3);
    fill.position.set(-2, 1, -1);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.2);
    rim.position.set(0, -1, -2);
    scene.add(rim);

    // ── Build upper arm mesh ──
    const { geometry: upperGeo, wireGeometry: upperWireGeo, zoneData: upperZones,
            radialSegs, lengthSegs } = buildArmGeometry();

    const armMat = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: 40,
      specular: 0x222222,
      side: THREE.DoubleSide,
    });
    const armMesh = new THREE.Mesh(upperGeo, armMat);
    scene.add(armMesh);

    // Wireframe overlay (FEA mesh lines)
    const wireMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.06,
      depthTest: true,
    });
    const wireMesh = new THREE.LineSegments(upperWireGeo, wireMat);
    scene.add(wireMesh);

    // ── Joint markers (spheres at shoulder, elbow, wrist) ──
    const jointGeo = new THREE.SphereGeometry(0.012, 16, 12);
    const jointMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
    const shoulderJoint = new THREE.Mesh(jointGeo, jointMat);
    const elbowJoint = new THREE.Mesh(jointGeo, jointMat);
    const wristJoint = new THREE.Mesh(jointGeo, jointMat);
    scene.add(shoulderJoint, elbowJoint, wristJoint);

    // ── Angle label sprite ──
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 200;
    labelCanvas.height = 100;
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false })
    );
    labelSprite.scale.set(0.18, 0.09, 1);
    scene.add(labelSprite);

    // ── Color scale bar sprite ──
    const scaleCanvas = createColorScaleTexture();
    const scaleTexture = new THREE.CanvasTexture(scaleCanvas);
    const scaleSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: scaleTexture, transparent: true, depthTest: false })
    );
    scaleSprite.scale.set(0.12, 0.6, 1);
    scaleSprite.position.set(0.55, 0, 0);
    scene.add(scaleSprite);

    // Store state
    stateRef.current = {
      scene, camera, renderer, controls,
      armMesh, wireMesh, upperZones, radialSegs, lengthSegs,
      shoulderJoint, elbowJoint, wristJoint,
      label: { sprite: labelSprite, canvas: labelCanvas, ctx: labelCanvas.getContext('2d'), texture: labelTexture },
    };

    // Render loop
    let rafId;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      // Keep scale bar in screen space
      scaleSprite.position.set(0.55, 0, 0);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    addEventListener('resize', onResize);

    return () => {
      removeEventListener('resize', onResize);
      cancelAnimationFrame(rafId);
      renderer.dispose();
      controls.dispose();
      armMat.dispose();
      wireMat.dispose();
      stateRef.current = null;
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [frameLandmarks, activeSide]);

  // ── Apply pose ──
  const applyPose = useCallback((idx) => {
    const st = stateRef.current;
    if (!st || !frameLandmarks?.[idx]) return;

    const lm = frameLandmarks[idx].landmarks;
    const t = frameLandmarks[idx].timestamp;

    const shIdx = activeSide === 'left' ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;
    const elIdx = activeSide === 'left' ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW;
    const wrIdx = activeSide === 'left' ? LM.LEFT_WRIST : LM.RIGHT_WRIST;

    if (!lm[shIdx] || !lm[elIdx] || !lm[wrIdx]) return;

    const shWorld = lmToWorld(lm[shIdx]);
    const elWorld = lmToWorld(lm[elIdx]);
    const wrWorld = lmToWorld(lm[wrIdx]);

    // Center the arm in the viewport: translate so elbow is near origin
    const center = elWorld.clone();
    shWorld.sub(center);
    elWorld.sub(center);
    wrWorld.sub(center);

    // Position joint markers
    st.shoulderJoint.position.copy(shWorld);
    st.elbowJoint.position.copy(elWorld);
    st.wristJoint.position.copy(wrWorld);

    // Upper arm: shoulder → elbow
    // We orient the mesh along the full arm, using a compound approach:
    // Build a path from shoulder through elbow to wrist
    // For now, orient the mesh from shoulder to wrist, with elbow bend encoded in stress
    const fullDir = new THREE.Vector3().subVectors(wrWorld, shWorld);
    const fullLen = fullDir.length();
    if (fullLen < 0.001) return;

    st.armMesh.position.lerpVectors(shWorld, wrWorld, 0.5);
    st.armMesh.scale.set(1, fullLen, 1);
    fullDir.normalize();
    _quat.setFromUnitVectors(_up, fullDir);
    st.armMesh.quaternion.copy(_quat);

    // Wireframe follows the same transform
    st.wireMesh.position.copy(st.armMesh.position);
    st.wireMesh.scale.copy(st.armMesh.scale);
    st.wireMesh.quaternion.copy(st.armMesh.quaternion);

    // Compute elbow angle
    const angle = computeAngle(lm[shIdx], lm[elIdx], lm[wrIdx]);

    // Compute angular velocity (degrees per frame)
    const dt = idx > 0 ? (frameLandmarks[idx].timestamp - frameLandmarks[idx - 1].timestamp) : 0.04;
    const velocity = dt > 0 ? Math.abs(angle - prevAngleRef.current) / dt : 0;
    prevAngleRef.current = angle;

    // Get rep score
    const rep = getRepAtTime(t);
    const repScore = rep && getRepScore ? getRepScore(rep.repNumber) : null;

    // Compute and apply stress
    const stressValues = computeStress(
      st.upperZones, angle, velocity, repScore,
      st.radialSegs, st.lengthSegs
    );
    applyStressColors(st.armMesh.geometry.attributes.color, stressValues);

    // Update angle label
    const { sprite, ctx, texture } = st.label;
    ctx.clearRect(0, 0, 200, 100);

    // Background pill
    const scoreCSS = repScore != null
      ? (repScore >= 3 ? '#16C79A' : repScore >= 2 ? '#F5A623' : '#E94560')
      : '#888';
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.roundRect(4, 4, 192, 92, 16);
    ctx.fill();

    // Angle text
    ctx.fillStyle = scoreCSS;
    ctx.font = 'bold 46px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(angle)}\u00B0`, 100, 42);

    // Sub-label
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '16px sans-serif';
    ctx.fillText(rep ? `Rep ${rep.repNumber}` : 'Entre reps', 100, 78);
    texture.needsUpdate = true;

    // Position label near elbow
    sprite.position.copy(elWorld);
    sprite.position.x += (activeSide === 'left' ? -0.15 : 0.15);
    sprite.position.y -= 0.08;

  }, [frameLandmarks, activeSide, getRepAtTime, getRepScore]);

  // ── Sync to video time ──
  useEffect(() => {
    if (currentTime == null || !frameLandmarks?.length || !stateRef.current) return;
    let bestIdx = 0, bestDist = Infinity;
    for (let i = 0; i < frameLandmarks.length; i++) {
      const d = Math.abs(frameLandmarks[i].timestamp - currentTime);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (bestIdx !== lastIdxRef.current) {
      lastIdxRef.current = bestIdx;
      applyPose(bestIdx);
    }
  }, [currentTime, frameLandmarks, applyPose]);

  // Initial pose
  useEffect(() => {
    if (stateRef.current && frameLandmarks?.length) {
      applyPose(0);
    }
  }, [stateRef.current != null, frameLandmarks, applyPose]);

  // Camera presets
  const setView = (v) => {
    const st = stateRef.current;
    if (!st) return;
    const views = {
      front: [0.15, 0, 1.2],
      side: [1.2, 0, 0],
      top: [0, 1.2, 0.01],
      back: [-0.15, 0, -1.2],
    };
    st.camera.position.set(...(views[v] || views.front));
    st.controls.target.set(0, 0, 0);
    st.controls.update();
  };

  const currentRep = getRepAtTime(currentTime ?? 0);
  const currentScore = currentRep && getRepScore ? getRepScore(currentRep.repNumber) : null;
  const total = frameLandmarks?.length || 0;
  const duration = total > 0 ? frameLandmarks[total - 1].timestamp : 0;

  if (!total) return null;

  return (
    <div className="space-y-3">
      {/* 3D Viewport */}
      <div className="relative">
        <div
          ref={containerRef}
          className="w-full rounded-2xl overflow-hidden"
          style={{ height: '420px', touchAction: 'none', backgroundColor: '#0d0d1a' }}
        />

        {/* Status */}
        {currentRep && (
          <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
            <span className="font-display font-bold text-white text-base">Rep {currentRep.repNumber}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{
                color: currentScore >= 3 ? '#16C79A' : currentScore >= 2 ? '#F5A623' : '#E94560',
                backgroundColor: (currentScore >= 3 ? '#16C79A' : currentScore >= 2 ? '#F5A623' : '#E94560') + '40',
              }}>
              {currentScore >= 3 ? 'Excelente' : currentScore >= 2 ? 'Aceptable' : 'Mejorable'}
            </span>
          </div>
        )}

        {/* Camera presets */}
        <div className="absolute top-3 right-3 flex gap-1">
          {[
            { id: 'front', label: 'Frontal' },
            { id: 'side', label: 'Lateral' },
            { id: 'back', label: 'Posterior' },
          ].map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className="text-[10px] font-medium text-white/60 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded-lg transition-colors">
              {v.label}
            </button>
          ))}
        </div>

        {/* Muscle zone labels */}
        <div className="absolute bottom-3 left-3 space-y-1">
          {[
            { label: 'Deltoides', color: '#4488cc' },
            { label: 'Bíceps', color: '#cc4444' },
            { label: 'Braquiorradial', color: '#ccaa33' },
            { label: 'Art. Codo', color: '#cc6633' },
          ].map(z => (
            <div key={z.label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: z.color }} />
              <span className="text-[9px] text-white/50">{z.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Playback controls (synced with video) */}
      <div className="bg-white rounded-2xl p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => isPaused ? onPlay?.() : onPause?.()}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-ink text-white hover:bg-ink/80 transition-colors text-sm"
          >
            {isPaused ? '\u25B6' : '\u23F8'}
          </button>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.01}
            value={currentTime ?? 0}
            onChange={e => onSeek?.(+e.target.value)}
            className="flex-1 accent-accent"
          />
          <span className="font-mono text-[10px] text-ink/40 w-14 text-right">
            {(currentTime ?? 0).toFixed(1)}s
          </span>
        </div>

        {/* Rep jump buttons */}
        {repMetrics && (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-[10px] text-ink/30 mr-1">Reps:</span>
            {repMetrics.map(rep => {
              const score = getRepScore ? getRepScore(rep.repNumber) : 2;
              const color = score >= 3 ? '#16C79A' : score >= 2 ? '#F5A623' : '#E94560';
              const isActive = currentRep?.repNumber === rep.repNumber;
              return (
                <button key={rep.repNumber}
                  onClick={() => onSeek?.(rep.startTime)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white transition-all ${isActive ? 'ring-2 ring-ink scale-110' : 'hover:scale-110'}`}
                  style={{ backgroundColor: color }}>
                  {rep.repNumber}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
