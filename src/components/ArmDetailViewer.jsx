import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const LM = {
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
};

// ─── FEA jet colormap: blue → cyan → green → yellow → orange → red ───
function stressColor(t) {
  t = Math.max(0, Math.min(1, t));
  const stops = [
    { t: 0.00, r: 0.05, g: 0.15, b: 0.60 },
    { t: 0.25, r: 0.00, g: 0.55, b: 0.85 },
    { t: 0.45, r: 0.10, g: 0.78, b: 0.35 },
    { t: 0.65, r: 0.90, g: 0.85, b: 0.10 },
    { t: 0.85, r: 0.95, g: 0.45, b: 0.05 },
    { t: 1.00, r: 0.85, g: 0.08, b: 0.08 },
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].t && t <= stops[i + 1].t) { lo = stops[i]; hi = stops[i + 1]; break; }
  }
  const f = hi.t === lo.t ? 0 : (t - lo.t) / (hi.t - lo.t);
  return { r: lo.r + (hi.r - lo.r) * f, g: lo.g + (hi.g - lo.g) * f, b: lo.b + (hi.b - lo.b) * f };
}

// ─── Build a single limb segment with anatomical cross-section profile ───
// profile: array of { t, rx, ry } defining elliptical cross-sections along length
// The geometry is built along Y-axis with height=1, centered at origin.
function buildSegmentGeometry(profile, lengthSegs, radialSegs) {
  function interp(t) {
    t = Math.max(0, Math.min(1, t));
    for (let i = 0; i < profile.length - 1; i++) {
      if (t >= profile[i].t && t <= profile[i + 1].t) {
        const f = (t - profile[i].t) / (profile[i + 1].t - profile[i].t);
        const s = f * f * (3 - 2 * f); // smoothstep
        return {
          rx: profile[i].rx + (profile[i + 1].rx - profile[i].rx) * s,
          ry: profile[i].ry + (profile[i + 1].ry - profile[i].ry) * s,
        };
      }
    }
    return { rx: profile[profile.length - 1].rx, ry: profile[profile.length - 1].ry };
  }

  const vertCount = (lengthSegs + 1) * (radialSegs + 1);
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);
  const zones = new Float32Array(vertCount); // t along length [0,1]
  const thetas = new Float32Array(vertCount); // angle around circumference

  let vi = 0;
  for (let j = 0; j <= lengthSegs; j++) {
    const tLen = j / lengthSegs;
    const y = 0.5 - tLen; // top → bottom
    const { rx, ry } = interp(tLen);

    for (let i = 0; i <= radialSegs; i++) {
      const theta = (i / radialSegs) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      positions[vi * 3] = cos * rx;
      positions[vi * 3 + 1] = y;
      positions[vi * 3 + 2] = sin * ry;

      const nx = cos / (rx || 0.001);
      const nz = sin / (ry || 0.001);
      const nLen = Math.sqrt(nx * nx + nz * nz) || 1;
      normals[vi * 3] = nx / nLen;
      normals[vi * 3 + 1] = 0;
      normals[vi * 3 + 2] = nz / nLen;

      colors[vi * 3] = 0.12;
      colors[vi * 3 + 1] = 0.12;
      colors[vi * 3 + 2] = 0.35;

      zones[vi] = tLen;
      thetas[vi] = theta;
      vi++;
    }
  }

  const indices = [];
  for (let j = 0; j < lengthSegs; j++) {
    for (let i = 0; i < radialSegs; i++) {
      const a = j * (radialSegs + 1) + i;
      const b = a + 1;
      const c = a + (radialSegs + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals(); // better normals

  return { geometry: geo, zones, thetas, radialSegs, lengthSegs };
}

// ─── Upper arm profile (deltoid → bicep belly → elbow) ───
const UPPER_ARM_PROFILE = [
  { t: 0.00, rx: 0.048, ry: 0.044 },  // shoulder cap (deltoid top)
  { t: 0.08, rx: 0.058, ry: 0.054 },  // deltoid widens
  { t: 0.18, rx: 0.062, ry: 0.060 },  // deltoid peak
  { t: 0.28, rx: 0.055, ry: 0.058 },  // transition to bicep
  { t: 0.42, rx: 0.050, ry: 0.064 },  // bicep belly (anterior bulge, ry > rx)
  { t: 0.55, rx: 0.048, ry: 0.060 },  // mid bicep
  { t: 0.70, rx: 0.044, ry: 0.052 },  // tapering toward elbow
  { t: 0.85, rx: 0.040, ry: 0.044 },  // near elbow
  { t: 0.95, rx: 0.038, ry: 0.040 },  // elbow approach
  { t: 1.00, rx: 0.036, ry: 0.038 },  // elbow end
];

// ─── Forearm profile (elbow → brachioradialis → wrist) ───
const FOREARM_PROFILE = [
  { t: 0.00, rx: 0.038, ry: 0.040 },  // elbow start
  { t: 0.05, rx: 0.042, ry: 0.044 },  // just past elbow
  { t: 0.15, rx: 0.046, ry: 0.048 },  // brachioradialis bulge
  { t: 0.25, rx: 0.044, ry: 0.046 },  // peak forearm
  { t: 0.40, rx: 0.040, ry: 0.040 },  // mid forearm
  { t: 0.55, rx: 0.036, ry: 0.035 },  // tapering
  { t: 0.70, rx: 0.030, ry: 0.028 },  // lower forearm
  { t: 0.85, rx: 0.025, ry: 0.022 },  // approaching wrist
  { t: 0.95, rx: 0.022, ry: 0.020 },  // wrist tendons
  { t: 1.00, rx: 0.020, ry: 0.018 },  // wrist end
];

// ─── Compute stress for a segment ───
// segType: 'upper' or 'forearm'
function computeSegmentStress(zones, thetas, segType, elbowAngle, velocity, repScore) {
  const normalizedFlex = 1 - Math.min(1, Math.max(0, (elbowAngle - 30) / 120));
  const normVel = Math.min(1, velocity / 300);
  const penalty = repScore != null ? (1 - repScore / 3) * 0.25 : 0;
  const stressValues = new Float32Array(zones.length);

  for (let i = 0; i < zones.length; i++) {
    const tLen = zones[i];
    const theta = thetas[i];
    // Anterior = bicep side (theta near PI), Posterior = tricep (theta near 0/2PI)
    const anterior = (1 + Math.cos(theta - Math.PI)) / 2;
    const posterior = (1 + Math.cos(theta)) / 2;
    const lateral = (1 + Math.cos(theta - Math.PI * 0.5)) / 2;

    let stress = 0;

    if (segType === 'upper') {
      // Deltoid zone (0–0.25): moderate stress, increases with load
      if (tLen < 0.28) {
        const peak = 1 - tLen / 0.28;
        stress += peak * 0.3 * (normalizedFlex * 0.4 + penalty + normVel * 0.2);
      }
      // Bicep belly (0.30–0.70, anterior): main stress during flexion
      if (tLen > 0.25 && tLen < 0.75) {
        const peak = 1 - Math.abs(tLen - 0.48) / 0.25;
        stress += Math.max(0, peak) * anterior * normalizedFlex * 0.9;
      }
      // Tricep (0.25–0.65, posterior): stress during extension
      if (tLen > 0.22 && tLen < 0.68) {
        const peak = 1 - Math.abs(tLen - 0.42) / 0.22;
        stress += Math.max(0, peak) * posterior * (1 - normalizedFlex) * 0.55;
      }
      // Elbow approach (0.80–1.0): tendon stress
      if (tLen > 0.78) {
        const peak = (tLen - 0.78) / 0.22;
        stress += peak * (0.25 + normVel * 0.3 + penalty * 0.5);
      }
    } else {
      // Elbow region (0–0.15): joint stress
      if (tLen < 0.18) {
        const peak = 1 - tLen / 0.18;
        stress += peak * (0.35 + normVel * 0.35 + penalty * 0.6);
      }
      // Brachioradialis (0.08–0.35, lateral): forearm flexor
      if (tLen > 0.06 && tLen < 0.38) {
        const peak = 1 - Math.abs(tLen - 0.20) / 0.15;
        stress += Math.max(0, peak) * lateral * normalizedFlex * 0.5;
      }
      // Forearm extensors (0.10–0.40, posterior)
      if (tLen > 0.08 && tLen < 0.42) {
        const peak = 1 - Math.abs(tLen - 0.22) / 0.16;
        stress += Math.max(0, peak) * posterior * normalizedFlex * 0.35;
      }
      // Wrist tendons (0.80–1.0)
      if (tLen > 0.78) {
        const peak = (tLen - 0.78) / 0.22;
        stress += peak * 0.2 * (normalizedFlex * 0.4 + normVel * 0.3);
      }
    }

    // Baseline dynamic load
    stress += normVel * 0.05;
    stressValues[i] = Math.min(1, Math.max(0, stress));
  }
  return stressValues;
}

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

function lmToWorld(l, scale = 3.0) {
  return new THREE.Vector3(
    (l.x - 0.5) * scale,
    -(l.y - 0.5) * scale,
    -(l.z || 0) * scale * 0.5
  );
}

function computeAngle(sh, el, wr) {
  const ab = { x: sh.x - el.x, y: sh.y - el.y, z: (sh.z || 0) - (el.z || 0) };
  const cb = { x: wr.x - el.x, y: wr.y - el.y, z: (wr.z || 0) - (el.z || 0) };
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2 + ab.z ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2 + cb.z ** 2);
  if (magAB === 0 || magCB === 0) return 180;
  return Math.acos(Math.max(-1, Math.min(1, dot / (magAB * magCB)))) * (180 / Math.PI);
}

// ─── Color scale bar texture ───
function createColorScaleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 60;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(0, 0, 60, 300, 8);
  ctx.fill();
  const barX = 10, barY = 30, barW = 16, barH = 230;
  for (let y = 0; y < barH; y++) {
    const c = stressColor(1 - y / barH);
    ctx.fillStyle = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
    ctx.fillRect(barX, barY + y, barW, 1);
  }
  ctx.fillStyle = '#fff';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Alto', barX + barW + 4, barY + 8);
  ctx.fillText('Bajo', barX + barW + 4, barY + barH - 2);
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Esfuerzo', 30, 18);
  return canvas;
}

// ═══════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════
export default function ArmDetailViewer({
  frameLandmarks, activeSide = 'right', repMetrics,
  currentTime, getRepScore, isPaused, onPlay, onPause, onSeek,
  currentRepData,
}) {
  const containerRef = useRef(null);
  const stateRef = useRef(null);
  const lastIdxRef = useRef(-1);
  const prevAngleRef = useRef(180);

  const getRepAtTime = useCallback((t) => {
    if (!repMetrics) return null;
    return repMetrics.find(r => t >= r.startTime && t <= r.endTime) || null;
  }, [repMetrics]);

  // ── Init scene ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !frameLandmarks?.length) return;
    const W = el.clientWidth, H = el.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0d1a);

    const camera = new THREE.PerspectiveCamera(35, W / H, 0.01, 50);
    camera.position.set(0.3, 0.1, 1.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 0.5;
    controls.maxDistance = 4;
    controls.target.set(0, 0, 0);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(2, 3, 3);
    scene.add(key);
    scene.add(new THREE.DirectionalLight(0x8899cc, 0.3).translateX(-3).translateY(1));
    scene.add(new THREE.DirectionalLight(0xffffff, 0.2).translateZ(-3).translateY(-1));

    // ── Build TWO separate segment meshes ──
    const RADIAL = 24, UPPER_LEN = 40, FORE_LEN = 36;
    const upper = buildSegmentGeometry(UPPER_ARM_PROFILE, UPPER_LEN, RADIAL);
    const fore = buildSegmentGeometry(FOREARM_PROFILE, FORE_LEN, RADIAL);

    const armMat = new THREE.MeshPhongMaterial({
      vertexColors: true, shininess: 50, specular: 0x333333, side: THREE.DoubleSide,
    });

    const upperMesh = new THREE.Mesh(upper.geometry, armMat);
    const foreMesh = new THREE.Mesh(fore.geometry, armMat);
    scene.add(upperMesh, foreMesh);

    // Wireframe overlays
    const wireMat = new THREE.LineBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.07,
    });
    const upperWire = new THREE.LineSegments(new THREE.WireframeGeometry(upper.geometry), wireMat);
    const foreWire = new THREE.LineSegments(new THREE.WireframeGeometry(fore.geometry), wireMat);
    scene.add(upperWire, foreWire);

    // Joint spheres (shoulder, elbow, wrist)
    const jMat = new THREE.MeshStandardMaterial({ color: 0xE94560, roughness: 0.35, metalness: 0.1 });
    const shoulderSph = new THREE.Mesh(new THREE.SphereGeometry(0.048, 20, 14), jMat);
    const elbowSph = new THREE.Mesh(new THREE.SphereGeometry(0.042, 20, 14), jMat);
    const wristSph = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), jMat);
    scene.add(shoulderSph, elbowSph, wristSph);

    // Shoulder cap (hemisphere for deltoid cap look)
    const capGeo = new THREE.SphereGeometry(0.050, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const capMesh = new THREE.Mesh(capGeo, armMat.clone());
    capMesh.material.vertexColors = false;
    capMesh.material.color.set(0x1a2a55);
    scene.add(capMesh);

    // Angle label
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 220;
    labelCanvas.height = 110;
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false })
    );
    labelSprite.scale.set(0.22, 0.11, 1);
    scene.add(labelSprite);

    // Color scale bar
    const scaleTexture = new THREE.CanvasTexture(createColorScaleTexture());
    const scaleSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: scaleTexture, transparent: true, depthTest: false })
    );
    scaleSprite.scale.set(0.12, 0.55, 1);
    scene.add(scaleSprite);

    stateRef.current = {
      scene, camera, renderer, controls,
      upperMesh, foreMesh, upperWire, foreWire,
      upper, fore,
      shoulderSph, elbowSph, wristSph, capMesh,
      label: { sprite: labelSprite, canvas: labelCanvas, ctx: labelCanvas.getContext('2d'), texture: labelTexture },
      scaleSprite,
    };

    let rafId;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      // Keep scale bar at fixed screen position
      if (stateRef.current) {
        const cam = stateRef.current.camera;
        const right = new THREE.Vector3(0.65, -0.1, 0).applyQuaternion(cam.quaternion).add(cam.position);
        scaleSprite.position.copy(right);
      }
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

    const shW = lmToWorld(lm[shIdx]);
    const elW = lmToWorld(lm[elIdx]);
    const wrW = lmToWorld(lm[wrIdx]);

    // Center on elbow
    const center = elW.clone();
    shW.sub(center);
    elW.set(0, 0, 0);
    wrW.sub(center);

    // Orient upper arm: shoulder → elbow
    orientBetween(st.upperMesh, shW, elW);
    orientBetween(st.upperWire, shW, elW);

    // Orient forearm: elbow → wrist
    orientBetween(st.foreMesh, elW, wrW);
    orientBetween(st.foreWire, elW, wrW);

    // Joint positions
    st.shoulderSph.position.copy(shW);
    st.elbowSph.position.copy(elW);
    st.wristSph.position.copy(wrW);

    // Shoulder cap on top of shoulder
    st.capMesh.position.copy(shW);
    const upperDir = new THREE.Vector3().subVectors(shW, elW).normalize();
    const capQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), upperDir);
    st.capMesh.quaternion.copy(capQuat);

    // Angle
    const angle = computeAngle(lm[shIdx], lm[elIdx], lm[wrIdx]);
    const dt = idx > 0 ? (frameLandmarks[idx].timestamp - frameLandmarks[idx - 1].timestamp) : 0.04;
    const velocity = dt > 0 ? Math.abs(angle - prevAngleRef.current) / dt : 0;
    prevAngleRef.current = angle;

    const rep = getRepAtTime(t);
    const repScore = rep && getRepScore ? getRepScore(rep.repNumber) : null;

    // Compute stress for each segment
    const upperStress = computeSegmentStress(
      st.upper.zones, st.upper.thetas, 'upper', angle, velocity, repScore
    );
    applyStressColors(st.upperMesh.geometry.attributes.color, upperStress);

    const foreStress = computeSegmentStress(
      st.fore.zones, st.fore.thetas, 'forearm', angle, velocity, repScore
    );
    applyStressColors(st.foreMesh.geometry.attributes.color, foreStress);

    // Update shoulder cap color based on deltoid stress
    const avgDeltoidStress = upperStress.slice(0, 50).reduce((a, b) => a + b, 0) / 50;
    const capColor = stressColor(avgDeltoidStress);
    st.capMesh.material.color.setRGB(capColor.r, capColor.g, capColor.b);

    // Elbow joint stays pink (fixed color, no dynamic recolor)

    // Angle label
    const { sprite, ctx, texture } = st.label;
    ctx.clearRect(0, 0, 220, 110);
    const scoreCSS = repScore != null
      ? (repScore >= 3 ? '#16C79A' : repScore >= 2 ? '#F5A623' : '#E94560')
      : '#888';
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    ctx.roundRect(4, 4, 212, 102, 14);
    ctx.fill();
    ctx.fillStyle = scoreCSS;
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(angle)}\u00B0`, 110, 44);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '16px sans-serif';
    ctx.fillText(rep ? `Rep ${rep.repNumber}` : 'Entre reps', 110, 82);
    texture.needsUpdate = true;

    sprite.position.copy(elW);
    sprite.position.x += (activeSide === 'left' ? -0.22 : 0.22);
    sprite.position.y -= 0.06;

  }, [frameLandmarks, activeSide, getRepAtTime, getRepScore]);

  // Sync to video
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
    if (stateRef.current && frameLandmarks?.length) applyPose(0);
  }, [stateRef.current != null, frameLandmarks, applyPose]);

  // Camera presets
  const setView = (v) => {
    const st = stateRef.current;
    if (!st) return;
    const views = {
      front: [0.3, 0.1, 1.8],
      side: [1.8, 0, 0.1],
      back: [-0.3, 0.1, -1.8],
      medial: [-1.5, 0.3, 1.0],
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
      <div className="relative">
        <div ref={containerRef} className="w-full rounded-2xl overflow-hidden"
          style={{ height: '420px', touchAction: 'none', backgroundColor: '#0d0d1a' }} />

        {currentRep && (
          <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}>
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

        <div className="absolute top-3 right-3 flex gap-1">
          {[
            { id: 'front', label: 'Anterior' },
            { id: 'side', label: 'Lateral' },
            { id: 'medial', label: 'Medial' },
            { id: 'back', label: 'Posterior' },
          ].map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className="text-[10px] font-medium text-white/60 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded-lg transition-colors">
              {v.label}
            </button>
          ))}
        </div>

        <div className="absolute bottom-3 left-3 space-y-1" style={{ maxWidth: '45%' }}>
          {[
            { label: 'Deltoides', desc: 'Estabilización del hombro' },
            { label: 'Bíceps braquial', desc: 'Flexión principal' },
            { label: 'Braquiorradial', desc: 'Flexión del antebrazo' },
            { label: 'Articulación', desc: 'Esfuerzo articular' },
          ].map(z => (
            <div key={z.label} className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded">
              <span className="text-[9px] text-white/70 font-medium">{z.label}</span>
              <span className="text-[8px] text-white/30">{z.desc}</span>
            </div>
          ))}
        </div>

        {/* Rep findings overlay */}
        {currentRepData && (
          <div className="absolute bottom-3 right-3 space-y-1" style={{ maxWidth: '50%', pointerEvents: 'none' }}>
            {currentRepData.findings.slice(0, 3).map((f, i) => {
              const bg = f.type === 'good' ? '#16C79A' : f.type === 'warn' ? '#E94560' : '#F5A623';
              const icon = f.type === 'good' ? '\u2713' : f.type === 'warn' ? '\u2717' : '!';
              return (
                <div key={i} className="rounded-lg px-2.5 py-1.5 flex items-start gap-1.5"
                  style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', borderLeft: `3px solid ${bg}` }}>
                  <span className="text-[10px] font-bold flex-shrink-0 mt-0.5" style={{ color: bg }}>{icon}</span>
                  <p className="text-[10px] text-white/85 leading-tight">{f.text}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Playback controls */}
      <div className="bg-white rounded-2xl p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => isPaused ? onPlay?.() : onPause?.()}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-ink text-white hover:bg-ink/80 transition-colors text-sm">
            {isPaused ? '\u25B6' : '\u23F8'}
          </button>
          <input type="range" min={0} max={duration || 1} step={0.01}
            value={currentTime ?? 0} onChange={e => onSeek?.(+e.target.value)}
            className="flex-1 accent-accent" />
          <span className="font-mono text-[10px] text-ink/40 w-14 text-right">
            {(currentTime ?? 0).toFixed(1)}s
          </span>
        </div>
        {repMetrics && (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-[10px] text-ink/30 mr-1">Reps:</span>
            {repMetrics.map(rep => {
              const score = getRepScore ? getRepScore(rep.repNumber) : 2;
              const color = score >= 3 ? '#16C79A' : score >= 2 ? '#F5A623' : '#E94560';
              const isActive = currentRep?.repNumber === rep.repNumber;
              return (
                <button key={rep.repNumber} onClick={() => onSeek?.(rep.startTime)}
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
