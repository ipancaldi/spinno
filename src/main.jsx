import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine,
  Camera,
  Check,
  ChevronDown,
  Computer,
  Eye,
  EyeOff,
  ImagePlus,
  Laptop,
  Film,
  Monitor,
  Moon,
  Move3D,
  Palette,
  RotateCcw,
  Smartphone,
  Sun,
  Tablet,
  Upload,
  ZoomIn
} from "lucide-react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import "./styles.css";

const DEVICE_PRESETS = {
  phone: {
    label: "Mobile phone",
    resolution: [1080, 2340],
    icon: Smartphone,
    aspect: 9 / 19.5,
    model: "/devices/iphone14/scene.gltf",
    fitAxis: "y",
    fitSize: 5.75,
    modelRotation: [0, Math.PI, 0],
    screen: { size: [2.64, 5.54], position: [0, 0, -0.227], rotation: [0, Math.PI, 0], radius: 0.42 },
    camera: [4.9, 2.7, 6.6],
    target: [0, 0, 0]
  },
  tablet: {
    label: "iPad / tablet",
    resolution: [1620, 2160],
    icon: Tablet,
    aspect: 4 / 3,
    model: "/devices/ipad/scene.gltf",
    fitAxis: "y",
    fitSize: 6.25,
    screen: { size: [4.46, 5.96], position: [-0.02, 0, 0.69], rotation: [0, 0, 0] },
    screenMeshHints: ["screen"],
    screenOverlay: false,
    camera: [6.1, 3.0, 6.3],
    target: [0, 0, 0]
  },
  laptop: {
    label: "Laptop",
    resolution: [1440, 900],
    icon: Laptop,
    aspect: 16 / 10,
    model: "/devices/laptop/scene.gltf",
    fitAxis: "x",
    fitSize: 4.6,
    screen: { size: [4.542, 3.04], position: [0, 0.049, 1.492], rotation: [0.2547, 0, 0], flipX: true, bezel: 0.045 },
    camera: [5.8, 4.8, -5.8],
    target: [0, 0.45, 0]
  },
  desktop: {
    label: "Desktop monitor",
    resolution: [1920, 1080],
    icon: Monitor,
    aspect: 16 / 9,
    model: "/devices/monitor/scene.gltf",
    fitAxis: "z",
    fitSize: 7.15,
    modelRotation: [0, -Math.PI / 2, 0],
    screen: { size: [6.98, 3.82], position: [0.26, 0.85, 0], rotation: [0, Math.PI / 2, 0] },
    camera: [7.1, 3.9, 6.8],
    target: [0, 0.4, 0]
  }
};

const MATERIAL_PRESETS = {
  original: { label: "Original", original: true },
  matte: { label: "Matte black", color: "#171717", roughness: 0.82, metalness: 0.18 },
  silver: { label: "Silver aluminium", color: "#c8cbc7", roughness: 0.38, metalness: 0.82 },
  white: { label: "White", color: "#f2f1ec", roughness: 0.58, metalness: 0.18 },
  space: { label: "Space grey", color: "#5b5d5f", roughness: 0.42, metalness: 0.72 },
  custom: { label: "Custom colour", color: "#384252", roughness: 0.46, metalness: 0.46 }
};

const BACKGROUNDS = {
  solid: "Solid",
  gradient: "Subtle gradient"
};

const LIGHTING_PRESETS = {
  soft: { label: "Soft studio", ambient: 1.8, key: 3.2, fill: 1.5, shadow: true },
  dramatic: { label: "Dramatic shadow", ambient: 0.72, key: 5.2, fill: 0.28, shadow: true },
  ambient: { label: "Ambient only", ambient: 2.7, key: 0.6, fill: 0.45, shadow: false },
  flat: { label: "No shadow", ambient: 2.2, key: 2.1, fill: 1.1, shadow: false }
};

const EXPORT_PRESETS = {
  square: { label: "1080 x 1080", width: 1080, height: 1080 },
  wide: { label: "1920 x 1080", width: 1920, height: 1080 },
  fourk: { label: "4K", width: 3840, height: 2160 },
  custom: { label: "Custom", width: 1600, height: 1200 }
};

const ALIGNMENT = ["center", "top", "bottom", "left", "right"];

function createContactShadowTexture(blur = 4) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const softness = Math.min(0.48, 0.18 + blur * 0.022);
  const gradient = ctx.createRadialGradient(256, 256, 18, 256, 256, 245);
  gradient.addColorStop(0, "rgba(0,0,0,0.34)");
  gradient.addColorStop(Math.max(0.2, 1 - softness * 2.1), "rgba(0,0,0,0.18)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createTextureCanvas(aspect) {
  const canvas = document.createElement("canvas");
  const longEdge = 2048;
  canvas.width = aspect >= 1 ? longEdge : Math.round(longEdge * aspect);
  canvas.height = aspect >= 1 ? Math.round(longEdge / aspect) : longEdge;
  return canvas;
}

function createDefaultTexture(aspect = 9 / 19.5) {
  const canvas = createTextureCanvas(aspect);
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const minEdge = Math.min(w, h);

  // Clean off-white surface
  ctx.fillStyle = "#fbfbfa";
  ctx.fillRect(0, 0, w, h);

  // Subtle 1px grid
  const cell = Math.round(minEdge / 12);
  ctx.strokeStyle = "rgba(17, 24, 22, 0.06)";
  ctx.lineWidth = Math.max(1, Math.round(minEdge / 760));
  ctx.beginPath();
  for (let x = cell; x < w; x += cell) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = cell; y < h; y += cell) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.stroke();

  // Big upload icon (lucide "upload" glyph) centered
  const iconSize = minEdge * 0.2;
  const cx = w / 2;
  const cy = h / 2 - iconSize * 0.18;
  const ox = cx - iconSize / 2;
  const oy = cy - iconSize / 2;
  const s = iconSize / 24;
  const p = (px, py) => [ox + px * s, oy + py * s];
  ctx.strokeStyle = "rgba(17, 24, 22, 0.32)";
  ctx.lineWidth = Math.max(2, iconSize * 0.055);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  // tray
  ctx.moveTo(...p(4, 15));
  ctx.lineTo(...p(4, 20));
  ctx.lineTo(...p(20, 20));
  ctx.lineTo(...p(20, 15));
  // arrow shaft
  ctx.moveTo(...p(12, 3.5));
  ctx.lineTo(...p(12, 15));
  // arrow head
  ctx.moveTo(...p(7, 8.5));
  ctx.lineTo(...p(12, 3.5));
  ctx.lineTo(...p(17, 8.5));
  ctx.stroke();

  // Caption underneath
  ctx.fillStyle = "rgba(17, 24, 22, 0.5)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${Math.round(minEdge * 0.052)}px system-ui, -apple-system, sans-serif`;
  ctx.fillText("Drop a UI here", cx, cy + iconSize * 0.9);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function fitImageToCanvas(image, fit, scale, offsetX, offsetY, alignment, aspect, targetCanvas, flipX = false, bezel = 0) {
  const canvas = targetCanvas || createTextureCanvas(aspect);
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const margin = Math.min(W, H) * bezel;
  const marginX = margin;
  const marginY = margin;
  const regionW = W - marginX * 2;
  const regionH = H - marginY * 2;
  const mediaWidth = image.videoWidth || image.naturalWidth || image.width || W;
  const mediaHeight = image.videoHeight || image.naturalHeight || image.height || H;
  const imgRatio = mediaWidth / mediaHeight;
  const regionRatio = regionW / regionH;

  let drawWidth;
  let drawHeight;
  if (fit === "contain") {
    if (imgRatio > regionRatio) {
      drawWidth = regionW;
      drawHeight = drawWidth / imgRatio;
    } else {
      drawHeight = regionH;
      drawWidth = drawHeight * imgRatio;
    }
  } else {
    if (imgRatio > regionRatio) {
      drawHeight = regionH;
      drawWidth = drawHeight * imgRatio;
    } else {
      drawWidth = regionW;
      drawHeight = drawWidth / imgRatio;
    }
  }

  drawWidth *= scale;
  drawHeight *= scale;

  let x = marginX + (regionW - drawWidth) / 2;
  let y = marginY + (regionH - drawHeight) / 2;
  if (alignment === "top") y = marginY;
  if (alignment === "bottom") y = marginY + regionH - drawHeight;
  if (alignment === "left") x = marginX;
  if (alignment === "right") x = marginX + regionW - drawWidth;

  x += offsetX * regionW * 0.35;
  y += offsetY * regionH * 0.35;

  if (bezel > 0) {
    ctx.fillStyle = "#08090a";
    ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = "#f8faf9";
  ctx.fillRect(marginX, marginY, regionW, regionH);
  ctx.imageSmoothingQuality = "high";
  ctx.save();
  ctx.beginPath();
  ctx.rect(marginX, marginY, regionW, regionH);
  ctx.clip();
  if (flipX) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
  } else {
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
  }
  ctx.restore();
  return canvas;
}

function drawBackgroundImage(ctx, image, width, height, fit, scale, offsetX, offsetY, alignment) {
  const mediaWidth = image.naturalWidth || image.width || width;
  const mediaHeight = image.naturalHeight || image.height || height;
  const imgRatio = mediaWidth / mediaHeight;
  const canvasRatio = width / height;
  let drawWidth;
  let drawHeight;
  if (fit === "contain") {
    if (imgRatio > canvasRatio) { drawWidth = width; drawHeight = width / imgRatio; }
    else { drawHeight = height; drawWidth = height * imgRatio; }
  } else {
    if (imgRatio > canvasRatio) { drawHeight = height; drawWidth = height * imgRatio; }
    else { drawWidth = width; drawHeight = width / imgRatio; }
  }
  drawWidth *= scale;
  drawHeight *= scale;
  let x = (width - drawWidth) / 2;
  let y = (height - drawHeight) / 2;
  if (alignment === "top") y = 0;
  if (alignment === "bottom") y = height - drawHeight;
  if (alignment === "left") x = 0;
  if (alignment === "right") x = width - drawWidth;
  x += offsetX * width * 0.35;
  y += offsetY * height * 0.35;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

function applyScreenGloss(material, gloss) {
  if (!material) return;
  material.clearcoat = gloss;
  material.clearcoatRoughness = THREE.MathUtils.lerp(0.34, 0.03, gloss);
  material.roughness = THREE.MathUtils.lerp(0.5, 0.1, gloss);
  material.envMapIntensity = THREE.MathUtils.lerp(0.2, 1.8, gloss);
  material.needsUpdate = true;
}

function createScreenMaterial(texture, gloss) {
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity: 1,
    map: texture,
    metalness: 0,
    side: THREE.DoubleSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -6
  });
  applyScreenGloss(material, gloss);
  return material;
}

function createScreenGeometry(width, height, radius = 0) {
  if (!radius) return new THREE.PlaneGeometry(width, height);
  const r = Math.min(radius, width / 2, height / 2);
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const geometry = new THREE.ShapeGeometry(shape, 16);
  const position = geometry.attributes.position;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i += 1) {
    uv[i * 2] = (position.getX(i) - x) / width;
    uv[i * 2 + 1] = (position.getY(i) - y) / height;
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return geometry;
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="selectWrap">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {children}
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </span>
    </label>
  );
}

function NumberField({ label, value, onChange, min = 1 }) {
  return (
    <label className="field compactField">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(event) => onChange(Math.max(min, Number(event.target.value) || min))}
      />
    </label>
  );
}

function Range({ label, value, min, max, step = 0.01, onChange, suffix = "" }) {
  return (
    <label className="rangeField">
      <span>
        {label}
        <strong>{Number(value).toFixed(step >= 1 ? 0 : 2)}{suffix}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button className={`toggle ${checked ? "active" : ""}`} type="button" onClick={() => onChange(!checked)}>
      <span aria-hidden="true">{checked ? <Check size={13} /> : null}</span>
      {label}
    </button>
  );
}

function XYPad({ label, hint, x, y, minX = -1, maxX = 1, minY = -1, maxY = 1, resetX = 0, resetY = 0, onChange }) {
  const ref = useRef(null);
  const dragging = useRef(false);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const hx = clamp01((x - minX) / (maxX - minX)) * 100;
  const hy = clamp01((y - minY) / (maxY - minY)) * 100;
  const update = (clientX, clientY) => {
    const rect = ref.current.getBoundingClientRect();
    const nx = clamp01((clientX - rect.left) / rect.width);
    const ny = clamp01((clientY - rect.top) / rect.height);
    onChange(minX + nx * (maxX - minX), minY + ny * (maxY - minY));
  };
  const onDown = (event) => {
    dragging.current = true;
    update(event.clientX, event.clientY);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch (error) { /* noop */ }
  };
  const onMove = (event) => { if (dragging.current) update(event.clientX, event.clientY); };
  const onUp = (event) => {
    dragging.current = false;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch (error) { /* noop */ }
  };
  return (
    <div className="padField">
      {label ? <span className="padLabel">{label}{hint ? <em>{hint}</em> : null}</span> : null}
      <div
        ref={ref}
        className="xyPad"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={() => onChange(resetX, resetY)}
        title="Drag to position · double-click to center"
      >
        <span className="xyPadGrid" aria-hidden="true" />
        <span className="xyPadHandle" style={{ left: `${hx}%`, top: `${hy}%` }} />
      </div>
    </div>
  );
}

function LightPad({ label, azimuth, elevation, onChange }) {
  const ref = useRef(null);
  const dragging = useRef(false);
  const radiusNorm = Math.min(1, Math.max(0, (90 - elevation) / 85));
  const az = (azimuth * Math.PI) / 180;
  const px = 50 + Math.sin(az) * radiusNorm * 50;
  const py = 50 - Math.cos(az) * radiusNorm * 50;
  const update = (clientX, clientY) => {
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.min(1, Math.sqrt(dx * dx + dy * dy) / (rect.width / 2));
    const angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
    const azDeg = (angle + 360) % 360;
    const elev = Math.max(5, Math.min(90, 90 - dist * 85));
    onChange(azDeg, elev);
  };
  const onDown = (event) => {
    dragging.current = true;
    update(event.clientX, event.clientY);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch (error) { /* noop */ }
  };
  const onMove = (event) => { if (dragging.current) update(event.clientX, event.clientY); };
  const onUp = (event) => {
    dragging.current = false;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch (error) { /* noop */ }
  };
  return (
    <div className="padField">
      <span className="padLabel">{label}<em>{Math.round(azimuth)}° · {Math.round(elevation)}°</em></span>
      <div
        ref={ref}
        className="lightPad"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        title="Drag the light · center is overhead, edge is low"
      >
        <span className="lightPadHandle" style={{ left: `${px}%`, top: `${py}%` }}>
          <Sun size={13} />
        </span>
      </div>
    </div>
  );
}

function MockupViewer({
  deviceType,
  materialKey,
  customMaterialColor,
  backgroundMode,
  backgroundColor,
  gradientColor,
  transparent,
  bgImage,
  bgFit,
  bgScale,
  bgX,
  bgY,
  bgAlignment,
  lightingKey,
  shadows,
  shadowBlur,
  ambient,
  lightAzimuth,
  lightElevation,
  screenGloss,
  screenImage,
  screenMime,
  screenFit,
  screenScale,
  screenX,
  screenY,
  screenAlignment,
  rotationX,
  rotationY,
  rotationZ,
  cameraDistance,
  exportRequest,
  onExportComplete,
  viewExportRequest,
  onViewExportComplete,
  videoExportRequest,
  onVideoExportComplete,
  apiRef
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const deviceGroupRef = useRef(null);
  const screenRef = useRef(null);
  const modelScreenMeshesRef = useRef([]);
  const buildIdRef = useRef(0);
  const lightsRef = useRef({});
  const textureRef = useRef(null);
  const contactShadowRef = useRef(null);
  const contactShadowTextureRef = useRef(null);
  const mediaElementRef = useRef(null);
  const mediaKindRef = useRef("image");
  const glossRef = useRef(screenGloss);
  const bgMediaRef = useRef(null);
  const bgBackgroundTextureRef = useRef(null);
  const rebuildBackgroundRef = useRef(null);
  const raycasterRef = useRef(null);
  const dynamicFrameRef = useRef(null);
  const groundRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const gltfLoader = useMemo(() => new GLTFLoader(), []);

  const materialConfig = materialKey === "custom"
    ? { ...MATERIAL_PRESETS.custom, color: customMaterialColor }
    : MATERIAL_PRESETS[materialKey];

  const applyScreenTexture = useCallback((texture) => {
    const assign = (material) => {
      if (!material) return;
      material.map = texture;
      material.emissiveMap = texture;
      material.needsUpdate = true;
    };
    if (screenRef.current) assign(screenRef.current.material);
    modelScreenMeshesRef.current.forEach((mesh) => assign(mesh.material));
  }, []);

  const rebuildScreenTexture = useCallback(() => {
    const preset = DEVICE_PRESETS[deviceType];
    const aspect = preset.screen.size[0] / preset.screen.size[1];
    const bezel = preset.screen.bezel || 0;
    let texture;
    dynamicFrameRef.current = null;
    if (mediaElementRef.current) {
      const canvas = fitImageToCanvas(mediaElementRef.current, screenFit, screenScale, screenX, screenY, screenAlignment, aspect, undefined, Boolean(preset.screen.flipX), bezel);
      texture = new THREE.CanvasTexture(canvas);
      if (mediaKindRef.current !== "image") {
        dynamicFrameRef.current = {
          media: mediaElementRef.current,
          canvas,
          texture,
          aspect,
          fit: screenFit,
          scale: screenScale,
          x: screenX,
          y: screenY,
          alignment: screenAlignment,
          flipX: Boolean(preset.screen.flipX),
          bezel
        };
      }
    } else {
      texture = createDefaultTexture(aspect);
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    textureRef.current?.dispose();
    textureRef.current = texture;
    applyScreenTexture(texture);
  }, [applyScreenTexture, deviceType, screenAlignment, screenFit, screenScale, screenX, screenY]);

  const buildDevice = useCallback(async () => {
    const scene = sceneRef.current;
    if (!scene) return;
    const buildId = buildIdRef.current + 1;
    buildIdRef.current = buildId;
    if (deviceGroupRef.current) {
      scene.remove(deviceGroupRef.current);
      deviceGroupRef.current.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material && object.material !== screenRef.current?.material) {
          if (Array.isArray(object.material)) object.material.forEach((material) => material?.dispose?.());
          else object.material.dispose?.();
        }
      });
    }
    screenRef.current = null;
    modelScreenMeshesRef.current = [];

    const preset = DEVICE_PRESETS[deviceType];
    const group = new THREE.Group();
    const frameMaterialConfig = {
      color: new THREE.Color(materialConfig.color),
      roughness: materialConfig.roughness,
      metalness: materialConfig.metalness,
      envMapIntensity: 1.25
    };

    const modelUrl = import.meta.env.BASE_URL + preset.model.replace(/^\//, "");
    const gltf = await new Promise((resolve, reject) => {
      gltfLoader.load(modelUrl, resolve, undefined, reject);
    });
    if (buildId !== buildIdRef.current) return;

    const model = gltf.scene;
    const modelRoot = new THREE.Group();
    const sourceBox = new THREE.Box3().setFromObject(model);
    const sourceSize = sourceBox.getSize(new THREE.Vector3());
    const sourceCenter = sourceBox.getCenter(new THREE.Vector3());
    const axisSize = preset.fitAxis === "x" ? sourceSize.x : preset.fitAxis === "z" ? sourceSize.z : sourceSize.y;
    const modelScale = preset.fitSize / Math.max(axisSize, 0.0001);
    model.position.set(-sourceCenter.x * modelScale, -sourceCenter.y * modelScale, -sourceCenter.z * modelScale);
    model.scale.setScalar(modelScale);
    if (preset.modelRotation) modelRoot.rotation.set(...preset.modelRotation);

    const screenHints = preset.screenMeshHints || [];
    const screenMaterial = createScreenMaterial(textureRef.current, glossRef.current);

    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;

      const materialName = Array.isArray(object.material)
        ? object.material.map((material) => material?.name || "").join(" ")
        : object.material?.name || "";
      const nodeName = object.name || "";
      const isScreenMesh = screenHints.some((hint) => (
        materialName.toLowerCase().includes(hint.toLowerCase()) ||
        nodeName.toLowerCase().includes(hint.toLowerCase())
      ));

      if (isScreenMesh) {
        object.material = screenMaterial.clone();
        modelScreenMeshesRef.current.push(object);
        return;
      }

      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!material) return;
        // Force the device body opaque — several GLTF frame materials ship with
        // transparent:true + depthWrite:false, which makes the chassis render
        // see-through where front/back faces overlap.
        material.transparent = false;
        material.depthWrite = true;
        material.depthTest = true;
        material.alphaTest = 0;
        material.opacity = 1;
        if (materialConfig.original) {
          // Keep the device's native baked materials (colour, textures, keycaps…),
          // just give them the studio environment reflections.
          material.envMapIntensity = 1;
          material.needsUpdate = true;
          return;
        }
        // Drop the baked-in albedo texture so the chosen finish defines the colour
        // fully (surface detail still comes from the normal/roughness maps).
        material.map = null;
        if (material.emissiveMap) {
          material.emissiveMap = null;
          if (material.emissive) material.emissive.set(0x000000);
        }
        if (material.color) material.color.set(materialConfig.color);
        material.roughness = materialConfig.roughness;
        material.metalness = materialConfig.metalness;
        material.envMapIntensity = 1.25;
        material.needsUpdate = true;
      });
    });

    modelRoot.add(model);

    if (preset.screenOverlay !== false) {
      const overlayMaterial = createScreenMaterial(textureRef.current, glossRef.current);
      const screen = new THREE.Mesh(createScreenGeometry(preset.screen.size[0], preset.screen.size[1], preset.screen.radius), overlayMaterial);
      screen.position.set(...preset.screen.position);
      screen.rotation.set(...preset.screen.rotation);
      screen.renderOrder = 5;
      screenRef.current = screen;
      modelRoot.add(screen);
    }

    group.add(modelRoot);
    group.rotation.set(rotationX, rotationY, rotationZ);
    deviceGroupRef.current = group;
    scene.add(group);
    if (textureRef.current) applyScreenTexture(textureRef.current);

    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (camera && controls) {
      camera.position.set(
        preset.camera[0] * cameraDistance,
        preset.camera[1] * cameraDistance,
        preset.camera[2] * cameraDistance
      );
      controls.target.set(...preset.target);
      controls.update();
    }
  }, [applyScreenTexture, cameraDistance, deviceType, gltfLoader, materialConfig.original, materialConfig.color, materialConfig.metalness, materialConfig.roughness, rotationX, rotationY, rotationZ]);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const environmentTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environmentTexture;

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.minDistance = 4;
    controls.maxDistance = 19;
    controls.panSpeed = 0.8;
    controls.rotateSpeed = 0.72;
    controls.zoomSpeed = 0.78;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight("#ffffff", 1.8);
    const keyLight = new THREE.DirectionalLight("#ffffff", 3.2);
    keyLight.position.set(4, 6, 5);
    keyLight.castShadow = true;
    keyLight.shadow.radius = shadowBlur;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 24;
    keyLight.shadow.camera.left = -9;
    keyLight.shadow.camera.right = 9;
    keyLight.shadow.camera.top = 9;
    keyLight.shadow.camera.bottom = -9;

    const fillLight = new THREE.DirectionalLight("#dfe8ff", 1.1);
    fillLight.position.set(-5, 2.2, -3);

    scene.add(ambientLight, keyLight, fillLight);
    lightsRef.current = { ambientLight, keyLight, fillLight };

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.ShadowMaterial({ color: "#0d0f0e", opacity: 0.02 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -3.95;
    ground.receiveShadow = true;
    groundRef.current = ground;
    scene.add(ground);

    const contactShadowTexture = createContactShadowTexture(shadowBlur);
    const contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: contactShadowTexture,
        transparent: true,
        opacity: 0.54,
        depthWrite: false
      })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = -3.93;
    contactShadow.scale.set(4.2 + shadowBlur * 0.46, 2.2 + shadowBlur * 0.3, 1);
    contactShadow.renderOrder = -1;
    contactShadowRef.current = contactShadow;
    contactShadowTextureRef.current = contactShadowTexture;
    scene.add(contactShadow);

    textureRef.current = createDefaultTexture(DEVICE_PRESETS[deviceType].screen.size[0] / DEVICE_PRESETS[deviceType].screen.size[1]);
    buildDevice();

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      rebuildBackgroundRef.current?.();
    };
    resizeObserverRef.current = new ResizeObserver(resize);
    resizeObserverRef.current.observe(mount);
    resize();

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      const dynamicFrame = dynamicFrameRef.current;
      if (dynamicFrame) {
        fitImageToCanvas(
          dynamicFrame.media,
          dynamicFrame.fit,
          dynamicFrame.scale,
          dynamicFrame.x,
          dynamicFrame.y,
          dynamicFrame.alignment,
          dynamicFrame.aspect,
          dynamicFrame.canvas,
          dynamicFrame.flipX,
          dynamicFrame.bezel
        );
        dynamicFrame.texture.needsUpdate = true;
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserverRef.current?.disconnect();
      controls.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
      });
      textureRef.current?.dispose();
      contactShadowTextureRef.current?.dispose();
      bgBackgroundTextureRef.current?.dispose();
      environmentTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    glossRef.current = screenGloss;
    if (screenRef.current) applyScreenGloss(screenRef.current.material, screenGloss);
    modelScreenMeshesRef.current.forEach((mesh) => applyScreenGloss(mesh.material, screenGloss));
  }, [screenGloss]);

  useEffect(() => {
    if (!apiRef) return undefined;
    apiRef.current = {
      hitTestDevice: (clientX, clientY) => {
        const renderer = rendererRef.current;
        const camera = cameraRef.current;
        const group = deviceGroupRef.current;
        if (!renderer || !camera || !group) return false;
        const rect = renderer.domElement.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        if (!raycasterRef.current) raycasterRef.current = new THREE.Raycaster();
        const ndc = new THREE.Vector2(
          ((clientX - rect.left) / rect.width) * 2 - 1,
          -((clientY - rect.top) / rect.height) * 2 + 1
        );
        raycasterRef.current.setFromCamera(ndc, camera);
        return raycasterRef.current.intersectObject(group, true).length > 0;
      }
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

  useEffect(() => {
    buildDevice();
  }, [buildDevice]);

  useEffect(() => {
    if (!deviceGroupRef.current) return;
    deviceGroupRef.current.rotation.set(rotationX, rotationY, rotationZ);
  }, [rotationX, rotationY, rotationZ]);

  useEffect(() => {
    const preset = LIGHTING_PRESETS[lightingKey];
    const { ambientLight, keyLight, fillLight } = lightsRef.current;
    if (!ambientLight || !keyLight || !fillLight) return;
    ambientLight.intensity = preset.ambient * ambient;
    keyLight.intensity = preset.key;
    fillLight.intensity = preset.fill;
    keyLight.castShadow = shadows && preset.shadow;
    keyLight.shadow.radius = shadowBlur;
    keyLight.shadow.blurSamples = Math.max(4, Math.round(shadowBlur * 2));
    if (groundRef.current) groundRef.current.visible = shadows && preset.shadow && !transparent;
    if (contactShadowRef.current) {
      contactShadowRef.current.visible = shadows && preset.shadow && !transparent;
      contactShadowRef.current.scale.set(3.8 + shadowBlur * 0.52, 2.0 + shadowBlur * 0.34, 1);
      contactShadowRef.current.material.opacity = Math.max(0.12, 0.58 - shadowBlur * 0.026);
      contactShadowTextureRef.current?.dispose();
      const texture = createContactShadowTexture(shadowBlur);
      contactShadowTextureRef.current = texture;
      contactShadowRef.current.material.map = texture;
      contactShadowRef.current.material.needsUpdate = true;
    }
    const renderer = rendererRef.current;
    if (renderer) renderer.shadowMap.enabled = shadows && preset.shadow;
  }, [lightingKey, shadows, shadowBlur, ambient, transparent]);

  useEffect(() => {
    const { keyLight } = lightsRef.current;
    if (!keyLight) return;
    const radius = 8.8;
    const az = (lightAzimuth * Math.PI) / 180;
    const el = (lightElevation * Math.PI) / 180;
    keyLight.position.set(
      radius * Math.cos(el) * Math.sin(az),
      radius * Math.sin(el),
      radius * Math.cos(el) * Math.cos(az)
    );
    keyLight.target.position.set(0, 0, 0);
    keyLight.target.updateMatrixWorld();
  }, [lightAzimuth, lightElevation]);

  const rebuildBackground = useCallback(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!scene || !renderer) return;
    const disposePrev = () => {
      if (bgBackgroundTextureRef.current) {
        bgBackgroundTextureRef.current.dispose();
        bgBackgroundTextureRef.current = null;
      }
    };
    const hasImage = !!bgMediaRef.current;
    if (!hasImage) {
      disposePrev();
      if (transparent) {
        scene.background = null;
        return;
      }
      if (backgroundMode === "solid") {
        scene.background = new THREE.Color(backgroundColor);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0, backgroundColor);
      grad.addColorStop(1, gradientColor);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 2, 512);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      bgBackgroundTextureRef.current = texture;
      scene.background = texture;
      return;
    }
    const size = new THREE.Vector2();
    renderer.getSize(size);
    const w = Math.max(2, Math.round(size.x));
    const h = Math.max(2, Math.round(size.y));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (transparent) {
      ctx.clearRect(0, 0, w, h);
    } else if (backgroundMode === "gradient") {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, backgroundColor);
      grad.addColorStop(1, gradientColor);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, w, h);
    }
    drawBackgroundImage(ctx, bgMediaRef.current, w, h, bgFit, bgScale, bgX, bgY, bgAlignment);
    disposePrev();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    bgBackgroundTextureRef.current = texture;
    scene.background = texture;
  }, [backgroundMode, backgroundColor, gradientColor, transparent, bgFit, bgScale, bgX, bgY, bgAlignment]);

  useEffect(() => {
    rebuildBackgroundRef.current = rebuildBackground;
    rebuildBackground();
  }, [rebuildBackground]);

  useEffect(() => {
    if (!bgImage) {
      bgMediaRef.current = null;
      rebuildBackgroundRef.current?.();
      return;
    }
    const image = new Image();
    image.onload = () => {
      bgMediaRef.current = image;
      rebuildBackgroundRef.current?.();
    };
    image.src = bgImage;
  }, [bgImage]);

  useEffect(() => {
    if (!screenImage) return;
    dynamicFrameRef.current = null;
    const isVideo = screenMime?.startsWith("video/");
    const isGif = screenMime === "image/gif";

    if (isVideo) {
      const video = document.createElement("video");
      video.src = screenImage;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "auto";
      video.onloadeddata = () => {
        mediaElementRef.current = video;
        mediaKindRef.current = "video";
        video.play().catch(() => {});
        rebuildScreenTexture();
      };
      return () => {
        video.pause();
      };
    }

    const image = new Image();
    image.onload = () => {
      mediaElementRef.current = image;
      mediaKindRef.current = isGif ? "animated-image" : "image";
      rebuildScreenTexture();
    };
    image.src = screenImage;
  }, [rebuildScreenTexture, screenImage, screenMime]);

  useEffect(() => {
    rebuildScreenTexture();
  }, [rebuildScreenTexture]);

  useEffect(() => {
    if (!exportRequest) return;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!renderer || !camera || !scene) return;

    const currentSize = new THREE.Vector2();
    renderer.getSize(currentSize);
    const currentPixelRatio = renderer.getPixelRatio();
    // Always export the entire visible canvas: keep the on-screen aspect ratio
    // and only use the requested size as a resolution (long-edge) target.
    const viewAspect = currentSize.x / currentSize.y;
    const targetLongEdge = Math.max(exportRequest.width, exportRequest.height, 1);
    let width;
    let height;
    if (viewAspect >= 1) {
      width = Math.round(targetLongEdge);
      height = Math.max(1, Math.round(targetLongEdge / viewAspect));
    } else {
      height = Math.round(targetLongEdge);
      width = Math.max(1, Math.round(targetLongEdge * viewAspect));
    }

    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    rebuildBackgroundRef.current?.();
    renderer.render(scene, camera);
    renderer.domElement.toBlob((blob) => {
      if (blob) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `spinno-mockup-${width}x${height}.png`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      }
      renderer.setPixelRatio(currentPixelRatio);
      renderer.setSize(currentSize.x, currentSize.y, false);
      camera.aspect = currentSize.x / currentSize.y;
      camera.updateProjectionMatrix();
      rebuildBackgroundRef.current?.();
      renderer.render(scene, camera);
      onExportComplete();
    }, "image/png");
  }, [exportRequest, onExportComplete]);

  useEffect(() => {
    if (!viewExportRequest) return;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!renderer || !camera || !scene) return;

    const currentSize = new THREE.Vector2();
    renderer.getSize(currentSize);
    const currentPixelRatio = renderer.getPixelRatio();
    const previousAspect = camera.aspect;
    const scale = viewExportRequest.scale || 2;
    const width = Math.max(1, Math.round(currentSize.x * scale));
    const height = Math.max(1, Math.round(currentSize.y * scale));

    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    rebuildBackgroundRef.current?.();
    renderer.render(scene, camera);
    renderer.domElement.toBlob((blob) => {
      if (blob) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `spinno-view-${width}x${height}.png`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      }
      renderer.setPixelRatio(currentPixelRatio);
      renderer.setSize(currentSize.x, currentSize.y, false);
      camera.aspect = previousAspect;
      camera.updateProjectionMatrix();
      rebuildBackgroundRef.current?.();
      renderer.render(scene, camera);
      onViewExportComplete();
    }, "image/png");
  }, [viewExportRequest, onViewExportComplete]);

  useEffect(() => {
    if (!videoExportRequest) return;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!renderer || !camera || !scene || !renderer.domElement.captureStream || !window.MediaRecorder) {
      onVideoExportComplete();
      return;
    }

    const currentSize = new THREE.Vector2();
    renderer.getSize(currentSize);
    const currentPixelRatio = renderer.getPixelRatio();
    const previousAspect = camera.aspect;
    const viewAspect = currentSize.x / currentSize.y;
    const targetLongEdge = Math.max(videoExportRequest.width, videoExportRequest.height, 1);
    let width;
    let height;
    if (viewAspect >= 1) {
      width = Math.round(targetLongEdge);
      height = Math.max(1, Math.round(targetLongEdge / viewAspect));
    } else {
      height = Math.round(targetLongEdge);
      width = Math.max(1, Math.round(targetLongEdge * viewAspect));
    }
    width -= width % 2;
    height -= height % 2;
    const video = mediaKindRef.current === "video" ? mediaElementRef.current : null;
    const duration = Number.isFinite(video?.duration) && video.duration > 0 ? video.duration : 6;

    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    rebuildBackgroundRef.current?.();

    const stream = renderer.domElement.captureStream(30);
    const mp4Mime = "video/mp4;codecs=avc1.42E01E";
    const webmMime = "video/webm;codecs=vp9";
    const mimeType = MediaRecorder.isTypeSupported(mp4Mime)
      ? mp4Mime
      : MediaRecorder.isTypeSupported(webmMime)
        ? webmMime
        : "";
    const chunks = [];
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
      const extension = blob.type.includes("mp4") ? "mp4" : "webm";
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `spinno-mockup-${width}x${height}.${extension}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      stream.getTracks().forEach((track) => track.stop());
      renderer.setPixelRatio(currentPixelRatio);
      renderer.setSize(currentSize.x, currentSize.y, false);
      camera.aspect = previousAspect;
      camera.updateProjectionMatrix();
      rebuildBackgroundRef.current?.();
      renderer.render(scene, camera);
      onVideoExportComplete();
    };

    if (video) {
      try {
        video.currentTime = 0;
        video.play().catch(() => {});
      } catch {
        video.play().catch(() => {});
      }
    }
    recorder.start(250);
    const stopTimer = window.setTimeout(() => recorder.state !== "inactive" && recorder.stop(), duration * 1000);

    return () => {
      window.clearTimeout(stopTimer);
      if (recorder.state !== "inactive") recorder.stop();
    };
  }, [videoExportRequest, onVideoExportComplete]);

  return <div ref={mountRef} className="viewerCanvas" />;
}

function App() {
  const [deviceType, setDeviceType] = useState("phone");
  const [materialKey, setMaterialKey] = useState("original");
  const [customMaterialColor, setCustomMaterialColor] = useState("#384252");
  const [backgroundMode, setBackgroundMode] = useState("gradient");
  const [backgroundColor, setBackgroundColor] = useState("#f4f1ea");
  const [gradientColor, setGradientColor] = useState("#d7ddd9");
  const [transparent, setTransparent] = useState(false);
  const [lightingKey, setLightingKey] = useState("soft");
  const [shadows, setShadows] = useState(true);
  const [shadowBlur, setShadowBlur] = useState(4);
  const [ambient, setAmbient] = useState(1);
  const [lightAzimuth, setLightAzimuth] = useState(40);
  const [lightElevation, setLightElevation] = useState(43);
  const [screenGloss, setScreenGloss] = useState(0.4);
  const [screenImage, setScreenImage] = useState(null);
  const [screenMime, setScreenMime] = useState("");
  const [screenName, setScreenName] = useState("");
  const [screenFit, setScreenFit] = useState("cover");
  const [screenScale, setScreenScale] = useState(1);
  const [screenX, setScreenX] = useState(0);
  const [screenY, setScreenY] = useState(0);
  const [screenAlignment, setScreenAlignment] = useState("center");
  const [bgImage, setBgImage] = useState(null);
  const [bgName, setBgName] = useState("");
  const [bgFit, setBgFit] = useState("cover");
  const [bgScale, setBgScale] = useState(1);
  const [bgX, setBgX] = useState(0);
  const [bgY, setBgY] = useState(0);
  const [bgAlignment, setBgAlignment] = useState("center");
  const [rotationX, setRotationX] = useState(-0.04);
  const [rotationY, setRotationY] = useState(0.34);
  const [rotationZ, setRotationZ] = useState(-0.03);
  const [cameraDistance, setCameraDistance] = useState(1.3);
  const [exportPreset, setExportPreset] = useState("square");
  const [exportWidth, setExportWidth] = useState(1080);
  const [exportHeight, setExportHeight] = useState(1080);
  const [exportRequest, setExportRequest] = useState(null);
  const [viewExportRequest, setViewExportRequest] = useState(null);
  const [videoExportRequest, setVideoExportRequest] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef(null);
  const objectUrlRef = useRef(null);
  const bgInputRef = useRef(null);
  const bgObjectUrlRef = useRef(null);
  const viewerApiRef = useRef(null);
  const viewportRef = useRef(null);
  const [bgDragActive, setBgDragActive] = useState(false);
  const [dropTarget, setDropTarget] = useState("screen");
  const [theme, setTheme] = useState("light");
  const [previewMode, setPreviewMode] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });

  const currentExport = useMemo(() => {
    if (exportPreset === "custom") return { width: exportWidth, height: exportHeight };
    return EXPORT_PRESETS[exportPreset];
  }, [exportHeight, exportPreset, exportWidth]);

  const exportDims = useMemo(() => {
    const longEdge = Math.max(currentExport.width, currentExport.height);
    const aspect = viewportSize.height > 0 ? viewportSize.width / viewportSize.height : 1;
    if (aspect >= 1) return { width: longEdge, height: Math.max(1, Math.round(longEdge / aspect)) };
    return { width: Math.max(1, Math.round(longEdge * aspect)), height: longEdge };
  }, [currentExport, viewportSize]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const update = () => setViewportSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleFile = useCallback((file) => {
    const supportedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4"];
    if (!file || !supportedTypes.includes(file.type)) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setScreenImage(url);
    setScreenMime(file.type);
    setScreenName(file.name);
    setScreenScale(1);
    setScreenX(0);
    setScreenY(0);
    setScreenAlignment("center");
  }, []);

  const handleBgFile = useCallback((file) => {
    const supportedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!file || !supportedTypes.includes(file.type)) return;
    if (bgObjectUrlRef.current) URL.revokeObjectURL(bgObjectUrlRef.current);
    const url = URL.createObjectURL(file);
    bgObjectUrlRef.current = url;
    setBgImage(url);
    setBgName(file.name);
    setBgScale(1);
    setBgX(0);
    setBgY(0);
    setBgAlignment("center");
  }, []);

  const clearBgImage = useCallback(() => {
    if (bgObjectUrlRef.current) URL.revokeObjectURL(bgObjectUrlRef.current);
    bgObjectUrlRef.current = null;
    setBgImage(null);
    setBgName("");
  }, []);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    if (bgObjectUrlRef.current) URL.revokeObjectURL(bgObjectUrlRef.current);
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    const overDevice = viewerApiRef.current?.hitTestDevice(event.clientX, event.clientY);
    if (overDevice) handleFile(file);
    else handleBgFile(file);
  }, [handleFile, handleBgFile]);

  const onViewportDragOver = useCallback((event) => {
    event.preventDefault();
    setDragActive(true);
    const overDevice = viewerApiRef.current?.hitTestDevice(event.clientX, event.clientY);
    setDropTarget(overDevice ? "screen" : "background");
  }, []);

  const onBgDrop = useCallback((event) => {
    event.preventDefault();
    setBgDragActive(false);
    handleBgFile(event.dataTransfer.files?.[0]);
  }, [handleBgFile]);

  const resetCamera = () => {
    setRotationX(-0.04);
    setRotationY(0.34);
    setRotationZ(-0.03);
    setCameraDistance(1.3);
  };

  const startExport = () => {
    setExportRequest({ ...currentExport, id: Date.now() });
  };

  const startViewExport = () => {
    setViewExportRequest({ scale: 2, id: Date.now() });
  };

  const startVideoExport = () => {
    setVideoExportRequest({ ...currentExport, id: Date.now() });
  };

  return (
    <main className={`appShell ${previewMode ? "preview" : ""}`}>
      <section className="studio">
        <header className="topbar">
          <div>
            <span className="brandMark"><Move3D size={18} /></span>
            <div>
              <p>Spinno Studio</p>
              <span>3D device mockups for product screens</span>
            </div>
          </div>
          <div>
            <button
              className="iconButton"
              type="button"
              onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
              aria-label="Toggle light and dark mode"
              title="Toggle light / dark mode"
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="exportButton" type="button" onClick={startExport}>
              <ArrowDownToLine size={17} />
              Export PNG
            </button>
          </div>
        </header>

        <button
          className="previewToggle"
          type="button"
          onClick={() => setPreviewMode((value) => !value)}
          aria-label={previewMode ? "Show controls" : "Hide controls for preview"}
          title={previewMode ? "Show controls" : "Hide controls (preview)"}
        >
          {previewMode ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>

        <div
          ref={viewportRef}
          className="viewport"
          onDragOver={onViewportDragOver}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
        >
          <MockupViewer
            apiRef={viewerApiRef}
            deviceType={deviceType}
            materialKey={materialKey}
            customMaterialColor={customMaterialColor}
            backgroundMode={backgroundMode}
            backgroundColor={backgroundColor}
            gradientColor={gradientColor}
            transparent={transparent}
            bgImage={bgImage}
            bgFit={bgFit}
            bgScale={bgScale}
            bgX={bgX}
            bgY={bgY}
            bgAlignment={bgAlignment}
            lightingKey={lightingKey}
            shadows={shadows}
            shadowBlur={shadowBlur}
            ambient={ambient}
            lightAzimuth={lightAzimuth}
            lightElevation={lightElevation}
            screenGloss={screenGloss}
            screenImage={screenImage}
            screenMime={screenMime}
            screenFit={screenFit}
            screenScale={screenScale}
            screenX={screenX}
            screenY={screenY}
            screenAlignment={screenAlignment}
            rotationX={rotationX}
            rotationY={rotationY}
            rotationZ={rotationZ}
            cameraDistance={cameraDistance}
            exportRequest={exportRequest}
            onExportComplete={() => setExportRequest(null)}
            viewExportRequest={viewExportRequest}
            onViewExportComplete={() => setViewExportRequest(null)}
            videoExportRequest={videoExportRequest}
            onVideoExportComplete={() => setVideoExportRequest(null)}
          />
          <div
            className={`dropOverlay ${dragActive ? "active" : ""}`}
          >
            <Upload size={28} />
            <span>
              {dropTarget === "background"
                ? "Drop on the background to set the backdrop image"
                : "Drop on the device to set the UI screen"}
            </span>
          </div>
          <div className="deviceBadge">
            <strong>{DEVICE_PRESETS[deviceType].label}</strong>
            <span>{DEVICE_PRESETS[deviceType].resolution[0]} × {DEVICE_PRESETS[deviceType].resolution[1]}</span>
          </div>
          <div className="viewerHint">
            <Camera size={15} />
            Orbit, pan, and zoom directly on the canvas
          </div>
        </div>
      </section>

      <aside className="controlPanel">
        <div className="panelHeader">
          <p>Mockup controls</p>
          <span>Full view · {exportDims.width} × {exportDims.height}</span>
        </div>

        <details className="controlSection" open>
          <summary className="sectionLabel">
            <Computer size={16} />
            Device
            <ChevronDown className="chevron" size={15} />
          </summary>
          <div className="sectionBody">
            <div className="deviceGrid">
              {Object.entries(DEVICE_PRESETS).map(([key, preset]) => {
                const Icon = preset.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    className={deviceType === key ? "active" : ""}
                    onClick={() => setDeviceType(key)}
                  >
                    <Icon size={18} />
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>
            <Select label="Frame finish" value={materialKey} onChange={setMaterialKey}>
              {Object.entries(MATERIAL_PRESETS).map(([key, material]) => <option key={key} value={key}>{material.label}</option>)}
            </Select>
            {materialKey === "custom" ? (
              <label className="field colorField">
                <span>Custom frame colour</span>
                <input type="color" value={customMaterialColor} onChange={(event) => setCustomMaterialColor(event.target.value)} />
                <input type="text" value={customMaterialColor} onChange={(event) => setCustomMaterialColor(event.target.value)} />
              </label>
            ) : null}
          </div>
        </details>

        <details className="controlSection" open>
          <summary className="sectionLabel">
            <ImagePlus size={16} />
            Screen
            <ChevronDown className="chevron" size={15} />
          </summary>
          <div className="sectionBody">
            <button className="uploadBox" type="button" onClick={() => fileInputRef.current?.click()}>
              <Upload size={20} />
              <strong>{screenName || "Upload UI screenshot"}</strong>
              <span>Drop on the device, or click · PNG, JPG, WebP, GIF, MP4</span>
            </button>
            <input
              ref={fileInputRef}
              className="hiddenInput"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,video/mp4"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            <div className="segmented">
              <button className={screenFit === "cover" ? "active" : ""} type="button" onClick={() => setScreenFit("cover")}>Crop</button>
              <button className={screenFit === "contain" ? "active" : ""} type="button" onClick={() => setScreenFit("contain")}>Fit</button>
            </div>
            <XYPad
              label="Position"
              hint="drag · dbl-click to center"
              x={screenX}
              y={screenY}
              onChange={(nx, ny) => { setScreenX(nx); setScreenY(ny); }}
            />
            <Range label="Scale" value={screenScale} min={0.55} max={2.2} step={0.01} onChange={setScreenScale} />
            <Range label="Screen gloss" value={screenGloss} min={0} max={1} step={0.01} onChange={setScreenGloss} />
          </div>
        </details>

        <details className="controlSection">
          <summary className="sectionLabel">
            <Sun size={16} />
            Lighting &amp; background
            <ChevronDown className="chevron" size={15} />
          </summary>
          <div className="sectionBody">
            <LightPad
              label="Light direction"
              azimuth={lightAzimuth}
              elevation={lightElevation}
              onChange={(az, el) => { setLightAzimuth(az); setLightElevation(el); }}
            />
            <Select label="Lighting style" value={lightingKey} onChange={setLightingKey}>
              {Object.entries(LIGHTING_PRESETS).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}
            </Select>
            <Range label="Brightness" value={ambient} min={0.35} max={1.8} step={0.01} onChange={setAmbient} />
            <Toggle checked={shadows} onChange={setShadows} label="Cast shadow" />
            <Range label="Shadow softness" value={shadowBlur} min={0} max={14} step={0.5} onChange={setShadowBlur} />
            <Select label="Background" value={backgroundMode} onChange={setBackgroundMode}>
              {Object.entries(BACKGROUNDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </Select>
            <div className="colorPair">
              <label>
                <span>Base</span>
                <input type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} />
                <input type="text" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} />
              </label>
              {backgroundMode === "gradient" ? (
                <label>
                  <span>End</span>
                  <input type="color" value={gradientColor} onChange={(event) => setGradientColor(event.target.value)} />
                  <input type="text" value={gradientColor} onChange={(event) => setGradientColor(event.target.value)} />
                </label>
              ) : null}
            </div>
            <Toggle checked={transparent} onChange={setTransparent} label="Transparent background" />
          </div>
        </details>

        <details className="controlSection">
          <summary className="sectionLabel">
            <ImagePlus size={16} />
            Backdrop image
            <ChevronDown className="chevron" size={15} />
          </summary>
          <div className="sectionBody">
            <button
              className={`uploadBox ${bgDragActive ? "active" : ""}`}
              type="button"
              onClick={() => bgInputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setBgDragActive(true); }}
              onDragLeave={() => setBgDragActive(false)}
              onDrop={onBgDrop}
            >
              <Upload size={20} />
              <strong>{bgName || "Upload backdrop image"}</strong>
              <span>Drop on the background, or click · PNG, JPG, WebP, GIF</span>
            </button>
            <input
              ref={bgInputRef}
              className="hiddenInput"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => handleBgFile(event.target.files?.[0])}
            />
            {bgImage ? (
              <>
                <div className="segmented">
                  <button className={bgFit === "cover" ? "active" : ""} type="button" onClick={() => setBgFit("cover")}>Crop</button>
                  <button className={bgFit === "contain" ? "active" : ""} type="button" onClick={() => setBgFit("contain")}>Fit</button>
                </div>
                <XYPad
                  label="Position"
                  hint="drag · dbl-click to center"
                  x={bgX}
                  y={bgY}
                  onChange={(nx, ny) => { setBgX(nx); setBgY(ny); }}
                />
                <Range label="Scale" value={bgScale} min={0.4} max={3} step={0.01} onChange={setBgScale} />
                <button className="secondaryAction" type="button" onClick={clearBgImage}>
                  <RotateCcw size={16} />
                  Remove backdrop
                </button>
              </>
            ) : null}
          </div>
        </details>

        <details className="controlSection">
          <summary className="sectionLabel">
            <Move3D size={16} />
            Camera
            <ChevronDown className="chevron" size={15} />
          </summary>
          <div className="sectionBody">
            <XYPad
              label="Tilt &amp; spin"
              hint="drag · dbl-click to face front"
              x={rotationY}
              y={rotationX}
              minX={-3.14}
              maxX={3.14}
              minY={-1.2}
              maxY={1.2}
              onChange={(spin, tilt) => { setRotationY(spin); setRotationX(tilt); }}
            />
            <Range label="Roll" value={rotationZ} min={-0.65} max={0.65} step={0.01} onChange={setRotationZ} />
            <Range label="Zoom" value={cameraDistance} min={0.72} max={1.65} step={0.01} onChange={setCameraDistance} />
            <button className="secondaryAction" type="button" onClick={resetCamera}>
              <ZoomIn size={16} />
              Reset camera
            </button>
          </div>
        </details>

        <details className="controlSection" open>
          <summary className="sectionLabel">
            <ArrowDownToLine size={16} />
            Export
            <ChevronDown className="chevron" size={15} />
          </summary>
          <div className="sectionBody">
            <Select label="Resolution (long edge)" value={exportPreset} onChange={(value) => {
              setExportPreset(value);
              if (value !== "custom") {
                setExportWidth(EXPORT_PRESETS[value].width);
                setExportHeight(EXPORT_PRESETS[value].height);
              }
            }}>
              {Object.entries(EXPORT_PRESETS).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}
            </Select>
            {exportPreset === "custom" ? (
              <div className="exportGrid">
                <NumberField label="Width" value={exportWidth} onChange={(value) => {
                  setExportPreset("custom");
                  setExportWidth(value);
                }} />
                <NumberField label="Height" value={exportHeight} onChange={(value) => {
                  setExportPreset("custom");
                  setExportHeight(value);
                }} />
              </div>
            ) : null}
            <p className="exportNote">Exports the entire visible canvas at your current aspect ratio — never cropped.</p>
            <button className="exportFull" type="button" onClick={startExport}>
              <ArrowDownToLine size={17} />
              Export PNG
            </button>
            <button className="secondaryAction" type="button" onClick={startViewExport}>
              <Camera size={16} />
              Export at screen resolution
            </button>
            {screenMime === "video/mp4" ? (
              <button className="exportFull videoExport" type="button" onClick={startVideoExport}>
                <Film size={17} />
                Export MP4
              </button>
            ) : null}
          </div>
        </details>
      </aside>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
