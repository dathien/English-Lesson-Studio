import * as THREE from 'three';
import type {ArticulatorPose, InteractiveObject, SimulationScene3D} from '../../../types/interactiveLab';

export interface BuiltScene3D {
  root: THREE.Group;
  interactables: THREE.Object3D[];
  anchors: Map<string, THREE.Vector3>;
  update: (elapsed: number, controls: Record<string, number | boolean | string>) => void;
  dispose: () => void;
}

export interface BuiltVocalTract3D {
  root: THREE.Group;
  labelAnchors: Record<string, THREE.Vector3>;
  update: (elapsed: number, pose: ArticulatorPose, slowMotion: boolean) => void;
  dispose: () => void;
}

function createProceduralCanvasTexture(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  w = 256,
  h = 256
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeFloorTexture(base: string, grid: string): THREE.CanvasTexture {
  return createProceduralCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = grid;
    ctx.lineWidth = 2;
    for (let i = 0; i <= w; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(w, i);
      ctx.stroke();
    }
  });
}

function makeFacadeTexture(wallColor: string, windowColor: string): THREE.CanvasTexture {
  return createProceduralCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = wallColor;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = windowColor;
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 4; c++) {
        ctx.fillRect(18 + c * 58, 16 + r * 40, 34, 22);
      }
    }
  });
}

function tagObject(group: THREE.Object3D, objectId: string): THREE.Object3D {
  group.userData.objectId = objectId;
  group.traverse((child) => {
    child.userData.objectId = objectId;
  });
  return group;
}

function makeMat(
  color: string | number,
  roughness = 0.65,
  metalness = 0.08,
  emissive?: string | number,
  emissiveIntensity = 0
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    ...(emissive !== undefined ? {emissive, emissiveIntensity} : {}),
  });
}

function makeTree(scale = 1, canopyHex = '#2f855a'): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11 * scale, 0.17 * scale, 0.9 * scale, 8),
    makeMat('#6b4423', 0.9, 0.02)
  );
  trunk.position.y = 0.45 * scale;
  trunk.castShadow = true;
  g.add(trunk);

  const foliage1 = new THREE.Mesh(
    new THREE.ConeGeometry(0.58 * scale, 1.15 * scale, 9),
    makeMat(canopyHex, 0.85, 0.02)
  );
  foliage1.position.y = 1.2 * scale;
  foliage1.castShadow = true;
  g.add(foliage1);

  const foliage2 = new THREE.Mesh(
    new THREE.ConeGeometry(0.42 * scale, 0.85 * scale, 9),
    makeMat('#38a169', 0.82, 0.02)
  );
  foliage2.position.y = 1.72 * scale;
  foliage2.castShadow = true;
  g.add(foliage2);
  return g;
}

function makeBuilding(w: number, h: number, d: number, wallHex: string, winHex = '#bae6fd'): THREE.Group {
  const g = new THREE.Group();
  const tex = makeFacadeTexture(wallHex, winHex);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({map: tex, roughness: 0.55, metalness: 0.15})
  );
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const roofRim = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.08, 0.12, d + 0.08),
    makeMat('#334155', 0.6, 0.25)
  );
  roofRim.position.y = h + 0.06;
  g.add(roofRim);
  return g;
}

function makeSolarArray(accentHex = '#0284c7'): THREE.Group {
  const g = new THREE.Group();
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.7, 8), makeMat('#64748b', 0.4, 0.7));
  stand.position.y = 0.35;
  g.add(stand);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.9), makeMat('#1e293b', 0.35, 0.65));
  frame.position.set(0, 0.75, 0);
  frame.rotation.x = 0.42;
  frame.castShadow = true;
  g.add(frame);

  const cells = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.04, 0.78),
    makeMat(accentHex, 0.22, 0.5, '#0369a1', 0.2)
  );
  cells.position.set(0, 0.78, 0);
  cells.rotation.x = 0.42;
  g.add(cells);
  return g;
}

function makeWindTurbine(): {group: THREE.Group; rotor: THREE.Group} {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.14, 2.6, 12), makeMat('#f1f5f9', 0.35, 0.25));
  pole.position.y = 1.3;
  pole.castShadow = true;
  group.add(pole);

  const nacelle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.42), makeMat('#e2e8f0', 0.4, 0.3));
  nacelle.position.set(0, 2.6, 0);
  group.add(nacelle);

  const rotor = new THREE.Group();
  rotor.position.set(0, 2.6, 0.24);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), makeMat('#cbd5e1', 0.3, 0.5));
  rotor.add(hub);

  for (let i = 0; i < 3; i++) {
    const bladeWrap = new THREE.Group();
    bladeWrap.rotation.z = (i * Math.PI * 2) / 3;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.95, 0.03), makeMat('#f8fafc', 0.3, 0.2));
    blade.position.y = 0.5;
    blade.castShadow = true;
    bladeWrap.add(blade);
    rotor.add(bladeWrap);
  }
  group.add(rotor);
  return {group, rotor};
}

function makeInteractivePropForObject(
  obj: InteractiveObject,
  sceneKind: SimulationScene3D['sceneKind'],
  index: number
): THREE.Group {
  const g = new THREE.Group();
  const accent = obj.accentHex || '#2563eb';
  const idLower = (obj.id + ' ' + obj.labelEn).toLowerCase();

  // Pick a recognizable composite 3D prop based on semantic label & scene kind
  if (idLower.includes('solar') || idLower.includes('panel') || idLower.includes('roof')) {
    g.add(makeSolarArray(accent));
  } else if (idLower.includes('wind') || idLower.includes('turbine')) {
    const wt = makeWindTurbine();
    wt.group.userData.spinRotor = wt.rotor;
    g.add(wt.group);
  } else if (
    idLower.includes('tree') ||
    idLower.includes('forest') ||
    idLower.includes('park') ||
    idLower.includes('garden') ||
    idLower.includes('mangrove') ||
    idLower.includes('canopy') ||
    idLower.includes('plant')
  ) {
    g.add(makeTree(1.05, accent));
    const t2 = makeTree(0.75, '#15803d');
    t2.position.set(0.45, 0, -0.3);
    g.add(t2);
  } else if (
    idLower.includes('robot') ||
    idLower.includes('ai') ||
    idLower.includes('sensor') ||
    idLower.includes('drone') ||
    idLower.includes('assistant') ||
    idLower.includes('vr')
  ) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.22, 16), makeMat('#334155', 0.4, 0.6));
    base.position.y = 0.11;
    g.add(base);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 0.36), makeMat('#e2e8f0', 0.32, 0.45));
    torso.position.y = 0.58;
    torso.castShadow = true;
    g.add(torso);
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.28, 0.04),
      makeMat(accent, 0.2, 0.3, accent, 0.45)
    );
    screen.position.set(0, 0.62, 0.19);
    g.add(screen);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.34), makeMat('#f8fafc', 0.25, 0.4));
    head.position.y = 1.14;
    g.add(head);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.12, 0.04),
      makeMat('#06b6d4', 0.15, 0.5, '#06b6d4', 0.65)
    );
    visor.position.set(0, 1.15, 0.18);
    g.add(visor);
  } else if (
    idLower.includes('guitar') ||
    idLower.includes('piano') ||
    idLower.includes('drum') ||
    idLower.includes('stage') ||
    idLower.includes('mic') ||
    idLower.includes('music') ||
    idLower.includes('dan') ||
    idLower.includes('violin')
  ) {
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.25, 16), makeMat('#1e293b', 0.5, 0.3));
    plinth.position.y = 0.125;
    g.add(plinth);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.38), makeMat(accent, 0.35, 0.35));
    body.position.y = 0.55;
    body.castShadow = true;
    g.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 10), makeMat('#f8fafc', 0.3, 0.6));
    neck.position.set(0, 1.0, 0);
    g.add(neck);
    const speakerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.04, 10, 20),
      makeMat('#fbbf24', 0.25, 0.7, '#f59e0b', 0.25)
    );
    speakerRing.position.set(0, 0.55, 0.2);
    g.add(speakerRing);
  } else if (
    idLower.includes('globe') ||
    idLower.includes('earth') ||
    idLower.includes('un') ||
    idLower.includes('asean') ||
    idLower.includes('world') ||
    idLower.includes('pavilion') ||
    idLower.includes('culture')
  ) {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.46, 0.35, 16), makeMat('#334155', 0.45, 0.55));
    stand.position.y = 0.175;
    g.add(stand);
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 22, 18),
      makeMat(accent, 0.35, 0.15, accent, 0.12)
    );
    orb.position.y = 0.95;
    orb.castShadow = true;
    g.add(orb);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.035, 10, 32), makeMat('#f59e0b', 0.3, 0.7));
    ring.position.y = 0.95;
    ring.rotation.x = Math.PI / 3;
    g.add(ring);
  } else if (
    idLower.includes('tower') ||
    idLower.includes('building') ||
    idLower.includes('hospital') ||
    idLower.includes('school') ||
    idLower.includes('hub') ||
    idLower.includes('museum') ||
    idLower.includes('temple') ||
    idLower.includes('heritage') ||
    idLower.includes('apartment') ||
    idLower.includes('booth') ||
    idLower.includes('studio') ||
    idLower.includes('news') ||
    idLower.includes('city')
  ) {
    const b = makeBuilding(0.95, 1.35 + (index % 3) * 0.35, 0.85, accent, '#e0f2fe');
    g.add(b);
  } else if (
    idLower.includes('animal') ||
    idLower.includes('tiger') ||
    idLower.includes('elephant') ||
    idLower.includes('bird') ||
    idLower.includes('deer') ||
    idLower.includes('rhino') ||
    idLower.includes('turtle') ||
    idLower.includes('wildlife') ||
    idLower.includes('coral') ||
    idLower.includes('fish')
  ) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.38, 0.36), makeMat(accent, 0.72, 0.05));
    body.position.y = 0.45;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.28), makeMat(accent, 0.7, 0.05));
    head.position.set(0.46, 0.62, 0);
    g.add(head);
    for (const [lx, lz] of [
      [-0.25, 0.12],
      [-0.25, -0.12],
      [0.25, 0.12],
      [0.25, -0.12],
    ]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.34, 8), makeMat('#475569', 0.8, 0.05));
      leg.position.set(lx, 0.17, lz);
      g.add(leg);
    }
  } else {
    // Rich modular interactive station / room furniture / exhibit kiosk
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.24, 0.85), makeMat('#e2e8f0', 0.6, 0.15));
    base.position.y = 0.12;
    base.receiveShadow = true;
    base.castShadow = true;
    g.add(base);

    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.58, 0.62), makeMat(accent, 0.45, 0.2));
    upper.position.y = 0.53;
    upper.castShadow = true;
    g.add(upper);

    const accentTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, 0.26, 12),
      makeMat('#f8fafc', 0.35, 0.3, accent, 0.18)
    );
    accentTop.position.y = 0.95;
    g.add(accentTop);
  }

  // Subtle ground halo ring to signify clickability cleanly without fake neon clutter
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.52, 0.62, 24),
    new THREE.MeshBasicMaterial({color: accent, side: THREE.DoubleSide, transparent: true, opacity: 0.45})
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.025;
  g.add(halo);

  // Position using pos3d or clean radial layout
  const angle = (index / Math.max(1, 6)) * Math.PI * 2;
  const fallbackX = Math.cos(angle) * 2.5;
  const fallbackZ = Math.sin(angle) * 2.1;
  const [px, py, pz] = obj.pos3d ?? [fallbackX, 0, fallbackZ];
  g.position.set(px, Math.max(0, py * 0.25), pz);

  // Slight visual cue for sceneKind indoor vs outdoor
  if (sceneKind === 'g11_u5_greenhouse_effect') {
    g.scale.setScalar(0.92);
  }

  tagObject(g, obj.id);
  return g;
}

export function buildSimulationScene3D(sceneData: SimulationScene3D): BuiltScene3D {
  const root = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const anchors = new Map<string, THREE.Vector3>();
  const animatedRotors: THREE.Object3D[] = [];
  const animatedFloaters: Array<{obj: THREE.Object3D; baseY: number; phase: number}> = [];
  const dynamicMeshes: Record<string, THREE.Object3D> = {};

  // 1. Ground / Stage platform tailored to environmentType & sceneKind
  const isOutdoor = sceneData.environmentType === 'outdoor';
  const isIndoor = sceneData.environmentType === 'indoor';
  const floorBase = isOutdoor ? '#d9f2e1' : isIndoor ? '#f1efe9' : '#e2e8f0';
  const floorGrid = isOutdoor ? '#b7e4c7' : isIndoor ? '#ddd6c7' : '#cbd5e1';
  const floorTex = makeFloorTexture(floorBase, floorGrid);
  floorTex.repeat.set(6, 6);

  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(5.6, 5.9, 0.32, 48),
    new THREE.MeshStandardMaterial({map: floorTex, roughness: 0.88, metalness: 0.04})
  );
  ground.position.y = -0.16;
  ground.receiveShadow = true;
  root.add(ground);

  // 2. Scene-specific hero centerpiece so every one of the 23 3D scenes looks unique & purposeful
  const centerpiece = new THREE.Group();
  switch (sceneData.sceneKind) {
    case 'g10_u1_house':
    case 'g11_u8_independent_apartment':
    case 'g12_u3_smart_green_house': {
      // Architectural cutaway house shell (2 walls + translucent roof frame)
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.5, 0.16), makeMat('#f8fafc', 0.85, 0.02));
      backWall.position.set(0, 1.25, -2.6);
      backWall.receiveShadow = true;
      centerpiece.add(backWall);

      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.5, 5.2), makeMat('#f1f5f9', 0.85, 0.02));
      sideWall.position.set(-3.1, 1.25, 0);
      sideWall.receiveShadow = true;
      centerpiece.add(sideWall);

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(4.4, 1.15, 4),
        makeMat(sceneData.sceneKind === 'g12_u3_smart_green_house' ? '#0f766e' : '#334155', 0.65, 0.15)
      );
      roof.position.set(0, 3.05, -0.2);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      centerpiece.add(roof);
      dynamicMeshes.roof = roof;
      break;
    }

    case 'g10_u3_music_stage': {
      const stage = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.45, 3.6), makeMat('#1e293b', 0.5, 0.25));
      stage.position.set(0, 0.22, -0.4);
      stage.receiveShadow = true;
      centerpiece.add(stage);

      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(2.6, 0.12, 12, 32, Math.PI),
        makeMat('#3b82f6', 0.35, 0.6, '#2563eb', 0.3)
      );
      arch.position.set(0, 0.45, -1.9);
      centerpiece.add(arch);
      break;
    }

    case 'g10_u7_world_globe':
    case 'g11_u4_asean_expo':
    case 'g12_u2_multicultural_expo': {
      const globe = new THREE.Mesh(
        new THREE.SphereGeometry(1.15, 32, 24),
        makeMat('#1d4ed8', 0.4, 0.15, '#1e40af', 0.15)
      );
      globe.position.set(0, 1.7, 0);
      globe.castShadow = true;
      centerpiece.add(globe);
      animatedRotors.push(globe);

      const equator = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.045, 10, 40), makeMat('#10b981', 0.3, 0.5));
      equator.position.set(0, 1.7, 0);
      equator.rotation.x = Math.PI / 2.6;
      centerpiece.add(equator);
      break;
    }

    case 'g11_u5_greenhouse_effect': {
      const earth = new THREE.Mesh(new THREE.SphereGeometry(1.25, 32, 24), makeMat('#2563eb', 0.5, 0.1));
      earth.position.set(0, 1.55, 0);
      centerpiece.add(earth);
      animatedRotors.push(earth);

      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.62, 28, 22),
        new THREE.MeshStandardMaterial({
          color: '#f97316',
          transparent: true,
          opacity: 0.24,
          roughness: 0.3,
          side: THREE.DoubleSide,
        })
      );
      atmosphere.position.set(0, 1.55, 0);
      centerpiece.add(atmosphere);
      dynamicMeshes.atmosphere = atmosphere;

      const sun = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 20, 16),
        makeMat('#facc15', 0.2, 0.0, '#f59e0b', 0.9)
      );
      sun.position.set(-3.4, 3.2, -1.6);
      centerpiece.add(sun);
      break;
    }

    case 'g11_u3_smart_city':
    case 'g12_u4_village_to_city': {
      const road1 = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.04, 0.95), makeMat('#475569', 0.9, 0.05));
      road1.position.y = 0.02;
      centerpiece.add(road1);
      const road2 = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.04, 9.2), makeMat('#475569', 0.9, 0.05));
      road2.position.y = 0.02;
      centerpiece.add(road2);

      const skyline = new THREE.Group();
      const tower1 = makeBuilding(0.9, 2.4, 0.9, '#3b82f6');
      tower1.position.set(-1.3, 0, -1.4);
      const tower2 = makeBuilding(1.0, 3.1, 1.0, '#0ea5e9');
      tower2.position.set(1.2, 0, -1.5);
      skyline.add(tower1, tower2);
      centerpiece.add(skyline);
      dynamicMeshes.skyline = skyline;
      break;
    }

    case 'g10_u9_env_before_after':
    case 'g10_u10_ecotourism_park':
    case 'g11_u10_ecosystem':
    case 'g12_u8_wildlife_reserve': {
      const river = new THREE.Mesh(
        new THREE.BoxGeometry(9.4, 0.06, 1.25),
        makeMat('#0284c7', 0.15, 0.4, '#0369a1', 0.18)
      );
      river.position.set(0, 0.02, 0.4);
      river.rotation.y = 0.28;
      centerpiece.add(river);
      dynamicMeshes.river = river;

      const hill = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.5, 7), makeMat('#4d7c0f', 0.9, 0.02));
      hill.position.set(-2.3, 0.72, -2.1);
      centerpiece.add(hill);
      break;
    }

    default: {
      // Clean expo / classroom / studio central podium
      const podium = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.24, 24), makeMat('#cbd5e1', 0.55, 0.2));
      podium.position.y = 0.12;
      podium.receiveShadow = true;
      centerpiece.add(podium);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.32, 0.04, 10, 36),
        makeMat('#2563eb', 0.3, 0.5, '#2563eb', 0.25)
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.24;
      centerpiece.add(ring);
      break;
    }
  }
  root.add(centerpiece);

  // 3. Build interactive props for every declared object in the 3D scene
  sceneData.objects.forEach((obj, idx) => {
    const prop = makeInteractivePropForObject(obj, sceneData.sceneKind, idx);
    root.add(prop);
    interactables.push(prop);

    const box = new THREE.Box3().setFromObject(prop);
    anchors.set(obj.id, new THREE.Vector3(prop.position.x, Math.max(1.15, box.max.y + 0.35), prop.position.z));

    if (prop.userData.spinRotor) {
      animatedRotors.push(prop.userData.spinRotor as THREE.Object3D);
    } else if (
      sceneData.sceneKind === 'g10_u5_invention_expo' ||
      sceneData.sceneKind === 'g12_u6_ai_expo' ||
      sceneData.sceneKind === 'g11_u5_greenhouse_effect'
    ) {
      animatedFloaters.push({obj: prop, baseY: prop.position.y, phase: idx * 0.9});
    }
  });

  // 4. Live animation + control state response
  const update = (elapsed: number, controls: Record<string, number | boolean | string>) => {
    const speedFactor = typeof controls.speed === 'number' ? controls.speed : 1;

    for (const r of animatedRotors) {
      if (r instanceof THREE.Mesh) {
        r.rotation.y = elapsed * 0.35 * speedFactor;
      } else {
        r.rotation.z = -elapsed * 1.8 * speedFactor;
      }
    }

    for (const f of animatedFloaters) {
      f.obj.position.y = f.baseY + Math.sin(elapsed * 1.6 + f.phase) * 0.07;
    }

    // Respond meaningfully to sliders/toggles (e.g., greenhouse CO2, urbanization slider, roof cutaway)
    const numericVals = Object.entries(controls).filter(([, v]) => typeof v === 'number');
    if (dynamicMeshes.atmosphere && numericVals.length > 0) {
      const val = Number(numericVals[0][1]);
      const ratio = Math.min(1, Math.max(0, val / 100));
      const mat = (dynamicMeshes.atmosphere as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.opacity = 0.14 + ratio * 0.42;
      mat.color.setHSL(0.08 - ratio * 0.06, 0.9, 0.52);
    }

    if (dynamicMeshes.skyline && numericVals.length > 0) {
      const val = Number(numericVals[0][1]);
      const scaleY = 0.35 + (Math.min(100, Math.max(0, val)) / 100) * 1.15;
      dynamicMeshes.skyline.scale.y = scaleY;
    }

    if (dynamicMeshes.roof) {
      const hideRoof = Object.values(controls).some((v) => v === false || v === 'cutaway');
      dynamicMeshes.roof.visible = !hideRoof;
    }
  };

  const dispose = () => {
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          if ('map' in m && m.map) (m.map as THREE.Texture).dispose();
          m.dispose();
        });
      }
    });
  };

  return {root, interactables, anchors, update, dispose};
}

/**
 * 3D Interactive Vocal Tract (Three.js) for Pronunciation P01..P12.
 * Models cutaway head profile, upper/lower lips, teeth, jaw, articulated tongue tip+body,
 * alveolar ridge, hard/soft palate, movable velum, oral/nasal cavities, pharynx, larynx,
 * vocal cords (vibrating when voiced), and animated airflow particles.
 */
export function buildVocalTract3D(initialPose: ArticulatorPose): BuiltVocalTract3D {
  const root = new THREE.Group();

  // Translucent cutaway skull/head frame for spatial orientation
  const headShell = new THREE.Mesh(
    new THREE.SphereGeometry(2.15, 28, 22, -Math.PI * 0.15, Math.PI * 1.3),
    new THREE.MeshStandardMaterial({
      color: '#f1f5f9',
      roughness: 0.7,
      metalness: 0.05,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
    })
  );
  headShell.position.set(0, 0.3, -0.15);
  root.add(headShell);

  // Nasal cavity arch
  const nasalCavity = new THREE.Mesh(
    new THREE.TorusGeometry(0.75, 0.18, 12, 24, Math.PI),
    makeMat('#bae6fd', 0.45, 0.05)
  );
  nasalCavity.position.set(-0.35, 1.05, 0);
  root.add(nasalCavity);

  // Hard Palate + Alveolar Ridge
  const hardPalate = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.11, 10, 22, Math.PI * 0.72),
    makeMat('#fca5a5', 0.55, 0.05)
  );
  hardPalate.position.set(-0.45, 0.25, 0);
  hardPalate.rotation.z = 0.22;
  root.add(hardPalate);

  const alveolarRidge = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), makeMat('#f87171', 0.5, 0.05));
  alveolarRidge.position.set(-1.12, 0.42, 0);
  root.add(alveolarRidge);

  // Movable Velum (Soft Palate)
  const velum = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.42), makeMat('#fb7185', 0.55, 0.05));
  velum.position.set(0.32, 0.55, 0);
  root.add(velum);

  // Upper & Lower Teeth
  const upperTeeth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.62), makeMat('#ffffff', 0.25, 0.05));
  upperTeeth.position.set(-1.35, 0.2, 0);
  root.add(upperTeeth);

  const jawGroup = new THREE.Group();
  jawGroup.position.set(0.15, -0.35, 0);
  const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.24, 0.74), makeMat('#fed7aa', 0.75, 0.02));
  lowerJaw.position.set(-0.75, -0.22, 0);
  jawGroup.add(lowerJaw);

  const lowerTeeth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.58), makeMat('#ffffff', 0.25, 0.05));
  lowerTeeth.position.set(-1.42, 0.02, 0);
  jawGroup.add(lowerTeeth);
  root.add(jawGroup);

  // Upper & Lower Lips
  const upperLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.36, 8, 12), makeMat('#e11d48', 0.5, 0.04));
  upperLip.rotation.x = Math.PI / 2;
  upperLip.position.set(-1.58, 0.22, 0);
  root.add(upperLip);

  const lowerLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.36, 8, 12), makeMat('#e11d48', 0.5, 0.04));
  lowerLip.rotation.x = Math.PI / 2;
  lowerLip.position.set(-1.56, -0.22, 0);
  root.add(lowerLip);

  // Articulated Tongue (Body + Tip)
  const tongueBody = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 16), makeMat('#ef4444', 0.45, 0.04));
  tongueBody.scale.set(1.25, 0.62, 0.85);
  tongueBody.position.set(-0.35, -0.18, 0);
  root.add(tongueBody);

  const tongueTip = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), makeMat('#dc2626', 0.42, 0.04));
  tongueTip.scale.set(1.3, 0.55, 0.75);
  tongueTip.position.set(-1.05, -0.05, 0);
  root.add(tongueTip);

  // Pharynx & Larynx tube + Vocal Cords
  const pharynx = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.34, 1.9, 16, 1, true),
    new THREE.MeshStandardMaterial({color: '#fda4af', roughness: 0.6, transparent: true, opacity: 0.48, side: THREE.DoubleSide})
  );
  pharynx.position.set(0.68, -0.45, 0);
  root.add(pharynx);

  const vocalCords = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.06, 10, 20),
    makeMat('#fbbf24', 0.35, 0.2, '#f59e0b', 0.3)
  );
  vocalCords.rotation.x = Math.PI / 2;
  vocalCords.position.set(0.68, -1.2, 0);
  root.add(vocalCords);

  // Animated airflow particles
  const particleCount = 16;
  const particles: THREE.Mesh[] = [];
  const pGeo = new THREE.SphereGeometry(0.065, 10, 8);
  for (let i = 0; i < particleCount; i++) {
    const pMat = new THREE.MeshStandardMaterial({
      color: '#06b6d4',
      emissive: '#06b6d4',
      emissiveIntensity: 0.55,
      roughness: 0.2,
    });
    const m = new THREE.Mesh(pGeo, pMat);
    root.add(m);
    particles.push(m);
  }

  const labelAnchors: Record<string, THREE.Vector3> = {
    lips: new THREE.Vector3(-1.72, 0.05, 0),
    teeth: new THREE.Vector3(-1.38, 0.25, 0),
    alveolar: new THREE.Vector3(-1.12, 0.52, 0),
    tongueTip: new THREE.Vector3(-1.02, -0.05, 0),
    tongueBody: new THREE.Vector3(-0.35, -0.15, 0),
    hardPalate: new THREE.Vector3(-0.42, 0.85, 0),
    velum: new THREE.Vector3(0.32, 0.65, 0),
    nasalCavity: new THREE.Vector3(-0.35, 1.65, 0),
    pharynx: new THREE.Vector3(0.85, -0.3, 0),
    vocalCords: new THREE.Vector3(0.85, -1.2, 0),
  };

  const applyPose = (elapsed: number, pose: ArticulatorPose, slowMotion: boolean) => {
    const speed = slowMotion ? 0.45 : 1.35;
    const pulse = Math.sin(elapsed * speed * 3.5);

    // Jaw & Lips
    jawGroup.rotation.z = pose.jawDrop * 0.36;
    const lipSpread = 1 + pose.lipRounding * 0.35;
    upperLip.position.set(-1.55 - pose.lipRounding * 0.16, 0.15 + pose.lipOpening * 0.22, 0);
    lowerLip.position.set(-1.54 - pose.lipRounding * 0.16, -0.12 - pose.lipOpening * 0.34, 0);
    upperLip.scale.set(lipSpread, 1, 1 - pose.lipRounding * 0.25);
    lowerLip.scale.set(lipSpread, 1, 1 - pose.lipRounding * 0.25);

    // Tongue body & tip
    tongueBody.position.set(-0.68 + pose.tongueBodyX * 0.72, -0.35 + pose.tongueBodyY * 0.62, 0);
    tongueTip.position.set(-1.42 + pose.tongueTipX * 0.85, -0.32 + pose.tongueTipY * 0.72, 0);
    labelAnchors.tongueTip.copy(tongueTip.position);
    labelAnchors.tongueBody.copy(tongueBody.position);

    // Velum opens downward to allow nasal airflow for /m, n, ŋ/
    velum.rotation.z = pose.velumOpen ? -0.58 : 0.18;

    // Vocal cords vibrate if voiced
    const vcMat = vocalCords.material as THREE.MeshStandardMaterial;
    if (pose.voiced) {
      vocalCords.scale.setScalar(1 + Math.sin(elapsed * (slowMotion ? 10 : 28)) * 0.12);
      vcMat.color.set('#ef4444');
      vcMat.emissive.set('#ef4444');
      vcMat.emissiveIntensity = 0.65;
    } else {
      vocalCords.scale.setScalar(1);
      vcMat.color.set('#94a3b8');
      vcMat.emissive.set('#64748b');
      vcMat.emissiveIntensity = 0.08;
    }

    // Animate airflow particles along laryngeal -> oral OR nasal tract
    particles.forEach((p, idx) => {
      const t = ((elapsed * speed * 0.55 + idx / particleCount) % 1 + 1) % 1;
      const mat = p.material as THREE.MeshStandardMaterial;
      mat.color.set(pose.voiced ? '#f59e0b' : '#06b6d4');
      mat.emissive.set(pose.voiced ? '#f59e0b' : '#06b6d4');

      if (t < 0.35) {
        // Rising up pharynx from larynx
        const k = t / 0.35;
        p.position.set(0.68, -1.25 + k * 1.45, Math.sin(idx + pulse) * 0.08);
      } else if (pose.velumOpen || pose.airflow === 'nasal') {
        // Route through nasal cavity
        const k = (t - 0.35) / 0.65;
        const angle = k * Math.PI;
        p.position.set(0.4 - Math.cos(angle) * 0.9 - k * 0.7, 0.35 + Math.sin(angle) * 0.95, 0);
      } else {
        // Route through oral cavity past tongue & lips
        const k = (t - 0.35) / 0.65;
        const burst = pose.airflow === 'oral_plosive' && k > 0.75 ? (k - 0.75) * 1.4 : 0;
        p.position.set(
          0.55 - k * 2.45 - burst,
          0.22 + Math.sin(k * Math.PI) * 0.32 - k * 0.15,
          Math.cos(idx * 2 + elapsed * 3) * 0.06
        );
      }
    });
  };

  applyPose(0, initialPose, false);

  const dispose = () => {
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
  };

  return {root, labelAnchors, update: applyPose, dispose};
}
