import React, {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Hand, Move, RotateCcw} from 'lucide-react';
import {createWorld3DScene} from './SceneManager';
import type {BuiltWorld3DScene, WorldStageProps} from './types';

function detectSoftwareGl(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl =
      (probe.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (probe.getContext('webgl') as WebGLRenderingContext | null);
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
    const isSoft = /swiftshader|llvmpipe|software|mesa|angle.*swiftshader/i.test(rendererStr);
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return isSoft;
  } catch {
    return false;
  }
}

interface ProjectedLabel {
  id: string;
  labelEn: string;
  labelVi: string;
  x: number;
  y: number;
  visible: boolean;
  isMissionTarget: boolean;
  isSelected: boolean;
}

function resolveDropAction(draggableId: string, dropZoneId: string): string | null {
  // Grade 10 Unit 1: Clothes basket -> Washing machine
  if (draggableId === 'clothes_basket' && dropZoneId === 'washing_machine') return 'clothes_load';
  // Grade 10 Unit 2: Park litter -> Sorting bins
  if (draggableId === 'litter_plastic' && dropZoneId === 'bin_recycle') return 'sort_plastic';
  if (draggableId === 'litter_organic' && dropZoneId === 'bin_organic') return 'sort_organic';
  if (draggableId === 'litter_can' && dropZoneId === 'bin_recycle') return 'sort_can';
  // Grade 10 Unit 5: Workbench components -> Device base
  if (draggableId === 'part_battery' && dropZoneId === 'device_base') return 'mount_battery';
  if (draggableId === 'part_chip' && dropZoneId === 'device_base') return 'mount_chip';
  if (draggableId === 'part_sensor' && dropZoneId === 'device_base') return 'mount_sensor';
  return null;
}

export const World3DStage: React.FC<WorldStageProps> = ({
  worldDef,
  quality,
  paused,
  cameraMode,
  showLabels,
  selectedObjectId,
  activeMission,
  worldState,
  onSelectObject,
  onExecuteAction,
  onSceneReady,
  onCharacterMove,
  onSwitchTo2D,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [labels, setLabels] = useState<ProjectedLabel[]>([]);
  const [resetCamTick, setResetCamTick] = useState(0);

  // Refs synced with latest React props so RAF never goes stale
  const propsRef = useRef({
    paused,
    cameraMode,
    showLabels,
    selectedObjectId,
    activeMission,
    worldState,
    onSelectObject,
    onExecuteAction,
    onCharacterMove,
  });
  propsRef.current = {
    paused,
    cameraMode,
    showLabels,
    selectedObjectId,
    activeMission,
    worldState,
    onSelectObject,
    onExecuteAction,
    onCharacterMove,
  };

  // Virtual D-pad state for tablet/interactive whiteboards
  const dpadRef = useRef({up: false, down: false, left: false, right: false});

  // Trigger camera damp transition when cameraMode or resetCamTick changes
  const camTransitionRef = useRef<{
    active: boolean;
    pos: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    active: false,
    pos: new THREE.Vector3(...worldDef.initialCamera.overview.pos),
    target: new THREE.Vector3(...worldDef.initialCamera.overview.target),
  });

  useEffect(() => {
    const preset =
      cameraMode === 'closeup'
        ? worldDef.initialCamera.closeup
        : cameraMode === 'top'
          ? worldDef.initialCamera.top
          : worldDef.initialCamera.overview;
    camTransitionRef.current = {
      active: cameraMode !== 'character',
      pos: new THREE.Vector3(...preset.pos),
      target: new THREE.Vector3(...preset.target),
    };
  }, [cameraMode, resetCamTick, worldDef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setWebglError(null);
    const isSoftwareGl = detectSoftwareGl();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl && quality !== 'eco',
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglError('Trình duyệt hiện không hỗ trợ WebGL 3D. Bạn có thể chuyển ngay sang chế độ 2D tương tác.');
      return;
    }

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(320, container.clientHeight);
    const rawDpr = window.devicePixelRatio || 1;
    const dpr = isSoftwareGl
      ? 1
      : quality === 'eco'
        ? 1
        : quality === 'standard'
          ? Math.min(rawDpr, 1.5)
          : Math.min(rawDpr, 2);

    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const enableShadows = !isSoftwareGl && quality !== 'eco';
    renderer.shadowMap.enabled = enableShadows;
    if (enableShadows) {
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    container.innerHTML = '';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    // Scene & Atmosphere
    const scene = new THREE.Scene();
    const isDarkStudio = worldDef.unitId === 'gs10-u3' || worldDef.unitId === 'gs11-u5';
    const bgColorHex =
      worldDef.environment === 'outdoor'
        ? '#c7e3fa'
        : isDarkStudio
          ? '#0f172a'
          : '#e2eaf2';
    scene.background = new THREE.Color(bgColorHex);
    if (worldDef.environment === 'outdoor') {
      scene.fog = new THREE.Fog('#c7e3fa', 24, 56);
    }

    // Studio IBL via RoomEnvironment (procedural, zero external HDR)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = isDarkStudio ? 0.55 : 0.72;

    // 3-Point Calibrated Daylight / Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(
      isDarkStudio ? '#bae6fd' : '#f0f9ff',
      isDarkStudio ? '#1e293b' : '#64748b',
      isDarkStudio ? 0.75 : 0.95
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#fff6e5', isDarkStudio ? 1.55 : 1.95);
    keyLight.position.set(11, 16, 10);
    if (enableShadows) {
      keyLight.castShadow = true;
      const shadowSize = quality === 'high' ? 2048 : 1024;
      keyLight.shadow.mapSize.set(shadowSize, shadowSize);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 48;
      keyLight.shadow.camera.left = -15;
      keyLight.shadow.camera.right = 15;
      keyLight.shadow.camera.top = 15;
      keyLight.shadow.camera.bottom = -15;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.025;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#93c5fd', 0.45);
    rimLight.position.set(-10, 8, -11);
    scene.add(rimLight);

    // Camera & OrbitControls
    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 140);
    camera.position.set(...worldDef.initialCamera.overview.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...worldDef.initialCamera.overview.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.475;
    controls.minDistance = 2.6;
    controls.maxDistance = 30;
    controls.update();

    const onControlStart = () => {
      camTransitionRef.current.active = false;
    };
    controls.addEventListener('start', onControlStart);

    // Build Unit-Specific 3D World
    const builtScene: BuiltWorld3DScene = createWorld3DScene(worldDef.unitId);
    scene.add(builtScene.root);
    onSceneReady(builtScene);

    // Selection indicator ring + Drop-zone target beacon ring
    const selRingGeo = new THREE.RingGeometry(0.65, 0.82, 32);
    const selRingMat = new THREE.MeshBasicMaterial({
      color: '#2563eb',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const selRing = new THREE.Mesh(selRingGeo, selRingMat);
    selRing.rotation.x = -Math.PI / 2;
    selRing.visible = false;
    scene.add(selRing);

    const dropRingGeo = new THREE.RingGeometry(0.7, 0.92, 32);
    const dropRingMat = new THREE.MeshBasicMaterial({
      color: '#10b981',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const dropRing = new THREE.Mesh(dropRingGeo, dropRingMat);
    dropRing.rotation.x = -Math.PI / 2;
    dropRing.visible = false;
    scene.add(dropRing);

    // Raycaster & Drag/Drop state
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const dragHitPoint = new THREE.Vector3();
    let pointerDownPos = {x: 0, y: 0};
    let activeDragObj: THREE.Object3D | null = null;
    let activeDragId: string | null = null;
    let activeDragOrigin = new THREE.Vector3();

    // Character movement keyboard state
    const keysDown = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isEditable = (e.target as HTMLElement | null)?.isContentEditable;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isEditable) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        if (worldDef.hasCharacter) {
          keysDown.add(k);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const setPointerFromEvent = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const findInteractiveRoot = (obj: THREE.Object3D | null): {id: string; draggable: boolean; rootObj: THREE.Object3D} | null => {
      let cur: THREE.Object3D | null = obj;
      while (cur) {
        if (cur.userData?.objectId) {
          const id = String(cur.userData.objectId);
          const draggable = Boolean(cur.userData.draggable);
          // Locate top-level draggable root if draggable
          let topObj = cur;
          if (draggable) {
            const match = builtScene.draggables.find((d) => d.userData.objectId === id);
            if (match) topObj = match;
          }
          return {id, draggable, rootObj: topObj};
        }
        cur = cur.parent;
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = {x: e.clientX, y: e.clientY};
      setPointerFromEvent(e);
      raycaster.setFromCamera(pointerNdc, camera);

      if (builtScene.draggables.length > 0) {
        const dragHits = raycaster.intersectObjects(builtScene.draggables, true);
        if (dragHits.length > 0) {
          const hitInfo = findInteractiveRoot(dragHits[0].object);
          if (hitInfo && hitInfo.draggable && hitInfo.rootObj.visible) {
            activeDragObj = hitInfo.rootObj;
            activeDragId = hitInfo.id;
            activeDragOrigin.copy(hitInfo.rootObj.position);
            dragPlane.constant = -Math.max(0.5, activeDragOrigin.y);
            controls.enabled = false;
            setDraggingId(hitInfo.id);
            propsRef.current.onSelectObject(hitInfo.id);

            // Show highlight on matching drop zone
            const matchingZone = builtScene.dropZones.find((z) => z.accepts.includes(hitInfo.id));
            if (matchingZone) {
              dropRing.position.set(matchingZone.position.x, 0.08, matchingZone.position.z);
              dropRing.visible = true;
            }
            return;
          }
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      setPointerFromEvent(e);
      raycaster.setFromCamera(pointerNdc, camera);

      if (activeDragObj && activeDragId) {
        if (raycaster.ray.intersectPlane(dragPlane, dragHitPoint)) {
          activeDragObj.position.set(
            THREE.MathUtils.clamp(dragHitPoint.x, -8, 8),
            Math.max(0.65, activeDragOrigin.y + 0.45),
            THREE.MathUtils.clamp(dragHitPoint.z, -7, 7)
          );
        }
        renderer.domElement.style.cursor = 'grabbing';
        return;
      }

      const hits = raycaster.intersectObjects(builtScene.interactables, true);
      if (hits.length > 0) {
        const hitInfo = findInteractiveRoot(hits[0].object);
        if (hitInfo) {
          setHoveredId(hitInfo.id);
          renderer.domElement.style.cursor = hitInfo.draggable ? 'grab' : 'pointer';
          return;
        }
      }
      setHoveredId(null);
      renderer.domElement.style.cursor = 'default';
    };

    const onPointerUp = (e: PointerEvent) => {
      if (activeDragObj && activeDragId) {
        const draggedId = activeDragId;
        const droppedPos = activeDragObj.position.clone();
        let matchedZoneId: string | null = null;

        for (const zone of builtScene.dropZones) {
          if (!zone.accepts.includes(draggedId)) continue;
          const distXZ = Math.hypot(droppedPos.x - zone.position.x, droppedPos.z - zone.position.z);
          if (distXZ <= zone.radius + 0.9) {
            matchedZoneId = zone.id;
            break;
          }
        }

        // Restore visual position cleanly (scene state update will hide/snap as needed)
        activeDragObj.position.copy(activeDragOrigin);
        activeDragObj = null;
        activeDragId = null;
        dropRing.visible = false;
        controls.enabled = true;
        setDraggingId(null);

        if (matchedZoneId) {
          const actionId = resolveDropAction(draggedId, matchedZoneId);
          if (actionId) {
            propsRef.current.onExecuteAction(actionId, {
              objectId: draggedId,
              targetId: matchedZoneId,
            });
          }
        }
        return;
      }

      // Standard click detection (ignore orbit drags)
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return;

      setPointerFromEvent(e);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(builtScene.interactables, true);
      if (hits.length > 0) {
        const hitInfo = findInteractiveRoot(hits[0].object);
        if (hitInfo) {
          propsRef.current.onSelectObject(hitInfo.id);
        }
      }
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('Ngữ cảnh đồ họa WebGL bị gián đoạn tạm thời. Bạn có thể chuyển sang chế độ 2D hoặc tải lại cảnh.');
    };
    domEl.addEventListener('webglcontextlost', onContextLost);

    // ResizeObserver for crisp responsive viewport (including fullscreen)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cw = Math.max(280, Math.floor(entry.contentRect.width));
        const ch = Math.max(260, Math.floor(entry.contentRect.height));
        camera.aspect = cw / ch;
        camera.updateProjectionMatrix();
        renderer.setSize(cw, ch);
      }
    });
    resizeObserver.observe(container);

    // Software GL pacing helper (prevents GPU queue backup on SwiftShader/llvmpipe)
    const glCtx = renderer.getContext();
    const afterDraw = (cb: () => void) => {
      if (!isSoftwareGl) {
        rafId = requestAnimationFrame(cb);
        return;
      }
      const gl2 = glCtx as WebGL2RenderingContext;
      if (typeof gl2.fenceSync === 'function') {
        const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl2.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl2.deleteSync(sync);
            return;
          }
          const status = sync ? gl2.clientWaitSync(sync, 0, 0) : gl2.ALREADY_SIGNALED;
          if (status === gl2.ALREADY_SIGNALED || status === gl2.CONDITION_SATISFIED) {
            if (sync) gl2.deleteSync(sync);
            timeoutId = window.setTimeout(() => {
              if (!disposed) rafId = requestAnimationFrame(cb);
            }, 65);
          } else {
            timeoutId = window.setTimeout(poll, 20);
          }
        };
        poll();
      } else {
        timeoutId = window.setTimeout(() => {
          if (!disposed) rafId = requestAnimationFrame(cb);
        }, 85);
      }
    };

    const clock = new THREE.Clock();
    let elapsed = 0;
    let labelAccum = 0;
    let walkCycle = 0;
    let rafId = 0;
    let timeoutId = 0;
    let disposed = false;
    const tempVec = new THREE.Vector3();

    const checkObstacleBlocked = (nx: number, nz: number): boolean => {
      const margin = 0.42;
      for (const obs of builtScene.obstacles) {
        if (nx > obs.minX - margin && nx < obs.maxX + margin && nz > obs.minZ - margin && nz < obs.maxZ + margin) {
          return true;
        }
      }
      return false;
    };

    const tick = () => {
      if (disposed) return;
      const rawDelta = clock.getDelta();
      const delta = Math.min(rawDelta, 0.05);
      const {
        paused: isPaused,
        cameraMode: curCamMode,
        showLabels: isShowLabels,
        selectedObjectId: curSelId,
        activeMission: curMission,
        worldState: curState,
      } = propsRef.current;

      if (!isPaused) {
        elapsed += delta;
      }

      // 1. Character locomotion (WASD / Arrows / D-Pad)
      if (builtScene.characterGroup && !isPaused) {
        const moveX =
          (keysDown.has('d') || keysDown.has('arrowright') || dpadRef.current.right ? 1 : 0) -
          (keysDown.has('a') || keysDown.has('arrowleft') || dpadRef.current.left ? 1 : 0);
        const moveZ =
          (keysDown.has('s') || keysDown.has('arrowdown') || dpadRef.current.down ? 1 : 0) -
          (keysDown.has('w') || keysDown.has('arrowup') || dpadRef.current.up ? 1 : 0);

        if (moveX !== 0 || moveZ !== 0) {
          const speed = 4.2;
          const len = Math.hypot(moveX, moveZ);
          const dx = (moveX / len) * speed * delta;
          const dz = (moveZ / len) * speed * delta;
          const curX = builtScene.characterGroup.position.x;
          const curZ = builtScene.characterGroup.position.z;
          const nextX = THREE.MathUtils.clamp(curX + dx, builtScene.walkBounds.minX, builtScene.walkBounds.maxX);
          const nextZ = THREE.MathUtils.clamp(curZ + dz, builtScene.walkBounds.minZ, builtScene.walkBounds.maxZ);

          if (!checkObstacleBlocked(nextX, curZ)) builtScene.characterGroup.position.x = nextX;
          if (!checkObstacleBlocked(builtScene.characterGroup.position.x, nextZ)) builtScene.characterGroup.position.z = nextZ;

          const targetAngle = Math.atan2(dx, dz);
          builtScene.characterGroup.rotation.y = targetAngle;

          walkCycle += delta * 9.5;
          if (builtScene.characterLimbs) {
            builtScene.characterLimbs.leftLeg.rotation.x = Math.sin(walkCycle) * 0.55;
            builtScene.characterLimbs.rightLeg.rotation.x = -Math.sin(walkCycle) * 0.55;
            builtScene.characterLimbs.leftArm.rotation.x = -Math.sin(walkCycle) * 0.45;
            builtScene.characterLimbs.rightArm.rotation.x = Math.sin(walkCycle) * 0.45;
          }
          if (propsRef.current.onCharacterMove) {
            propsRef.current.onCharacterMove([
              builtScene.characterGroup.position.x,
              builtScene.characterGroup.position.y,
              builtScene.characterGroup.position.z,
            ]);
          }
        } else if (builtScene.characterLimbs) {
          const k = Math.min(1, delta * 8);
          builtScene.characterLimbs.leftLeg.rotation.x = THREE.MathUtils.lerp(builtScene.characterLimbs.leftLeg.rotation.x, 0, k);
          builtScene.characterLimbs.rightLeg.rotation.x = THREE.MathUtils.lerp(builtScene.characterLimbs.rightLeg.rotation.x, 0, k);
          builtScene.characterLimbs.leftArm.rotation.x = THREE.MathUtils.lerp(builtScene.characterLimbs.leftArm.rotation.x, 0, k);
          builtScene.characterLimbs.rightArm.rotation.x = THREE.MathUtils.lerp(builtScene.characterLimbs.rightArm.rotation.x, 0, k);
        }

        // Character chase camera mode
        if (curCamMode === 'character') {
          const cp = builtScene.characterGroup.position;
          const desiredPos = new THREE.Vector3(cp.x, cp.y + 3.2, cp.z + 5.2);
          const desiredTarget = new THREE.Vector3(cp.x, cp.y + 1.2, cp.z);
          camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredPos.x, 4.5, delta);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredPos.y, 4.5, delta);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredPos.z, 4.5, delta);
          controls.target.x = THREE.MathUtils.damp(controls.target.x, desiredTarget.x, 5.5, delta);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, desiredTarget.y, 5.5, delta);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, desiredTarget.z, 5.5, delta);
        }
      }

      // 2. Smooth Camera Preset Transition
      if (camTransitionRef.current.active) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, camTransitionRef.current.pos.x, 5.5, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, camTransitionRef.current.pos.y, 5.5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, camTransitionRef.current.pos.z, 5.5, delta);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, camTransitionRef.current.target.x, 5.5, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, camTransitionRef.current.target.y, 5.5, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, camTransitionRef.current.target.z, 5.5, delta);
        if (
          camera.position.distanceTo(camTransitionRef.current.pos) < 0.05 &&
          controls.target.distanceTo(camTransitionRef.current.target) < 0.05
        ) {
          camTransitionRef.current.active = false;
        }
      }

      // 3. Selection ring placement
      if (curSelId && builtScene.labelAnchors.has(curSelId)) {
        const anchor = builtScene.labelAnchors.get(curSelId)!;
        selRing.position.set(anchor.x, 0.06, anchor.z);
        selRing.visible = true;
        const scalePulse = 1 + Math.sin(elapsed * 4) * 0.08;
        selRing.scale.set(scalePulse, scalePulse, 1);
      } else {
        selRing.visible = false;
      }

      // 4. Unit-specific animation update
      builtScene.update(elapsed, delta, curState, isPaused);

      controls.update();
      renderer.render(scene, camera);

      // 5. Anti-overlap 3D-to-2D projected floating labels (throttled ~15Hz for zero jank)
      labelAccum += delta;
      if (labelAccum >= 0.07) {
        labelAccum = 0;
        if (!isShowLabels) {
          setLabels((prev) => (prev.length > 0 ? [] : prev));
        } else {
          const cw = renderer.domElement.clientWidth;
          const ch = renderer.domElement.clientHeight;
          const placed: Array<{x: number; y: number}> = [];
          const nextLabels: ProjectedLabel[] = [];

          for (const meta of worldDef.objects) {
            const anchor = builtScene.labelAnchors.get(meta.id);
            if (!anchor) continue;
            tempVec.copy(anchor).project(camera);
            if (tempVec.z > 1) continue;
            let sx = (tempVec.x * 0.5 + 0.5) * cw;
            let sy = (-tempVec.y * 0.5 + 0.5) * ch;

            // Clamp inside safe viewport bounds
            sx = THREE.MathUtils.clamp(sx, 86, cw - 86);
            sy = THREE.MathUtils.clamp(sy, 44, ch - 52);

            // Greedy anti-overlap vertical offset
            for (const p of placed) {
              if (Math.abs(sx - p.x) < 148 && Math.abs(sy - p.y) < 34) {
                sy = Math.max(44, sy - 38);
              }
            }
            placed.push({x: sx, y: sy});

            nextLabels.push({
              id: meta.id,
              labelEn: meta.labelEn,
              labelVi: meta.labelVi,
              x: Math.round(sx),
              y: Math.round(sy),
              visible: true,
              isMissionTarget: Boolean(curMission?.targetObjectIds.includes(meta.id)),
              isSelected: curSelId === meta.id,
            });
          }
          setLabels(nextLabels);
        }
      }

      afterDraw(tick);
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.dispose();
      domEl.removeEventListener('pointerdown', onPointerDown);
      domEl.removeEventListener('webglcontextlost', onContextLost);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      selRingGeo.dispose();
      selRingMat.dispose();
      dropRingGeo.dispose();
      dropRingMat.dispose();
      builtScene.dispose();
      envRT.dispose();
      roomEnv.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
    };
  }, [worldDef.unitId, quality]);

  if (webglError) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="max-w-lg text-[15px] font-semibold text-amber-900">{webglError}</p>
        {onSwitchTo2D && (
          <button
            type="button"
            onClick={onSwitchTo2D}
            className="mt-4 rounded-lg bg-blue-600 px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-blue-700"
          >
            Chuyển sang chế độ 2D tương tác ngay
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full select-none overflow-hidden rounded-xl bg-slate-900">
      <div ref={containerRef} className="h-full w-full" />

      {/* Crisp anti-overlap projected 3D labels (zero backdrop-blur over WebGL) */}
      {showLabels &&
        labels.map((lbl) => (
          <button
            key={lbl.id}
            type="button"
            onClick={() => onSelectObject(lbl.id)}
            style={{
              left: `${lbl.x}px`,
              top: `${lbl.y}px`,
              transform: 'translate(-50%, -100%)',
            }}
            className={`absolute z-10 max-w-[190px] truncate rounded-md border px-2.5 py-1 text-left text-[13px] font-semibold shadow-md transition-colors ${
              lbl.isSelected
                ? 'border-blue-600 bg-blue-600 text-white'
                : lbl.isMissionTarget
                  ? 'border-amber-500 bg-amber-50 text-amber-950 hover:bg-amber-100'
                  : hoveredId === lbl.id
                    ? 'border-blue-500 bg-white text-blue-900'
                    : 'border-slate-300 bg-white/95 text-slate-800 hover:border-blue-400'
            }`}
            title={`${lbl.labelEn} — ${lbl.labelVi}`}
          >
            {lbl.labelEn}
          </button>
        ))}

      {/* Active Drag-Drop Guidance Banner */}
      {draggingId && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-lg border border-emerald-600 bg-emerald-700 px-4 py-2 text-[14px] font-semibold text-white shadow-lg">
          <span className="inline-flex items-center gap-2">
            <Hand className="h-4 w-4" />
            Kéo vật thả vào vòng tròn màu xanh lá trên đích đến!
          </span>
        </div>
      )}

      {/* Subtle Bottom-Left Interaction Hint + Reset Camera Button */}
      <div className="absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setResetCamTick((t) => t + 1)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          title="Đặt lại góc nhìn ban đầu"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Đặt lại góc nhìn
        </button>
        {worldDef.hasDragDrop && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[13px] font-medium text-emerald-900 shadow-sm">
            <Hand className="h-3.5 w-3.5 text-emerald-700" />
            Kéo thả vật 3D hoặc bấm chọn thao tác
          </span>
        )}
      </div>

      {/* Compact On-Screen Character Movement D-Pad for Walkable Worlds */}
      {worldDef.hasCharacter && (
        <div className="absolute bottom-3 right-3 z-20 flex flex-col items-center gap-1 rounded-xl border border-slate-300 bg-white/95 p-2 shadow-md">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
            <Move className="h-3 w-3" />
            WASD / Mũi tên
          </div>
          <button
            type="button"
            onPointerDown={() => (dpadRef.current.up = true)}
            onPointerUp={() => (dpadRef.current.up = false)}
            onPointerLeave={() => (dpadRef.current.up = false)}
            aria-label="Đi tới"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-slate-50 text-slate-700 hover:bg-blue-50 active:bg-blue-600 active:text-white"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onPointerDown={() => (dpadRef.current.left = true)}
              onPointerUp={() => (dpadRef.current.left = false)}
              onPointerLeave={() => (dpadRef.current.left = false)}
              aria-label="Sang trái"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-slate-50 text-slate-700 hover:bg-blue-50 active:bg-blue-600 active:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onPointerDown={() => (dpadRef.current.down = true)}
              onPointerUp={() => (dpadRef.current.down = false)}
              onPointerLeave={() => (dpadRef.current.down = false)}
              aria-label="Đi lùi"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-slate-50 text-slate-700 hover:bg-blue-50 active:bg-blue-600 active:text-white"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onPointerDown={() => (dpadRef.current.right = true)}
              onPointerUp={() => (dpadRef.current.right = false)}
              onPointerLeave={() => (dpadRef.current.right = false)}
              aria-label="Sang phải"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-slate-50 text-slate-700 hover:bg-blue-50 active:bg-blue-600 active:text-white"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
