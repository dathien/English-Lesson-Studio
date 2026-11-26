import React, {useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Layers,
  RotateCcw,
  Sliders,
  Volume2,
} from 'lucide-react';
import type {
  GraphicsQuality,
  InteractiveObject,
  SimulationScene3D,
} from '../../../types/interactiveLab';
import {buildSimulationScene3D} from './ThreeSceneBuilder';
import {playLabSoundEffect, speakLabText} from '../../../services/labAudioService';

interface ProjectedLabel {
  id: string;
  labelEn: string;
  labelVi: string;
  accentHex: string;
  anchorX: number;
  anchorY: number;
  boxX: number;
  boxY: number;
  visible: boolean;
}

interface ThreeLabViewportProps {
  scene: SimulationScene3D;
  quality: GraphicsQuality;
  reduceMotion: boolean;
  selectedObjectId: string | null;
  onSelectObject: (obj: InteractiveObject) => void;
  onSwitchTo2D?: () => void;
  accent?: 'en-GB' | 'en-US';
  customLabels?: Record<string, {labelEn: string; labelVi: string; descriptionVi: string}>;
}

type CameraPresetKey = 'iso' | 'front' | 'top' | 'detail';

const CAMERA_PRESETS: Record<CameraPresetKey, {pos: [number, number, number]; target: [number, number, number]}> = {
  iso: {pos: [6.4, 5.2, 6.8], target: [0, 0.8, 0]},
  front: {pos: [0, 3.1, 8.2], target: [0, 0.9, 0]},
  top: {pos: [0.2, 9.6, 2.2], target: [0, 0, 0]},
  detail: {pos: [3.8, 2.8, 4.1], target: [0, 0.7, 0]},
};

function detectSoftwareWebGL(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return false;
    const renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '').toLowerCase();
    return (
      renderer.includes('swiftshader') ||
      renderer.includes('llvmpipe') ||
      renderer.includes('mesa') ||
      renderer.includes('software')
    );
  } catch {
    return false;
  }
}

export const ThreeLabViewport: React.FC<ThreeLabViewportProps> = ({
  scene: sceneData,
  quality,
  reduceMotion,
  selectedObjectId,
  onSelectObject,
  onSwitchTo2D,
  accent = 'en-GB',
  customLabels,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [labelMode, setLabelMode] = useState<'selected' | 'all' | 'off'>('all');
  const [dockExpanded, setDockExpanded] = useState(true);
  const [projectedLabels, setProjectedLabels] = useState<ProjectedLabel[]>([]);
  const [activePreset, setActivePreset] = useState<CameraPresetKey>('iso');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const initialControls = useMemo(() => {
    const init: Record<string, number | boolean | string> = {};
    for (const c of sceneData.controls) {
      init[c.id] = c.defaultValue;
    }
    return init;
  }, [sceneData.id]);

  const [controlValues, setControlValues] = useState<Record<string, number | boolean | string>>(initialControls);
  const controlValuesRef = useRef(controlValues);
  controlValuesRef.current = controlValues;

  const selectedIdRef = useRef(selectedObjectId);
  selectedIdRef.current = selectedObjectId;

  const labelModeRef = useRef(labelMode);
  labelModeRef.current = labelMode;

  const customLabelsRef = useRef(customLabels);
  customLabelsRef.current = customLabels;

  const cameraGoalRef = useRef<{pos: THREE.Vector3; target: THREE.Vector3} | null>(null);

  useEffect(() => {
    setControlValues(initialControls);
    setActivePreset('iso');
    cameraGoalRef.current = {
      pos: new THREE.Vector3(...CAMERA_PRESETS.iso.pos),
      target: new THREE.Vector3(...CAMERA_PRESETS.iso.target),
    };
  }, [initialControls]);

  const applyCameraPreset = (key: CameraPresetKey) => {
    setActivePreset(key);
    const p = CAMERA_PRESETS[key];
    cameraGoalRef.current = {
      pos: new THREE.Vector3(...p.pos),
      target: new THREE.Vector3(...p.target),
    };
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setWebglError(null);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: quality !== 'eco',
        alpha: false,
        powerPreference: quality === 'eco' ? 'low-power' : 'high-performance',
      });
    } catch {
      setWebglError('Thiết bị hoặc trình duyệt hiện không hỗ trợ WebGL 3D. Bạn có thể chuyển sang bản 2D tương đương ngay bên dưới.');
      return;
    }

    const isSoftware = detectSoftwareWebGL(renderer.getContext());
    const maxDpr = isSoftware ? 1 : quality === 'high' ? 2 : quality === 'standard' ? 1.5 : 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(container.clientWidth || 720, container.clientHeight || 460);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = !isSoftware && quality !== 'eco';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const threeScene = new THREE.Scene();
    const bgHex =
      sceneData.environmentType === 'outdoor'
        ? '#e0f2fe'
        : sceneData.environmentType === 'indoor'
          ? '#f8fafc'
          : '#eef2ff';
    threeScene.background = new THREE.Color(bgHex);
    if (sceneData.environmentType === 'outdoor') {
      threeScene.fog = new THREE.Fog('#e0f2fe', 14, 28);
    }

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    threeScene.environment = envRT.texture;

    const camera = new THREE.PerspectiveCamera(
      44,
      (container.clientWidth || 720) / (container.clientHeight || 460),
      0.1,
      100
    );
    camera.position.set(...CAMERA_PRESETS.iso.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 3.2;
    controls.maxDistance = 16;
    controls.target.set(...CAMERA_PRESETS.iso.target);
    controls.update();

    const cancelGoal = () => {
      cameraGoalRef.current = null;
    };
    controls.addEventListener('start', cancelGoal);

    // Balanced lighting
    const hemi = new THREE.HemisphereLight('#ffffff', '#cbd5e1', 0.9);
    threeScene.add(hemi);

    const sun = new THREE.DirectionalLight('#fffbeb', 1.45);
    sun.position.set(6, 10, 5);
    sun.castShadow = !isSoftware && quality !== 'eco';
    sun.shadow.mapSize.set(quality === 'high' ? 1024 : 512, quality === 'high' ? 1024 : 512);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 26;
    sun.shadow.camera.left = -7;
    sun.shadow.camera.right = 7;
    sun.shadow.camera.top = 7;
    sun.shadow.camera.bottom = -7;
    threeScene.add(sun);

    const fill = new THREE.DirectionalLight('#bae6fd', 0.45);
    fill.position.set(-6, 4, -5);
    threeScene.add(fill);

    // Build custom procedural 3D diorama
    const built = buildSimulationScene3D(sceneData);
    threeScene.add(built.root);

    // Raycaster for hover + click selection
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = {x: 0, y: 0};

    const getHitObjectId = (clientX: number, clientY: number): string | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(built.interactables, true);
      if (hits.length > 0) {
        return (hits[0].object.userData.objectId as string) ?? null;
      }
      return null;
    };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = {x: e.clientX, y: e.clientY};
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return; // drag orbit, not click
      const hitId = getHitObjectId(e.clientX, e.clientY);
      if (hitId) {
        const obj = sceneData.objects.find((o) => o.id === hitId);
        if (obj) {
          playLabSoundEffect('click');
          onSelectObject(obj);
          const displayLabel = customLabelsRef.current?.[obj.id]?.labelEn ?? obj.labelEn;
          speakLabText(displayLabel, accent);
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const hitId = getHitObjectId(e.clientX, e.clientY);
      setHoveredId(hitId);
      renderer.domElement.style.cursor = hitId ? 'pointer' : 'grab';
    };

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('Kết nối đồ họa 3D tạm gián đoạn. Bạn có thể chuyển sang bản 2D hoặc tải lại khung 3D.');
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth || 720;
      const h = container.clientHeight || 460;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // Animation loop + throttled 3D->2D label projection with anti-overlap solver
    const clock = new THREE.Clock();
    let rafId = 0;
    let frameCount = 0;
    const tempVec = new THREE.Vector3();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = reduceMotion ? 0 : clock.elapsedTime;

      if (cameraGoalRef.current) {
        const alpha = 1 - Math.exp(-5.5 * delta);
        camera.position.lerp(cameraGoalRef.current.pos, alpha);
        controls.target.lerp(cameraGoalRef.current.target, alpha);
        if (
          camera.position.distanceTo(cameraGoalRef.current.pos) < 0.04 &&
          controls.target.distanceTo(cameraGoalRef.current.target) < 0.04
        ) {
          cameraGoalRef.current = null;
        }
      }

      built.update(elapsed, controlValuesRef.current);
      controls.update();
      renderer.render(threeScene, camera);

      // Update projected screen-space labels every 6 frames (~10Hz, crisp & low overhead)
      frameCount++;
      if (frameCount % 6 === 0 && labelModeRef.current !== 'off') {
        const w = renderer.domElement.clientWidth || 720;
        const h = renderer.domElement.clientHeight || 460;
        const raw: ProjectedLabel[] = [];

        for (const obj of sceneData.objects) {
          if (labelModeRef.current === 'selected' && selectedIdRef.current !== obj.id) continue;
          const anchor = built.anchors.get(obj.id);
          if (!anchor) continue;
          tempVec.copy(anchor).project(camera);
          const inFront = tempVec.z < 1 && tempVec.z > -1;
          const sx = (tempVec.x * 0.5 + 0.5) * w;
          const sy = (-tempVec.y * 0.5 + 0.5) * h;
          const visible = inFront && sx > 32 && sx < w - 32 && sy > 28 && sy < h - 84;
          const override = customLabelsRef.current?.[obj.id];
          raw.push({
            id: obj.id,
            labelEn: override?.labelEn || obj.labelEn,
            labelVi: override?.labelVi || obj.labelVi,
            accentHex: obj.accentHex || '#2563eb',
            anchorX: sx,
            anchorY: sy,
            boxX: Math.min(Math.max(sx, 78), w - 78),
            boxY: Math.min(Math.max(sy - 28, 26), h - 96),
            visible,
          });
        }

        // Simple 2-pass screen-space vertical anti-overlap relaxation
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 0; i < raw.length; i++) {
            for (let j = i + 1; j < raw.length; j++) {
              if (!raw[i].visible || !raw[j].visible) continue;
              const dx = Math.abs(raw[i].boxX - raw[j].boxX);
              const dy = Math.abs(raw[i].boxY - raw[j].boxY);
              if (dx < 132 && dy < 32) {
                const push = (32 - dy) * 0.55;
                if (raw[i].boxY <= raw[j].boxY) {
                  raw[i].boxY = Math.max(24, raw[i].boxY - push);
                  raw[j].boxY = Math.min(h - 92, raw[j].boxY + push);
                } else {
                  raw[j].boxY = Math.max(24, raw[j].boxY - push);
                  raw[i].boxY = Math.min(h - 92, raw[i].boxY + push);
                }
              }
            }
          }
        }
        setProjectedLabels(raw);
      } else if (frameCount % 6 === 0 && labelModeRef.current === 'off') {
        setProjectedLabels([]);
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', cancelGoal);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      built.dispose();
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
    };
  }, [sceneData, quality, reduceMotion, accent, onSelectObject]);

  if (webglError) {
    return (
      <div className="flex flex-col items-center justify-center h-[440px] rounded-2xl border border-amber-200 bg-amber-50/70 p-6 text-center">
        <Layers className="w-10 h-10 text-amber-600 mb-3" />
        <h4 className="text-base font-bold text-slate-900 mb-1">Chế độ 3D tạm không khả dụng</h4>
        <p className="text-sm text-slate-600 max-w-md mb-4">{webglError}</p>
        {onSwitchTo2D && (
          <button
            type="button"
            onClick={onSwitchTo2D}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
          >
            Chuyển sang mô phỏng 2D tương đương
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 select-none">
      {/* Three.js Canvas Mount */}
      <div ref={containerRef} className="w-full h-[460px] md:h-[510px]" />

      {/* SVG Leader Lines + Anti-Overlap Projected 3D Labels (Zero backdrop-blur over WebGL) */}
      {labelMode !== 'off' && projectedLabels.length > 0 && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <svg className="w-full h-full">
            {projectedLabels
              .filter((l) => l.visible)
              .map((l) => (
                <g key={`line-${l.id}`}>
                  <line
                    x1={l.anchorX}
                    y1={l.anchorY}
                    x2={l.boxX}
                    y2={l.boxY}
                    stroke={selectedObjectId === l.id ? '#2563eb' : '#475569'}
                    strokeWidth={selectedObjectId === l.id ? 2 : 1.2}
                    strokeDasharray="3 2"
                  />
                  <circle
                    cx={l.anchorX}
                    cy={l.anchorY}
                    r={selectedObjectId === l.id ? 4.5 : 3.2}
                    fill={l.accentHex}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                </g>
              ))}
          </svg>
          {projectedLabels
            .filter((l) => l.visible)
            .map((l) => {
              const isSelected = selectedObjectId === l.id || hoveredId === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    const obj = sceneData.objects.find((o) => o.id === l.id);
                    if (obj) {
                      playLabSoundEffect('click');
                      onSelectObject(obj);
                      speakLabText(l.labelEn, accent);
                    }
                  }}
                  style={{left: `${l.boxX}px`, top: `${l.boxY}px`, transform: 'translate(-50%, -50%)'}}
                  className={`pointer-events-auto absolute px-2.5 py-1 rounded-lg border text-left shadow-sm transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-700 z-20'
                      : 'bg-white text-slate-800 border-slate-300 hover:border-blue-500 z-10'
                  }`}
                >
                  <div className="text-[11px] font-bold leading-tight whitespace-nowrap flex items-center gap-1">
                    <Volume2 className="w-3 h-3 shrink-0 opacity-80" />
                    <span>{l.labelEn}</span>
                  </div>
                </button>
              );
            })}
        </div>
      )}

      {/* Compact Top-Right Camera & Label Bar (Solid opaque, no backdrop-blur) */}
      <div className="absolute top-3 right-3 flex flex-wrap items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2 py-1.5 shadow-sm">
        <Camera className="w-3.5 h-3.5 text-slate-500 ml-1" />
        {(
          [
            {k: 'iso', label: '3D'},
            {k: 'front', label: 'Trước'},
            {k: 'top', label: 'Trên'},
            {k: 'detail', label: 'Cận cảnh'},
          ] as Array<{k: CameraPresetKey; label: string}>
        ).map((preset) => (
          <button
            key={preset.k}
            type="button"
            onClick={() => applyCameraPreset(preset.k)}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition ${
              activePreset === preset.k
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <span className="h-4 w-px bg-slate-200 mx-0.5" />
        <button
          type="button"
          onClick={() =>
            setLabelMode((prev) => (prev === 'all' ? 'selected' : prev === 'selected' ? 'off' : 'all'))
          }
          title="Đổi chế độ hiển thị nhãn 3D"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
        >
          {labelMode === 'off' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{labelMode === 'all' ? 'Nhãn: Tất cả' : labelMode === 'selected' ? 'Nhãn: Đang chọn' : 'Ẩn nhãn'}</span>
        </button>
        <button
          type="button"
          onClick={() => applyCameraPreset('iso')}
          title="Đặt lại góc nhìn"
          className="p-1 rounded-lg text-slate-600 hover:bg-slate-100"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Collapsible Bottom Control Dock (Never covers center 3D model) */}
      {sceneData.controls.length > 0 && (
        <div className="absolute bottom-3 left-3 right-3 flex justify-center pointer-events-none">
          <div className="pointer-events-auto bg-white border border-slate-200 rounded-xl shadow-md px-3 py-2 max-w-2xl w-full">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                <span>Điều khiển mô phỏng 3D</span>
                <span className="text-[11px] font-normal text-slate-500 hidden sm:inline">
                  · Kéo chuột để xoay · Cuộn để phóng to · Bấm vật thể để nghe phát âm
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDockExpanded((v) => !v)}
                className="p-1 rounded-md text-slate-500 hover:bg-slate-100"
                aria-label="Thu gọn/mở bảng điều khiển"
              >
                {dockExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>

            {dockExpanded && (
              <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
                {sceneData.controls.map((ctrl) => {
                  const val = controlValues[ctrl.id] ?? ctrl.defaultValue;
                  if (ctrl.kind === 'slider') {
                    return (
                      <label key={ctrl.id} className="flex items-center gap-2 text-xs text-slate-700 flex-1 min-w-[180px]">
                        <span className="font-semibold whitespace-nowrap">{ctrl.labelVi}:</span>
                        <input
                          type="range"
                          min={ctrl.min ?? 0}
                          max={ctrl.max ?? 100}
                          step={ctrl.step ?? 5}
                          value={Number(val)}
                          onChange={(e) =>
                            setControlValues((prev) => ({...prev, [ctrl.id]: Number(e.target.value)}))
                          }
                          className="flex-1 accent-blue-600"
                        />
                        <span className="font-bold text-blue-700 w-12 text-right">
                          {val}
                          {ctrl.unit ?? ''}
                        </span>
                      </label>
                    );
                  }
                  if (ctrl.kind === 'toggle') {
                    const checked = Boolean(val);
                    return (
                      <button
                        key={ctrl.id}
                        type="button"
                        onClick={() => {
                          playLabSoundEffect('click');
                          setControlValues((prev) => ({...prev, [ctrl.id]: !checked}));
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                          checked
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {ctrl.labelVi}: {checked ? 'Bật' : 'Tắt'}
                      </button>
                    );
                  }
                  return (
                    <div key={ctrl.id} className="flex items-center gap-1.5 text-xs">
                      <span className="font-semibold text-slate-700">{ctrl.labelVi}:</span>
                      {(ctrl.modes ?? []).map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => {
                            playLabSoundEffect('click');
                            setControlValues((prev) => ({...prev, [ctrl.id]: m.value}));
                          }}
                          className={`px-2.5 py-1 rounded-lg font-semibold border transition ${
                            val === m.value
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
