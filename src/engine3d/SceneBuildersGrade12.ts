import * as THREE from 'three';
import {
  createArticulatedCharacter,
  createDetailedTree,
  MaterialLibrary,
  tagInteractive,
} from './MaterialLibrary';
import type {BuiltWorld3DScene, World3DRuntimeState} from './types';

function pushAction(
  state: World3DRuntimeState,
  actionId: string,
  objectId: string,
  flagUpdates: Record<string, boolean> = {},
  valUpdates: Record<string, number> = {}
): World3DRuntimeState {
  return {
    ...state,
    flags: {...state.flags, ...flagUpdates},
    values: {...state.values, ...valUpdates},
    actionHistory: [
      ...state.actionHistory,
      {actionId, objectId, timestamp: Date.now()},
    ],
  };
}

function makeBaseState(
  flags: Record<string, boolean> = {},
  values: Record<string, number> = {},
  characterPos: [number, number, number] = [0, 0, 4.6]
): World3DRuntimeState {
  return {
    flags,
    values,
    strings: {},
    actionHistory: [],
    heldItemId: null,
    characterPos,
  };
}

function disposeSceneRoot(root: THREE.Group, mats: MaterialLibrary): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) obj.geometry.dispose();
  });
  mats.dispose();
}

// ============================================================================
// GRADE 12 · UNIT 2: A MULTICULTURAL WORLD (Walkable Cultural Expo Hall 3D)
// ============================================================================
export function buildG12U2MulticulturalExpo(): BuiltWorld3DScene {
  const mats = new MaterialLibrary();
  const root = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const labelAnchors = new Map<string, THREE.Vector3>();
  const obstacles: Array<{minX: number; maxX: number; minZ: number; maxZ: number}> = [];

  // Exhibition hall polished terrazzo floor + perimeter architectural walls
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.25, 14),
    mats.tileFloor('#f8fafc', '#cbd5e1', 8, 7)
  );
  floor.position.y = -0.125;
  floor.receiveShadow = true;
  root.add(floor);

  // Decorative carpet walkway cross
  const runnerMat = mats.standard('#e0f2fe', 0.88, 0.02);
  const runnerA = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.02, 11.6), runnerMat);
  runnerA.position.set(0, 0.012, 0);
  const runnerB = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.02, 2.2), runnerMat);
  runnerB.position.set(0, 0.013, 0);
  root.add(runnerA, runnerB);

  const wallMat = mats.standard('#eef2f6', 0.85, 0.03);
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(16, 4.4, 0.3), wallMat);
  backWall.position.set(0, 2.2, -6.9);
  backWall.receiveShadow = true;
  root.add(backWall);

  // Overhead expo banner
  const expoHeader = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 0.95, 0.16),
    mats.signTexture('MULTICULTURAL EXPO', 'Vietnam · Japan · UK · Mexico', '#eff6ff', '#1e3a8a')
  );
  expoHeader.position.set(0, 3.65, -6.65);
  root.add(expoHeader);

  const highlightRings: Record<string, THREE.Mesh> = {};
  const addHighlightRing = (id: string, x: number, z: number, color: string) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.45, 1.68, 32),
      mats.standard(color, 0.4, 0.1, {emissive: color, emissiveIntensity: 0.2, side: THREE.DoubleSide})
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.025, z);
    root.add(ring);
    highlightRings[id] = ring;
  };

  // --- 1. VIETNAM PAVILION (Red/Gold archway, Ao Dai mannequin, Non La, Pho bowl) ---
  const vnBooth = new THREE.Group();
  vnBooth.position.set(-4.6, 0, -3.2);
  const vnPlatform = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 2.8), mats.wood('#991b1b', '#7f1d1d', 2, 2));
  vnPlatform.position.y = 0.09;
  vnPlatform.receiveShadow = true;
  vnBooth.add(vnPlatform);

  const vnBack = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.6, 0.18), mats.standard('#dc2626', 0.72, 0.08));
  vnBack.position.set(0, 1.48, -1.2);
  vnBack.castShadow = true;
  const vnSign = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.7, 0.08),
    mats.signTexture('VIETNAM', 'Ao Dai · Non La · Pho', '#fef3c7', '#991b1b')
  );
  vnSign.position.set(0, 2.35, -1.08);
  vnBooth.add(vnBack, vnSign);

  // Ao Dai display silhouette
  const mannequinBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.9, 14), mats.standard('#facc15', 0.65, 0.05));
  mannequinBase.position.set(-0.75, 0.63, -0.3);
  const mannequinTop = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.7, 14), mats.standard('#ef4444', 0.65, 0.06));
  mannequinTop.position.set(-0.75, 1.4, -0.3);
  const nonLa = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.24, 20), mats.standard('#fde68a', 0.82, 0.02));
  nonLa.position.set(-0.75, 1.92, -0.3);
  vnBooth.add(mannequinBase, mannequinTop, nonLa);

  // Pho bowl on wooden counter
  const vnCounter = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.78, 0.72), mats.wood('#b45309', '#78350f', 1, 1));
  vnCounter.position.set(0.65, 0.57, 0.1);
  const phoBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.16, 0.18, 16), mats.standard('#ffffff', 0.25, 0.08));
  phoBowl.position.set(0.65, 1.05, 0.1);
  const phoBroth = new THREE.Mesh(new THREE.CircleGeometry(0.23, 16), mats.standard('#d97706', 0.3, 0.05));
  phoBroth.rotation.x = -Math.PI / 2;
  phoBroth.position.set(0.65, 1.13, 0.1);
  vnBooth.add(vnCounter, phoBowl, phoBroth);

  tagInteractive(vnBooth, 'booth_vietnam');
  root.add(vnBooth);
  interactables.push(vnBooth);
  labelAnchors.set('booth_vietnam', new THREE.Vector3(-4.6, 3.1, -3.2));
  obstacles.push({minX: -6.3, maxX: -2.9, minZ: -4.7, maxZ: -1.8});
  addHighlightRing('booth_vietnam', -4.6, -1.1, '#ef4444');

  // --- 2. JAPAN PAVILION (Crimson Torii Gate + Kimono Display) ---
  const jpBooth = new THREE.Group();
  jpBooth.position.set(4.6, 0, -3.2);
  const jpPlatform = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 2.8), mats.wood('#d6d3d1', '#a8a29e', 2, 2));
  jpPlatform.position.y = 0.09;
  jpBooth.add(jpPlatform);

  const toriiMat = mats.standard('#e11d48', 0.48, 0.1);
  const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.55, 12), toriiMat);
  pillarL.position.set(-1.05, 1.45, -0.7);
  const pillarR = pillarL.clone();
  pillarR.position.x = 1.05;
  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.2, 0.24), toriiMat);
  topBeam.position.set(0, 2.72, -0.7);
  const subBeam = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.14, 0.18), toriiMat);
  subBeam.position.set(0, 2.25, -0.7);
  const jpSign = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.58, 0.08),
    mats.signTexture('JAPAN', 'Torii · Kimono · Origami', '#fff1f2', '#9f1239')
  );
  jpSign.position.set(0, 1.72, -1.12);
  jpBooth.add(pillarL, pillarR, topBeam, subBeam, jpSign);

  // Kimono stand
  const kimonoPole = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.07), mats.wood('#44403c', '#292524', 1, 1));
  kimonoPole.position.set(0, 1.55, 0.1);
  const kimonoRobe = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.05, 0.16), mats.standard('#f472b6', 0.72, 0.04));
  kimonoRobe.position.set(0, 1.0, 0.1);
  const obiSash = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.2, 0.2), mats.standard('#facc15', 0.55, 0.15));
  obiSash.position.set(0, 0.98, 0.1);
  jpBooth.add(kimonoPole, kimonoRobe, obiSash);

  tagInteractive(jpBooth, 'booth_japan');
  root.add(jpBooth);
  interactables.push(jpBooth);
  labelAnchors.set('booth_japan', new THREE.Vector3(4.6, 3.1, -3.2));
  obstacles.push({minX: 2.9, maxX: 6.3, minZ: -4.7, maxZ: -1.8});
  addHighlightRing('booth_japan', 4.6, -1.1, '#f43f5e');

  // --- 3. UNITED KINGDOM PAVILION (Clock Tower Miniature + Afternoon Tea Table) ---
  const ukBooth = new THREE.Group();
  ukBooth.position.set(-4.6, 0, 2.8);
  const ukPlatform = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 2.6), mats.standard('#1d4ed8', 0.75, 0.06));
  ukPlatform.position.y = 0.09;
  ukBooth.add(ukPlatform);

  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.68, 2.25, 0.68), mats.heritageStone('#d6c6a5'));
  tower.position.set(-0.9, 1.3, -0.45);
  tower.castShadow = true;
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.75, 4), mats.standard('#334155', 0.45, 0.35));
  spire.position.set(-0.9, 2.8, -0.45);
  spire.rotation.y = Math.PI / 4;
  const clockDial = new THREE.Mesh(new THREE.CircleGeometry(0.22, 18), mats.standard('#fef9c3', 0.3, 0.05));
  clockDial.position.set(-0.9, 2.02, -0.09);
  ukBooth.add(tower, spire, clockDial);

  // Afternoon tea table + teapot
  const teaTable = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.48, 0.72, 18), mats.standard('#f8fafc', 0.55, 0.04));
  teaTable.position.set(0.55, 0.54, 0.15);
  const teapot = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), mats.standard('#e2e8f0', 0.2, 0.65));
  teapot.position.set(0.55, 1.02, 0.15);
  const ukSign = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.55, 0.08),
    mats.signTexture('UNITED KINGDOM', 'Afternoon Tea · Etiquette', '#eff6ff', '#1e3a8a')
  );
  ukSign.position.set(0.45, 1.85, -0.95);
  ukBooth.add(teaTable, teapot, ukSign);

  tagInteractive(ukBooth, 'booth_uk');
  root.add(ukBooth);
  interactables.push(ukBooth);
  labelAnchors.set('booth_uk', new THREE.Vector3(-4.6, 3.2, 2.8));
  obstacles.push({minX: -6.3, maxX: -2.9, minZ: 1.4, maxZ: 4.2});
  addHighlightRing('booth_uk', -4.6, 0.85, '#2563eb');

  // --- 4. MEXICO FIESTA PAVILION (Colorful Arch + Cuisine Counter) ---
  const mxBooth = new THREE.Group();
  mxBooth.position.set(4.6, 0, 2.8);
  const mxPlatform = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 2.6), mats.standard('#0f766e', 0.75, 0.05));
  mxPlatform.position.y = 0.09;
  mxBooth.add(mxPlatform);

  const colors = ['#ef4444', '#f59e0b', '#10b981', '#ec4899', '#3b82f6'];
  colors.forEach((c, idx) => {
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.05), mats.standard(c, 0.65, 0.04));
    flag.position.set(-1.05 + idx * 0.52, 2.35 - Math.abs(idx - 2) * 0.08, -0.65);
    mxBooth.add(flag);
  });
  const mxPostL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 10), mats.wood('#b45309', '#78350f', 1, 1));
  mxPostL.position.set(-1.32, 1.3, -0.65);
  const mxPostR = mxPostL.clone();
  mxPostR.position.x = 1.32;
  const mxCounter = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.82, 0.85), mats.standard('#f97316', 0.7, 0.05));
  mxCounter.position.set(0, 0.59, 0.15);
  const sombrero = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 20), mats.standard('#facc15', 0.8, 0.02));
  sombrero.position.set(-0.35, 1.05, 0.15);
  const sombreroCrown = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.24, 16), mats.standard('#ea580c', 0.8, 0.02));
  sombreroCrown.position.set(-0.35, 1.18, 0.15);
  const mxSign = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.55, 0.08),
    mats.signTexture('MEXICO', 'Fiesta · Music · Cuisine', '#fefce8', '#9a3412')
  );
  mxSign.position.set(0, 1.65, -0.82);
  mxBooth.add(mxPostL, mxPostR, mxCounter, sombrero, sombreroCrown, mxSign);

  tagInteractive(mxBooth, 'booth_mexico');
  root.add(mxBooth);
  interactables.push(mxBooth);
  labelAnchors.set('booth_mexico', new THREE.Vector3(4.6, 3.0, 2.8));
  obstacles.push({minX: 2.9, maxX: 6.3, minZ: 1.4, maxZ: 4.2});
  addHighlightRing('booth_mexico', 4.6, 0.85, '#f59e0b');

  // --- 5. GLOBAL CULTURAL STAGE (Center Back Podium + Rotating Globe) ---
  const stageGroup = new THREE.Group();
  stageGroup.position.set(0, 0, -4.4);
  const stageDeck = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.9, 0.36, 28), mats.standard('#1e293b', 0.45, 0.3));
  stageDeck.position.y = 0.18;
  stageDeck.receiveShadow = true;
  const lectern = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.05, 0.42), mats.wood('#78350f', '#451a03', 1, 1));
  lectern.position.set(0, 0.88, 0.72);
  const globeHolo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 18), mats.earthGlobe());
  globeHolo.position.set(0, 1.95, -0.25);
  const stageGlow = new THREE.Mesh(
    new THREE.TorusGeometry(1.76, 0.05, 10, 36),
    mats.standard('#38bdf8', 0.2, 0.2, {emissive: '#38bdf8', emissiveIntensity: 0.7})
  );
  stageGlow.rotation.x = Math.PI / 2;
  stageGlow.position.y = 0.37;
  stageGroup.add(stageDeck, lectern, globeHolo, stageGlow);

  tagInteractive(stageGroup, 'expo_stage');
  root.add(stageGroup);
  interactables.push(stageGroup);
  labelAnchors.set('expo_stage', new THREE.Vector3(0, 2.95, -4.4));
  obstacles.push({minX: -1.8, maxX: 1.8, minZ: -6.2, maxZ: -2.6});

  // Controllable visitor character
  const {group: charGroup, limbs} = createArticulatedCharacter(mats, '#0284c7', '#1e293b');
  charGroup.position.set(0, 0, 4.8);
  root.add(charGroup);

  return {
    root,
    interactables,
    draggables: [],
    dropZones: [],
    labelAnchors,
    obstacles,
    walkBounds: {minX: -7.1, maxX: 7.1, minZ: -5.6, maxZ: 5.8},
    characterGroup: charGroup,
    characterLimbs: limbs,
    getInitialState: () =>
      makeBaseState(
        {vnVisited: false, jpVisited: false, ukVisited: false, mxVisited: false, stagePresented: false},
        {visitedCount: 0},
        [0, 0, 4.8]
      ),
    performAction: (actionId, state) => {
      const countVisited = (f: Record<string, boolean>) =>
        ['vnVisited', 'jpVisited', 'ukVisited', 'mxVisited'].filter((k) => f[k]).length;

      if (actionId === 'visit_vietnam') {
        const nextFlags = {...state.flags, vnVisited: true};
        return {
          changed: true,
          nextState: pushAction(state, 'visit_vietnam', 'booth_vietnam', {vnVisited: true}, {visitedCount: countVisited(nextFlags)}),
          feedbackEn: 'Explored Vietnam Pavilion: Ao Dai, Non La, and traditional Pho cuisine.',
          feedbackVi: 'Đã khám phá Gian hàng Việt Nam: Áo dài, Nón lá và Ẩm thực Phở.',
          soundKey: 'chime',
          spokenEn: 'Welcome to the Vietnam Pavilion, showcasing Ao Dai traditional attire and Pho culinary heritage.',
        };
      }
      if (actionId === 'visit_japan') {
        const nextFlags = {...state.flags, jpVisited: true};
        return {
          changed: true,
          nextState: pushAction(state, 'visit_japan', 'booth_japan', {jpVisited: true}, {visitedCount: countVisited(nextFlags)}),
          feedbackEn: 'Visited Japan Torii Pavilion: Kimono display and polite greeting customs.',
          feedbackVi: 'Đã tham quan Gian hàng Nhật Bản: Cổng Torii, Kimono và văn hóa chào hỏi.',
          soundKey: 'chime',
          spokenEn: 'At the Japan Pavilion, bowing is a respected custom showing politeness and gratitude.',
        };
      }
      if (actionId === 'visit_uk') {
        const nextFlags = {...state.flags, ukVisited: true};
        return {
          changed: true,
          nextState: pushAction(state, 'visit_uk', 'booth_uk', {ukVisited: true}, {visitedCount: countVisited(nextFlags)}),
          feedbackEn: 'Discovered United Kingdom Pavilion: Afternoon tea etiquette and heritage.',
          feedbackVi: 'Đã khám phá Gian hàng Vương quốc Anh: Phong tục trà chiều và phép lịch sự.',
          soundKey: 'chime',
          spokenEn: 'British afternoon tea is a famous tradition celebrating hospitality and conversation.',
        };
      }
      if (actionId === 'visit_mexico') {
        const nextFlags = {...state.flags, mxVisited: true};
        return {
          changed: true,
          nextState: pushAction(state, 'visit_mexico', 'booth_mexico', {mxVisited: true}, {visitedCount: countVisited(nextFlags)}),
          feedbackEn: 'Explored Mexico Fiesta Pavilion: vibrant festivals, music, and specialities.',
          feedbackVi: 'Đã khám phá Gian hàng Mexico: Sắc màu lễ hội, âm nhạc dân gian và ẩm thực.',
          soundKey: 'chime',
          spokenEn: 'The Mexico Pavilion celebrates colourful festivals, folk music, and traditional cuisine.',
        };
      }
      if (actionId === 'present_culture') {
        return {
          changed: true,
          nextState: pushAction(state, 'present_culture', 'expo_stage', {stagePresented: true}),
          feedbackEn: 'Delivered a cultural diversity presentation on the Global Stage!',
          feedbackVi: 'Đã hoàn thành bài thuyết trình giao lưu đa văn hóa trên Sân khấu Quốc tế!',
          soundKey: 'success',
          spokenEn: 'Cultural diversity enriches our world by helping us respect and learn from every tradition.',
        };
      }
      return {changed: false, nextState: state, feedbackEn: '', feedbackVi: ''};
    },
    getMetrics: (state) => {
      const visited = state.values.visitedCount ?? 0;
      const stageDone = state.flags.stagePresented ? 1 : 0;
      return [
        {
          id: 'pavilions',
          labelEn: 'Pavilions Explored',
          labelVi: 'Gian hàng đã tham quan',
          value: `${visited} / 4`,
          percent: (visited / 4) * 100,
          tone: visited === 4 ? 'good' : 'neutral',
        },
        {
          id: 'exchange',
          labelEn: 'Global Stage Presentation',
          labelVi: 'Thuyết trình giao lưu',
          value: stageDone ? 'Completed' : 'Ready',
          percent: stageDone ? 100 : 20,
          tone: stageDone ? 'good' : 'warn',
        },
      ];
    },
    update: (elapsed, delta, state, paused) => {
      if (paused) return;
      globeHolo.rotation.y += delta * 0.55;
      globeHolo.position.y = 1.95 + Math.sin(elapsed * 2) * 0.08;
      const visitedMap: Record<string, boolean> = {
        booth_vietnam: !!state.flags.vnVisited,
        booth_japan: !!state.flags.jpVisited,
        booth_uk: !!state.flags.ukVisited,
        booth_mexico: !!state.flags.mxVisited,
      };
      Object.entries(highlightRings).forEach(([id, ring]) => {
        const mat = ring.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = visitedMap[id] ? 0.65 : 0.15 + Math.sin(elapsed * 3) * 0.08;
      });
    },
    dispose: () => disposeSceneRoot(root, mats),
  };
}

// ============================================================================
// GRADE 12 · UNIT 3: GREEN LIVING (Smart Eco-House 3D + Live Energy/Water)
// ============================================================================
export function buildG12U3GreenLiving(): BuiltWorld3DScene {
  const mats = new MaterialLibrary();
  const root = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const labelAnchors = new Map<string, THREE.Vector3>();

  // Cutaway modern eco-house floor + outer lawn
  const lawn = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 12.2, 0.3, 40), mats.grass('#4ade80', '#22c55e', 6, 6));
  lawn.position.y = -0.25;
  lawn.receiveShadow = true;
  root.add(lawn);

  const houseFloor = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.2, 6.8), mats.wood('#e5c39c', '#c8a175', 4, 3));
  houseFloor.position.y = 0.0;
  houseFloor.receiveShadow = true;
  root.add(houseFloor);

  // Back & Left cutaway walls
  const wallMat = mats.standard('#f8fafc', 0.85, 0.02);
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(8.8, 3.4, 0.22), wallMat);
  backWall.position.set(0, 1.7, -3.3);
  backWall.receiveShadow = true;
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 6.8), wallMat);
  leftWall.position.set(-4.3, 1.7, 0);
  leftWall.receiveShadow = true;
  // Large daylight window on back wall
  const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 0.28), mats.standard('#334155', 0.5, 0.3));
  windowFrame.position.set(0, 2.0, -3.3);
  const windowGlass = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.25, 0.32), mats.glass('#bae6fd', 0.35));
  windowGlass.position.set(0, 2.0, -3.3);
  root.add(backWall, leftWall, windowFrame, windowGlass);

  // Partial sloped roof section for rooftop solar
  const roofDeck = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.16, 3.4), mats.standard('#475569', 0.65, 0.2));
  roofDeck.position.set(-2.0, 3.65, -1.7);
  roofDeck.rotation.x = 0.18;
  roofDeck.castShadow = true;
  root.add(roofDeck);

  // --- 1. ROOM CEILING LED LIGHTS (Real PointLight + Emissive Fixtures) ---
  const lightGroup = new THREE.Group();
  lightGroup.position.set(0.6, 3.35, -0.4);
  const lightRail = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.22), mats.metal('#94a3b8', 0.3, 0.7));
  const bulbMat = mats.standard('#fef08a', 0.2, 0.05, {emissive: '#facc15', emissiveIntensity: 1.15});
  const bulb1 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 14), bulbMat);
  bulb1.position.set(-0.85, -0.18, 0);
  const bulb2 = bulb1.clone();
  bulb2.position.set(0.85, -0.18, 0);
  const roomPointLight = new THREE.PointLight('#fde68a', 2.2, 11);
  roomPointLight.position.set(0, -0.4, 0);
  lightGroup.add(lightRail, bulb1, bulb2, roomPointLight);

  tagInteractive(lightGroup, 'eco_lights');
  root.add(lightGroup);
  interactables.push(lightGroup);
  labelAnchors.set('eco_lights', new THREE.Vector3(0.6, 3.9, -0.4));

  // --- 2. AC UNIT + TV STANDBY APPLIANCES ---
  const applianceGroup = new THREE.Group();
  applianceGroup.position.set(-2.9, 0, -2.6);
  const tvStand = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 0.62), mats.wood('#78350f', '#451a03', 1, 1));
  tvStand.position.y = 0.36;
  const tvScreen = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.92, 0.08), mats.standard('#0f172a', 0.2, 0.4));
  tvScreen.position.set(0, 1.16, -0.1);
  const standbyLedMat = mats.standard('#ef4444', 0.2, 0.1, {emissive: '#ef4444', emissiveIntensity: 1.0});
  const standbyLed = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), standbyLedMat);
  standbyLed.position.set(0.65, 0.76, -0.02);

  // Wall AC unit above TV
  const acUnit = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.42, 0.34), mats.standard('#f1f5f9', 0.35, 0.12));
  acUnit.position.set(0, 2.55, -0.35);
  const acLedMat = mats.standard('#f97316', 0.2, 0.1, {emissive: '#f97316', emissiveIntensity: 0.9});
  const acLed = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.04), acLedMat);
  acLed.position.set(0.45, 2.52, -0.17);
  applianceGroup.add(tvStand, tvScreen, standbyLed, acUnit, acLed);

  tagInteractive(applianceGroup, 'eco_appliances');
  root.add(applianceGroup);
  interactables.push(applianceGroup);
  labelAnchors.set('eco_appliances', new THREE.Vector3(-2.9, 3.05, -2.6));

  // --- 3. KITCHEN SINK & RUNNING WATER TAP ---
  const sinkGroup = new THREE.Group();
  sinkGroup.position.set(2.85, 0, -2.35);
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.92, 0.95), mats.standard('#e2e8f0', 0.55, 0.08));
  cabinet.position.y = 0.46;
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 1.02), mats.standard('#cbd5e1', 0.3, 0.15));
  counterTop.position.y = 0.96;
  const basin = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.12, 0.58), mats.metal('#94a3b8', 0.25, 0.8));
  basin.position.set(0, 0.95, 0);
  const faucetPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.48, 10), mats.metal('#e2e8f0', 0.2, 0.9));
  faucetPipe.position.set(0, 1.24, -0.26);
  const faucetSpout = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 10), mats.metal('#e2e8f0', 0.2, 0.9));
  faucetSpout.rotation.x = Math.PI / 2;
  faucetSpout.position.set(0, 1.46, -0.14);
  const waterStream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.045, 0.46, 10),
    mats.water('#38bdf8')
  );
  waterStream.position.set(0, 1.2, -0.02);
  sinkGroup.add(cabinet, counterTop, basin, faucetPipe, faucetSpout, waterStream);

  tagInteractive(sinkGroup, 'eco_tap');
  root.add(sinkGroup);
  interactables.push(sinkGroup);
  labelAnchors.set('eco_tap', new THREE.Vector3(2.85, 2.05, -2.35));

  // --- 4. KITCHEN COMPOST & RECYCLE STATION ---
  const wasteGroup = new THREE.Group();
  wasteGroup.position.set(2.9, 0, 1.35);
  const binGreen = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.86, 0.62), mats.standard('#16a34a', 0.65, 0.06));
  binGreen.position.set(-0.42, 0.43, 0);
  const binGreenLid = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.66), mats.standard('#15803d', 0.6, 0.06));
  binGreenLid.position.set(-0.42, 0.9, 0);
  const binBlue = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.86, 0.62), mats.standard('#2563eb', 0.65, 0.06));
  binBlue.position.set(0.42, 0.43, 0);
  const binBlueLid = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.66), mats.standard('#1d4ed8', 0.6, 0.06));
  binBlueLid.position.set(0.42, 0.9, 0);
  const looseTrash = new THREE.Group();
  const boxScrap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.24), mats.standard('#d97706', 0.85, 0.02));
  boxScrap.position.set(0.1, 0.14, 0.65);
  const leafScrap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mats.standard('#65a30d', 0.85, 0.02));
  leafScrap.position.set(-0.35, 0.14, 0.62);
  looseTrash.add(boxScrap, leafScrap);
  wasteGroup.add(binGreen, binGreenLid, binBlue, binBlueLid, looseTrash);

  tagInteractive(wasteGroup, 'kitchen_waste_bin');
  root.add(wasteGroup);
  interactables.push(wasteGroup);
  labelAnchors.set('kitchen_waste_bin', new THREE.Vector3(2.9, 1.65, 1.35));

  // --- 5. ROOFTOP SOLAR PANELS + INVERTER ---
  const solarGroup = new THREE.Group();
  solarGroup.position.set(-2.0, 3.88, -1.7);
  const panelMat = mats.solarCell();
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.07, 1.75), panelMat);
    p.position.set(-1.35 + i * 1.35, 0, 0);
    p.rotation.x = 0.18;
    p.castShadow = true;
    solarGroup.add(p);
  }
  const inverterLedMat = mats.standard('#64748b', 0.3, 0.3, {emissive: '#10b981', emissiveIntensity: 0.05});
  const inverterBox = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 0.2), inverterLedMat);
  inverterBox.position.set(-2.15, -1.55, 1.7);
  solarGroup.add(inverterBox);

  tagInteractive(solarGroup, 'roof_solar');
  root.add(solarGroup);
  interactables.push(solarGroup);
  labelAnchors.set('roof_solar', new THREE.Vector3(-2.0, 4.75, -1.7));

  return {
    root,
    interactables,
    draggables: [],
    dropZones: [],
    labelAnchors,
    obstacles: [],
    walkBounds: {minX: -4, maxX: 4, minZ: -3, maxZ: 3},
    getInitialState: () =>
      makeBaseState({
        lightsOn: true,
        appliancesEco: false,
        tapOpen: true,
        wasteSorted: false,
        solarActive: false,
      }),
    performAction: (actionId, state) => {
      if (actionId === 'lights_off') {
        return {
          changed: true,
          nextState: pushAction(state, 'lights_off', 'eco_lights', {lightsOn: false}),
          feedbackEn: 'Switched OFF daytime ceiling lights! Illustrative electricity use dropped.',
          feedbackVi: 'Đã tắt đèn trần ban ngày! Chỉ số tiêu thụ điện minh họa giảm ngay.',
          soundKey: 'switch',
          spokenEn: 'Daytime ceiling lights switched off to save electricity.',
        };
      }
      if (actionId === 'lights_on') {
        return {
          changed: true,
          nextState: pushAction(state, 'lights_on', 'eco_lights', {lightsOn: true}),
          feedbackEn: 'Ceiling lights turned back ON.',
          feedbackVi: 'Đã bật lại hệ thống đèn trần.',
          soundKey: 'switch',
        };
      }
      if (actionId === 'appliances_eco') {
        return {
          changed: true,
          nextState: pushAction(state, 'appliances_eco', 'eco_appliances', {appliancesEco: true}),
          feedbackEn: 'Unplugged standby devices and set AC to Eco mode!',
          feedbackVi: 'Đã ngắt điện chờ thiết bị và chuyển điều hòa sang chế độ Eco!',
          soundKey: 'switch',
          spokenEn: 'Standby power unplugged and air conditioner switched to Eco mode.',
        };
      }
      if (actionId === 'tap_close') {
        return {
          changed: true,
          nextState: pushAction(state, 'tap_close', 'eco_tap', {tapOpen: false}),
          feedbackEn: 'Closed the running kitchen tap! Clean water is now conserved.',
          feedbackVi: 'Đã khóa vòi nước đang chảy! Lượng nước lãng phí đã được chặn lại.',
          soundKey: 'switch',
          spokenEn: 'Kitchen tap turned off to conserve fresh water.',
        };
      }
      if (actionId === 'tap_open') {
        return {
          changed: true,
          nextState: pushAction(state, 'tap_open', 'eco_tap', {tapOpen: true}),
          feedbackEn: 'Kitchen tap opened.',
          feedbackVi: 'Đã mở lại vòi nước nhà bếp.',
          soundKey: 'water',
        };
      }
      if (actionId === 'sort_kitchen_waste') {
        return {
          changed: true,
          nextState: pushAction(state, 'sort_kitchen_waste', 'kitchen_waste_bin', {wasteSorted: true}),
          feedbackEn: 'Sorted organic scraps into Compost and cardboard into Recycling!',
          feedbackVi: 'Đã phân loại vỏ rau hữu cơ và bao bì tái chế đúng ngăn!',
          soundKey: 'chime',
          spokenEn: 'Kitchen waste sorted neatly into compost and recycling bins.',
        };
      }
      if (actionId === 'activate_home_solar') {
        return {
          changed: true,
          nextState: pushAction(state, 'activate_home_solar', 'roof_solar', {solarActive: true}),
          feedbackEn: 'Rooftop solar inverter activated! Clean solar energy is powering the house.',
          feedbackVi: 'Đã kích hoạt điện mặt trời mái nhà! Ngôi nhà đang dùng nguồn điện sạch.',
          soundKey: 'success',
          spokenEn: 'Rooftop solar panels activated for sustainable green living.',
        };
      }
      return {changed: false, nextState: state, feedbackEn: '', feedbackVi: ''};
    },
    getMetrics: (state) => {
      let kwh = 16.5;
      if (!state.flags.lightsOn) kwh -= 3.2;
      if (state.flags.appliancesEco) kwh -= 4.8;
      if (state.flags.solarActive) kwh = Math.max(1.2, kwh - 6.5);
      const waterL = state.flags.tapOpen ? 195 : 105;
      const greenScore =
        (!state.flags.lightsOn ? 20 : 0) +
        (state.flags.appliancesEco ? 20 : 0) +
        (!state.flags.tapOpen ? 20 : 0) +
        (state.flags.wasteSorted ? 20 : 0) +
        (state.flags.solarActive ? 20 : 0);
      return [
        {
          id: 'kwh',
          labelEn: 'Electricity (Illustrative)',
          labelVi: 'Điện tiêu thụ (Minh họa)',
          value: `${kwh.toFixed(1)} kWh/ngày`,
          percent: Math.min(100, (kwh / 18) * 100),
          tone: kwh <= 5 ? 'good' : kwh <= 11 ? 'warn' : 'bad',
          illustrative: true,
        },
        {
          id: 'water',
          labelEn: 'Water Usage (Illustrative)',
          labelVi: 'Nước sử dụng (Minh họa)',
          value: `${waterL} L/ngày`,
          percent: Math.min(100, (waterL / 220) * 100),
          tone: waterL <= 120 ? 'good' : 'bad',
          illustrative: true,
        },
        {
          id: 'green_score',
          labelEn: 'Green Living Index',
          labelVi: 'Chỉ số Lối sống xanh',
          value: `${greenScore}%`,
          percent: greenScore,
          tone: greenScore >= 80 ? 'good' : greenScore >= 40 ? 'warn' : 'bad',
        },
      ];
    },
    update: (elapsed, _delta, state, paused) => {
      // Visual state transitions synced continuously
      const on = !!state.flags.lightsOn;
      bulbMat.emissiveIntensity = on ? 1.2 : 0.02;
      roomPointLight.intensity = on ? 2.2 : 0.0;

      const eco = !!state.flags.appliancesEco;
      standbyLedMat.color.set(eco ? '#22c55e' : '#ef4444');
      standbyLedMat.emissive.set(eco ? '#22c55e' : '#ef4444');
      acLedMat.color.set(eco ? '#10b981' : '#f97316');
      acLedMat.emissive.set(eco ? '#10b981' : '#f97316');

      const tapOpen = !!state.flags.tapOpen;
      waterStream.visible = tapOpen;
      if (tapOpen && !paused) {
        waterStream.scale.x = 0.88 + Math.sin(elapsed * 22) * 0.14;
        waterStream.scale.z = 0.88 + Math.cos(elapsed * 22) * 0.14;
      }

      looseTrash.visible = !state.flags.wasteSorted;
      const lidLift = state.flags.wasteSorted ? 0.0 : 0.06;
      binGreenLid.position.y = 0.9 + lidLift;
      binBlueLid.position.y = 0.9 + lidLift;

      const solarOn = !!state.flags.solarActive;
      panelMat.emissiveIntensity = solarOn ? 0.55 + Math.sin(elapsed * 2.5) * 0.1 : 0.08;
      inverterLedMat.emissiveIntensity = solarOn ? 0.9 : 0.05;
    },
    dispose: () => disposeSceneRoot(root, mats),
  };
}

// ============================================================================
// GRADE 12 · UNIT 4: URBANISATION (Transformable Village -> Modern City 3D)
// ============================================================================
export function buildG12U4Urbanisation(): BuiltWorld3DScene {
  const mats = new MaterialLibrary();
  const root = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const labelAnchors = new Map<string, THREE.Vector3>();

  // Rolling green valley terrain base
  const terrain = new THREE.Mesh(
    new THREE.CylinderGeometry(16.5, 17.5, 0.45, 48),
    mats.grass('#65a30d', '#4d7c0f', 8, 8)
  );
  terrain.position.y = -0.225;
  terrain.receiveShadow = true;
  root.add(terrain);

  // Original rural cottages (visible initially on outer rim as context)
  [[-6.5, -5.8], [6.4, -5.6], [-6.8, 5.4]].forEach(([x, z]) => {
    const cottage = new THREE.Group();
    cottage.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 1.1), mats.standard('#fef3c7', 0.85, 0.02));
    body.position.y = 0.45;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.65, 4), mats.standard('#b45309', 0.8, 0.04));
    roof.position.y = 1.22;
    roof.rotation.y = Math.PI / 4;
    cottage.add(body, roof);
    root.add(cottage);
  });

  // --- 1. RESIDENTIAL HOUSING ZONE (Rises into modern apartments) ---
  const housingZone = new THREE.Group();
  housingZone.position.set(-4.0, 0, -3.2);
  const housingPad = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 3.2), mats.standard('#cbd5e1', 0.85, 0.05));
  housingPad.position.y = 0.06;
  housingZone.add(housingPad);

  const apartments = new THREE.Group();
  const apt1 = new THREE.Mesh(new THREE.BoxGeometry(1.45, 3.8, 1.45), mats.buildingFacade('#f1f5f9', '#0284c7'));
  apt1.position.set(-0.9, 1.9, -0.4);
  apt1.castShadow = true;
  const apt2 = new THREE.Mesh(new THREE.BoxGeometry(1.45, 4.6, 1.45), mats.buildingFacade('#e2e8f0', '#38bdf8'));
  apt2.position.set(0.95, 2.3, 0.35);
  apt2.castShadow = true;
  apartments.add(apt1, apt2);
  apartments.scale.y = 0.03;
  apartments.visible = false;
  housingZone.add(apartments);

  tagInteractive(housingZone, 'urb_housing');
  root.add(housingZone);
  interactables.push(housingZone);
  labelAnchors.set('urb_housing', new THREE.Vector3(-4.0, 3.6, -3.2));

  // --- 2. HIGHWAY & PUBLIC TRANSIT ---
  const roadZone = new THREE.Group();
  const dirtTrack = new THREE.Mesh(new THREE.BoxGeometry(14.0, 0.04, 1.6), mats.standard('#a16207', 0.95, 0.01));
  dirtTrack.position.set(0, 0.025, 0.6);
  const pavedAvenue = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.07, 2.4), mats.asphaltRoad(6, 1));
  pavedAvenue.position.set(0, 0.04, 0.6);
  pavedAvenue.visible = false;
  roadZone.add(dirtTrack, pavedAvenue);

  // Public transit electric buses (move along avenue once deployed)
  const busGroup = new THREE.Group();
  const makeBus = (color: string) => {
    const b = new THREE.Group();
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.72, 0.72), mats.standard(color, 0.35, 0.25));
    chassis.position.y = 0.48;
    chassis.castShadow = true;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.28, 0.75), mats.glass('#bae6fd', 0.6));
    glass.position.y = 0.56;
    b.add(chassis, glass);
    return b;
  };
  const busA = makeBus('#0ea5e9');
  busA.position.set(-4.5, 0.05, 0.15);
  const busB = makeBus('#10b981');
  busB.position.set(4.5, 0.05, 1.05);
  busGroup.add(busA, busB);
  busGroup.visible = false;
  roadZone.add(busGroup);

  tagInteractive(roadZone, 'urb_roads');
  root.add(roadZone);
  interactables.push(roadZone);
  labelAnchors.set('urb_roads', new THREE.Vector3(0, 1.75, 0.6));

  // --- 3. SCHOOL & HOSPITAL CAMPUS ---
  const servicesZone = new THREE.Group();
  servicesZone.position.set(4.1, 0, -3.2);
  const servicePad = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.12, 3.2), mats.standard('#e2e8f0', 0.82, 0.05));
  servicePad.position.y = 0.06;
  servicesZone.add(servicePad);

  const serviceBuildings = new THREE.Group();
  // Hospital with red cross emblem
  const hospital = new THREE.Mesh(new THREE.BoxGeometry(1.75, 2.4, 1.65), mats.standard('#ffffff', 0.45, 0.08));
  hospital.position.set(-0.95, 1.2, 0);
  hospital.castShadow = true;
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.08), mats.standard('#ef4444', 0.4, 0.05));
  crossV.position.set(-0.95, 1.8, 0.85);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.08), mats.standard('#ef4444', 0.4, 0.05));
  crossH.position.set(-0.95, 1.8, 0.85);
  // School building with warm terracotta roof
  const school = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.85, 1.55), mats.standard('#fef3c7', 0.65, 0.04));
  school.position.set(1.0, 0.92, 0);
  school.castShadow = true;
  const schoolRoof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 1.7), mats.standard('#ea580c', 0.72, 0.06));
  schoolRoof.position.set(1.0, 1.95, 0);
  serviceBuildings.add(hospital, crossV, crossH, school, schoolRoof);
  serviceBuildings.scale.y = 0.03;
  serviceBuildings.visible = false;
  servicesZone.add(serviceBuildings);

  tagInteractive(servicesZone, 'urb_services');
  root.add(servicesZone);
  interactables.push(servicesZone);
  labelAnchors.set('urb_services', new THREE.Vector3(4.1, 3.1, -3.2));

  // --- 4. GREEN BELT & COMMUNITY PARK ---
  const parkZone = new THREE.Group();
  parkZone.position.set(0, 0, 4.3);
  const parkBase = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.7, 0.14, 28), mats.grass('#22c55e', '#16a34a', 3, 3));
  parkBase.position.y = 0.07;
  parkZone.add(parkBase);

  const parkContent = new THREE.Group();
  const pond = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.08, 24), mats.water('#0ea5e9'));
  pond.position.set(0, 0.14, 0);
  parkContent.add(pond);
  [[-1.6, -0.7], [1.65, -0.6], [-1.3, 1.2], [1.45, 1.15]].forEach(([tx, tz]) => {
    const t = createDetailedTree(mats, 0.95, '#15803d');
    t.position.set(tx, 0.1, tz);
    parkContent.add(t);
  });
  parkContent.scale.setScalar(0.02);
  parkContent.visible = false;
  parkZone.add(parkContent);

  tagInteractive(parkZone, 'urb_park');
  root.add(parkZone);
  interactables.push(parkZone);
  labelAnchors.set('urb_park', new THREE.Vector3(0, 2.7, 4.3));

  return {
    root,
    interactables,
    draggables: [],
    dropZones: [],
    labelAnchors,
    obstacles: [],
    walkBounds: {minX: -7, maxX: 7, minZ: -6, maxZ: 6},
    getInitialState: () =>
      makeBaseState({
        housingBuilt: false,
        roadBuilt: false,
        transitActive: false,
        servicesBuilt: false,
        parkBuilt: false,
      }),
    performAction: (actionId, state) => {
      if (actionId === 'urb_build_housing') {
        return {
          changed: true,
          nextState: pushAction(state, 'urb_build_housing', 'urb_housing', {housingBuilt: true}),
          feedbackEn: 'Constructed modern residential apartments for urban newcomers!',
          feedbackVi: 'Đã xây dựng khu chung cư hiện đại đáp ứng nhu cầu nhà ở đô thị!',
          soundKey: 'build',
          spokenEn: 'Modern residential apartments have been constructed in the housing zone.',
        };
      }
      if (actionId === 'urb_build_road') {
        return {
          changed: true,
          nextState: pushAction(state, 'urb_build_road', 'urb_roads', {roadBuilt: true}),
          feedbackEn: 'Upgraded the rural dirt track into a paved two-lane modern avenue!',
          feedbackVi: 'Đã nâng cấp đường đất thành đại lộ nhựa hiện đại hai làn xe!',
          soundKey: 'build',
          spokenEn: 'A modern paved avenue now connects the urban district.',
        };
      }
      if (actionId === 'urb_add_transit') {
        if (!state.flags.roadBuilt) {
          return {
            changed: false,
            nextState: state,
            feedbackEn: 'Pave the modern avenue first before deploying public buses.',
            feedbackVi: 'Hãy xây đường giao thông hiện đại trước khi triển khai xe buýt công cộng.',
            soundKey: 'error',
          };
        }
        return {
          changed: true,
          nextState: pushAction(state, 'urb_add_transit', 'urb_roads', {transitActive: true}),
          feedbackEn: 'Public transit buses deployed! Commuting is now faster and greener.',
          feedbackVi: 'Đã vận hành tuyến xe buýt công cộng giúp giảm ùn tắc giao thông!',
          soundKey: 'chime',
          spokenEn: 'Public transit buses are now operating smoothly along the avenue.',
        };
      }
      if (actionId === 'urb_build_services') {
        return {
          changed: true,
          nextState: pushAction(state, 'urb_build_services', 'urb_services', {servicesBuilt: true}),
          feedbackEn: 'Built the public school and hospital campus!',
          feedbackVi: 'Đã xây dựng tổ hợp Trường học và Bệnh viện phục vụ người dân!',
          soundKey: 'build',
          spokenEn: 'Public education and healthcare facilities are now open for residents.',
        };
      }
      if (actionId === 'urb_build_park') {
        return {
          changed: true,
          nextState: pushAction(state, 'urb_build_park', 'urb_park', {parkBuilt: true}),
          feedbackEn: 'Created a balanced community green park to keep the city liveable!',
          feedbackVi: 'Đã quy hoạch công viên cây xanh cân bằng với tốc độ đô thị hóa!',
          soundKey: 'plant',
          spokenEn: 'A green community park helps balance rapid urban growth.',
        };
      }
      return {changed: false, nextState: state, feedbackEn: '', feedbackVi: ''};
    },
    getMetrics: (state) => {
      const infra =
        (state.flags.housingBuilt ? 25 : 0) +
        (state.flags.roadBuilt ? 25 : 0) +
        (state.flags.transitActive ? 25 : 0) +
        (state.flags.servicesBuilt ? 25 : 0);
      const balance = state.flags.parkBuilt ? (state.flags.transitActive ? 95 : 75) : infra > 50 ? 35 : 60;
      return [
        {
          id: 'infra',
          labelEn: 'Urban Infrastructure',
          labelVi: 'Hạ tầng đô thị',
          value: `${infra}%`,
          percent: infra,
          tone: infra >= 75 ? 'good' : infra >= 50 ? 'warn' : 'neutral',
        },
        {
          id: 'balance',
          labelEn: 'Sustainability Balance',
          labelVi: 'Cân bằng phát triển bền vững',
          value: `${balance}%`,
          percent: balance,
          tone: balance >= 80 ? 'good' : balance >= 55 ? 'warn' : 'bad',
        },
      ];
    },
    update: (_elapsed, delta, state, paused) => {
      const k = Math.min(1, delta * 4.5);
      if (state.flags.housingBuilt) {
        apartments.visible = true;
        apartments.scale.y = THREE.MathUtils.lerp(apartments.scale.y, 1, k);
      } else {
        apartments.visible = false;
        apartments.scale.y = 0.03;
      }

      dirtTrack.visible = !state.flags.roadBuilt;
      pavedAvenue.visible = !!state.flags.roadBuilt;
      busGroup.visible = !!state.flags.transitActive;
      if (state.flags.transitActive && !paused) {
        busA.position.x += delta * 2.2;
        if (busA.position.x > 6.4) busA.position.x = -6.4;
        busB.position.x -= delta * 2.0;
        if (busB.position.x < -6.4) busB.position.x = 6.4;
      }

      if (state.flags.servicesBuilt) {
        serviceBuildings.visible = true;
        serviceBuildings.scale.y = THREE.MathUtils.lerp(serviceBuildings.scale.y, 1, k);
      } else {
        serviceBuildings.visible = false;
        serviceBuildings.scale.y = 0.03;
      }

      if (state.flags.parkBuilt) {
        parkContent.visible = true;
        const s = THREE.MathUtils.lerp(parkContent.scale.x, 1, k);
        parkContent.scale.setScalar(s);
      } else {
        parkContent.visible = false;
        parkContent.scale.setScalar(0.02);
      }
    },
    dispose: () => disposeSceneRoot(root, mats),
  };
}

// ============================================================================
// GRADE 12 · UNIT 6: ARTIFICIAL INTELLIGENCE (4-DOF Robotic Arm & Automation Lab)
// ============================================================================
export function buildG12U6RoboticsLab(): BuiltWorld3DScene {
  const mats = new MaterialLibrary();
  const root = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const labelAnchors = new Map<string, THREE.Vector3>();

  // Clean high-tech studio floor + worktable
  const labFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(11.5, 12.2, 0.3, 40),
    mats.tileFloor('#e2e8f0', '#94a3b8', 8, 8)
  );
  labFloor.position.y = -0.15;
  labFloor.receiveShadow = true;
  root.add(labFloor);

  // --- 1. AUTOMATED CONVEYOR BELT ---
  const conveyorGroup = new THREE.Group();
  conveyorGroup.position.set(0, 0, -2.0);
  const beltBase = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.72, 1.35), mats.metal('#334155', 0.45, 0.65));
  beltBase.position.y = 0.36;
  beltBase.castShadow = true;
  beltBase.receiveShadow = true;
  const beltSurface = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.08, 1.1), mats.standard('#1e293b', 0.85, 0.1));
  beltSurface.position.y = 0.74;
  conveyorGroup.add(beltBase, beltSurface);

  // Conveyor rollers for visual movement cue
  const rollers: THREE.Mesh[] = [];
  for (let i = -3; i <= 3; i++) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.15, 12), mats.metal('#94a3b8', 0.25, 0.85));
    r.rotation.x = Math.PI / 2;
    r.position.set(i * 0.95, 0.72, 0);
    conveyorGroup.add(r);
    rollers.push(r);
  }

  tagInteractive(conveyorGroup, 'conveyor_belt');
  root.add(conveyorGroup);
  interactables.push(conveyorGroup);
  labelAnchors.set('conveyor_belt', new THREE.Vector3(-2.3, 1.65, -2.0));

  // --- 2. OPTICAL SCANNER GATE ---
  const scannerGroup = new THREE.Group();
  scannerGroup.position.set(0, 0, -2.0);
  const archL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.6, 0.24), mats.metal('#475569', 0.35, 0.75));
  archL.position.set(-0.55, 1.4, 0.62);
  const archR = archL.clone();
  archR.position.set(-0.55, 1.4, -0.62);
  const archTop = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 1.55), mats.standard('#0f172a', 0.3, 0.5));
  archTop.position.set(-0.55, 2.22, 0);
  const laserMat = mats.standard('#22d3ee', 0.2, 0.1, {
    emissive: '#06b6d4',
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.45,
  });
  const laserPlane = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.35, 1.05), laserMat);
  laserPlane.position.set(-0.55, 1.45, 0);
  scannerGroup.add(archL, archR, archTop, laserPlane);

  tagInteractive(scannerGroup, 'scanner_gate');
  root.add(scannerGroup);
  interactables.push(scannerGroup);
  labelAnchors.set('scanner_gate', new THREE.Vector3(-0.55, 2.85, -2.0));

  // --- 3. ARTICULATED 4-DOF ROBOTIC ARM (BaseYaw -> Shoulder -> Elbow -> Dual Gripper) ---
  const robotRoot = new THREE.Group();
  robotRoot.position.set(0.45, 0, 0.65);

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.85, 0.32, 24), mats.metal('#1e293b', 0.35, 0.8));
  pedestal.position.y = 0.16;
  pedestal.castShadow = true;
  robotRoot.add(pedestal);

  // Joint 1: Base Yaw Turret
  const baseYawPivot = new THREE.Group();
  baseYawPivot.position.y = 0.32;
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.54, 0.46, 20), mats.standard('#f59e0b', 0.35, 0.35));
  turret.position.y = 0.23;
  turret.castShadow = true;
  baseYawPivot.add(turret);
  robotRoot.add(baseYawPivot);

  // Joint 2: Shoulder Pitch Pivot
  const shoulderPivot = new THREE.Group();
  shoulderPivot.position.set(0, 0.48, 0);
  const shoulderJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.56, 16), mats.metal('#334155', 0.3, 0.85));
  shoulderJoint.rotation.z = Math.PI / 2;
  const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.68, 0.28), mats.standard('#f59e0b', 0.35, 0.3));
  upperArm.position.y = 0.84;
  upperArm.castShadow = true;
  shoulderPivot.add(shoulderJoint, upperArm);
  baseYawPivot.add(shoulderPivot);

  // Joint 3: Elbow Pitch Pivot
  const elbowPivot = new THREE.Group();
  elbowPivot.position.set(0, 1.65, 0);
  const elbowJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.44, 16), mats.metal('#475569', 0.3, 0.85));
  elbowJoint.rotation.z = Math.PI / 2;
  const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.38, 0.22), mats.standard('#fbbf24', 0.32, 0.28));
  forearm.position.y = 0.68;
  forearm.castShadow = true;
  elbowPivot.add(elbowJoint, forearm);
  shoulderPivot.add(elbowPivot);

  // Joint 4: Wrist + Dual Pneumatic Gripper Fingers
  const wristPivot = new THREE.Group();
  wristPivot.position.set(0, 1.38, 0);
  const wristHub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.18, 14), mats.metal('#0f172a', 0.25, 0.9));
  const fingerL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.12), mats.metal('#cbd5e1', 0.2, 0.9));
  fingerL.position.set(-0.18, 0.2, 0);
  const fingerR = fingerL.clone();
  fingerR.position.set(0.18, 0.2, 0);
  const heldParcelAnchor = new THREE.Group();
  heldParcelAnchor.position.set(0, 0.36, 0);
  wristPivot.add(wristHub, fingerL, fingerR, heldParcelAnchor);
  elbowPivot.add(wristPivot);

  tagInteractive(robotRoot, 'robot_arm');
  root.add(robotRoot);
  interactables.push(robotRoot);
  labelAnchors.set('robot_arm', new THREE.Vector3(0.45, 3.2, 0.65));

  // Sorting Bin + Sorted Stack
  const binGroup = new THREE.Group();
  binGroup.position.set(2.95, 0, 0.75);
  const binBody = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.85, 1.35), mats.standard('#0284c7', 0.45, 0.25));
  binBody.position.y = 0.425;
  binBody.castShadow = true;
  const binRim = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.1, 1.45), mats.standard('#38bdf8', 0.35, 0.2));
  binRim.position.y = 0.88;
  binGroup.add(binBody, binRim);
  root.add(binGroup);

  // Active parcel mesh (transitions seamlessly between conveyor -> gripper -> bin)
  const parcelMat = mats.standard('#10b981', 0.45, 0.12);
  const activeParcel = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.46), parcelMat);
  activeParcel.castShadow = true;
  activeParcel.position.set(-2.4, 1.0, -2.0);
  root.add(activeParcel);

  // Visual target kinematics
  let curBaseYaw = 0;
  let curShoulder = -0.35;
  let curElbow = -1.15;
  let curGripper = 0.2;
  let parcelBeltX = -2.2;
  let autoSeqTimer = 0;

  const parcelColors = ['#10b981', '#3b82f6', '#f43f5e', '#8b5cf6'];

  return {
    root,
    interactables,
    draggables: [],
    dropZones: [],
    labelAnchors,
    obstacles: [],
    walkBounds: {minX: -5, maxX: 5, minZ: -4, maxZ: 4},
    getInitialState: () =>
      makeBaseState(
        {beltAdvanced: false, itemScanned: false, armHolding: false, armAtBin: false, autoSeqRunning: false},
        {sortedCount: 0, baseYawDeg: 0, shoulderDeg: -20, elbowDeg: -65}
      ),
    performAction: (actionId, state, payload) => {
      if (actionId === 'conveyor_advance') {
        parcelBeltX = -0.55;
        return {
          changed: true,
          nextState: pushAction(state, 'conveyor_advance', 'conveyor_belt', {
            beltAdvanced: true,
            itemScanned: false,
            armHolding: false,
            armAtBin: false,
          }),
          feedbackEn: 'Conveyor belt advanced the parcel under the optical scanner!',
          feedbackVi: 'Băng chuyền đã đưa kiện hàng vào đúng vùng cảm biến quét!',
          soundKey: 'servo',
          spokenEn: 'Conveyor belt advancing parcel to the optical recognition scanner.',
        };
      }
      if (actionId === 'robot_scan') {
        parcelBeltX = 0.45;
        return {
          changed: true,
          nextState: pushAction(state, 'robot_scan', 'scanner_gate', {
            beltAdvanced: true,
            itemScanned: true,
          }),
          feedbackEn: 'Optical Scanner classified the parcel using colour & barcode rules!',
          feedbackVi: 'Cổng quét quang học đã phân loại kiện hàng theo quy tắc màu sắc & mã loại!',
          soundKey: 'chime',
          spokenEn: 'Object scanned and classified. Ready for robotic arm pickup.',
        };
      }
      if (actionId === 'robot_pick') {
        if (!state.flags.itemScanned) {
          return {
            changed: false,
            nextState: state,
            feedbackEn: 'Scan the parcel at the Optical Scanner first before picking up.',
            feedbackVi: 'Hãy thực hiện lệnh QUÉT nhận diện vật trên băng chuyền trước khi gắp.',
            soundKey: 'error',
          };
        }
        return {
          changed: true,
          nextState: pushAction(state, 'robot_pick', 'robot_arm', {armHolding: true, armAtBin: false}),
          feedbackEn: '4-DOF Robotic Arm lowered and grasped the parcel securely!',
          feedbackVi: 'Cánh tay Robot 4 khớp đã hạ xuống và kẹp gắp kiện hàng chắc chắn!',
          soundKey: 'servo',
          spokenEn: 'Robotic gripper closed. Parcel picked up from the conveyor belt.',
        };
      }
      if (actionId === 'robot_rotate_bin') {
        if (!state.flags.armHolding) {
          return {
            changed: false,
            nextState: state,
            feedbackEn: 'Pick up the scanned parcel before rotating to the sorting bin.',
            feedbackVi: 'Cánh tay robot cần gắp vật trước khi xoay sang thùng phân loại.',
            soundKey: 'error',
          };
        }
        return {
          changed: true,
          nextState: pushAction(state, 'robot_rotate_bin', 'robot_arm', {armAtBin: true}),
          feedbackEn: 'Base turret rotated cleanly over the sorting bin!',
          feedbackVi: 'Đế xoay robot đã di chuyển kiện hàng tới đúng phía trên thùng phân loại!',
          soundKey: 'servo',
          spokenEn: 'Rotating robotic arm smoothly to the target sorting bin.',
        };
      }
      if (actionId === 'robot_place') {
        if (!state.flags.armAtBin) {
          return {
            changed: false,
            nextState: state,
            feedbackEn: 'Move the arm over the sorting bin before releasing.',
            feedbackVi: 'Hãy xoay cánh tay sang thùng phân loại trước khi thả vật.',
            soundKey: 'error',
          };
        }
        const nextSorted = (state.values.sortedCount ?? 0) + 1;
        parcelMat.color.set(parcelColors[nextSorted % parcelColors.length]);
        parcelBeltX = -2.2;
        return {
          changed: true,
          nextState: pushAction(
            state,
            'robot_place',
            'robot_arm',
            {beltAdvanced: false, itemScanned: false, armHolding: false, armAtBin: false},
            {sortedCount: nextSorted}
          ),
          feedbackEn: `Parcel released into sorting bin! Total sorted: ${nextSorted}.`,
          feedbackVi: `Đã thả kiện hàng vào thùng phân loại! Tổng số kiện đã phân loại: ${nextSorted}.`,
          soundKey: 'success',
          spokenEn: 'Parcel released accurately into the sorting bin.',
        };
      }
      if (actionId === 'robot_auto_seq') {
        autoSeqTimer = 3.2;
        const nextSorted = (state.values.sortedCount ?? 0) + 1;
        parcelMat.color.set(parcelColors[nextSorted % parcelColors.length]);
        return {
          changed: true,
          nextState: pushAction(
            state,
            'robot_auto_seq',
            'robot_arm',
            {beltAdvanced: false, itemScanned: false, armHolding: false, armAtBin: false, autoSeqRunning: true},
            {sortedCount: nextSorted}
          ),
          feedbackEn: 'Executed full English Command Sequence: ADVANCE → SCAN → PICK → MOVE → PLACE!',
          feedbackVi: 'Đã chạy trọn vẹn chuỗi lệnh tự động tiếng Anh: ADVANCE → SCAN → PICK → MOVE → PLACE!',
          soundKey: 'success',
          spokenEn: 'Executing automated command sequence: advance, scan, pick up, move to bin, and release.',
        };
      }
      if (actionId === 'robot_joint_tune' && payload && typeof payload.value === 'number') {
        const joint = payload.targetId ?? 'baseYawDeg';
        return {
          changed: true,
          nextState: {
            ...state,
            values: {...state.values, [joint]: payload.value},
          },
          feedbackEn: `Adjusted robot joint (${joint}) to ${payload.value}°.`,
          feedbackVi: `Đã điều chỉnh góc khớp robot (${joint}) sang ${payload.value}°.`,
          soundKey: 'servo',
        };
      }
      return {changed: false, nextState: state, feedbackEn: '', feedbackVi: ''};
    },
    getMetrics: (state) => {
      const sorted = state.values.sortedCount ?? 0;
      const stageLabel = state.flags.armAtBin
        ? 'Over Sorting Bin'
        : state.flags.armHolding
          ? 'Holding Parcel'
          : state.flags.itemScanned
            ? 'Parcel Scanned'
            : state.flags.beltAdvanced
              ? 'At Scanner Gate'
              : 'Idle / Ready';
      return [
        {
          id: 'sorted',
          labelEn: 'Parcels Sorted',
          labelVi: 'Kiện hàng đã phân loại',
          value: `${sorted} items`,
          percent: Math.min(100, sorted * 25),
          tone: sorted >= 2 ? 'good' : 'neutral',
        },
        {
          id: 'state',
          labelEn: 'Automation Cycle State',
          labelVi: 'Trạng thái chu trình',
          value: stageLabel,
          percent: state.flags.armAtBin ? 90 : state.flags.armHolding ? 65 : state.flags.itemScanned ? 40 : 15,
          tone: state.flags.itemScanned || state.flags.armHolding ? 'good' : 'neutral',
        },
      ];
    },
    update: (elapsed, delta, state, paused) => {
      if (paused) return;
      const k = Math.min(1, delta * 5.2);

      // Animate conveyor rollers subtly when active
      if (state.flags.beltAdvanced || autoSeqTimer > 0) {
        rollers.forEach((r) => {
          r.rotation.z -= delta * 3.0;
        });
      }

      // Scanner laser pulse
      laserMat.emissiveIntensity = state.flags.itemScanned ? 1.8 : 0.7 + Math.sin(elapsed * 5) * 0.25;

      // Determine target joint angles based on auto sequence or manual state
      let targetYaw = ((state.values.baseYawDeg ?? 0) * Math.PI) / 180;
      let targetShoulder = ((state.values.shoulderDeg ?? -20) * Math.PI) / 180;
      let targetElbow = ((state.values.elbowDeg ?? -65) * Math.PI) / 180;
      let targetGrip = 0.21;
      let attachToGripper = !!state.flags.armHolding;

      if (autoSeqTimer > 0) {
        autoSeqTimer = Math.max(0, autoSeqTimer - delta);
        const p = 1 - autoSeqTimer / 3.2; // 0..1
        if (p < 0.25) {
          targetYaw = 0;
          targetShoulder = -0.55;
          targetElbow = -1.25;
          targetGrip = 0.22;
          parcelBeltX = THREE.MathUtils.lerp(-2.2, 0.45, p / 0.25);
          attachToGripper = false;
        } else if (p < 0.55) {
          targetYaw = 0;
          targetShoulder = -0.92;
          targetElbow = -0.95;
          targetGrip = 0.13;
          attachToGripper = true;
        } else if (p < 0.85) {
          targetYaw = -Math.PI * 0.52;
          targetShoulder = -0.62;
          targetElbow = -1.05;
          targetGrip = 0.13;
          attachToGripper = true;
        } else {
          targetYaw = -Math.PI * 0.52;
          targetShoulder = -0.35;
          targetElbow = -1.1;
          targetGrip = 0.23;
          attachToGripper = false;
        }
      } else if (state.flags.armAtBin) {
        targetYaw = -Math.PI * 0.52;
        targetShoulder = -0.64;
        targetElbow = -1.05;
        targetGrip = 0.13;
      } else if (state.flags.armHolding) {
        targetYaw = 0;
        targetShoulder = -0.52;
        targetElbow = -1.08;
        targetGrip = 0.13;
      } else if (state.flags.itemScanned) {
        targetYaw = 0;
        targetShoulder = -0.82;
        targetElbow = -0.95;
        targetGrip = 0.22;
      }

      curBaseYaw = THREE.MathUtils.lerp(curBaseYaw, targetYaw, k);
      curShoulder = THREE.MathUtils.lerp(curShoulder, targetShoulder, k);
      curElbow = THREE.MathUtils.lerp(curElbow, targetElbow, k);
      curGripper = THREE.MathUtils.lerp(curGripper, targetGrip, k);

      baseYawPivot.rotation.y = curBaseYaw;
      shoulderPivot.rotation.x = curShoulder;
      elbowPivot.rotation.x = curElbow;
      fingerL.position.x = -curGripper;
      fingerR.position.x = curGripper;

      // Position parcel smoothly
      if (attachToGripper) {
        const worldPos = new THREE.Vector3();
        heldParcelAnchor.getWorldPosition(worldPos);
        activeParcel.position.lerp(worldPos, Math.min(1, delta * 12));
      } else {
        const targetX = state.flags.itemScanned ? 0.45 : state.flags.beltAdvanced ? -0.55 : parcelBeltX;
        activeParcel.position.lerp(new THREE.Vector3(targetX, 1.0, -2.0), Math.min(1, delta * 6));
      }
    },
    dispose: () => disposeSceneRoot(root, mats),
  };
}

// ============================================================================
// GRADE 12 · UNIT 8: WILDLIFE CONSERVATION (Walkable Nature Sanctuary 3D)
// ============================================================================
export function buildG12U8WildlifeSanctuary(): BuiltWorld3DScene {
  const mats = new MaterialLibrary();
  const root = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const labelAnchors = new Map<string, THREE.Vector3>();
  const obstacles: Array<{minX: number; maxX: number; minZ: number; maxZ: number}> = [];

  // Lush nature reserve ground + watering hole + perimeter trees
  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(16.5, 17.5, 0.4, 48),
    mats.grass('#3f7d3a', '#2e632a', 8, 8)
  );
  ground.position.y = -0.2;
  ground.receiveShadow = true;
  root.add(ground);

  const wateringHole = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.5, 0.1, 32), mats.water('#0284c7'));
  wateringHole.position.set(2.4, 0.04, -2.6);
  root.add(wateringHole);

  // Decorative sanctuary forest trees around perimeter
  [
    [-7.2, -5.5, 1.25],
    [-6.8, 2.2, 1.1],
    [-2.5, -7.0, 1.3],
    [6.5, -5.8, 1.2],
    [7.2, 2.8, 1.15],
    [3.5, 6.2, 1.0],
  ].forEach(([tx, tz, sc]) => {
    const tr = createDetailedTree(mats, sc, '#166534');
    tr.position.set(tx, 0, tz);
    root.add(tr);
  });

  // --- 1. MUDDY ANIMAL TRACKS ---
  const tracksGroup = new THREE.Group();
  tracksGroup.position.set(-1.6, 0.03, 1.8);
  const trackMat = mats.standard('#78350f', 0.92, 0.02);
  const glowTrackMat = mats.standard('#fbbf24', 0.4, 0.1, {emissive: '#f59e0b', emissiveIntensity: 0.35});
  const printMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const print = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.04, 14), trackMat);
    print.position.set(i * 0.58 - 0.8, 0.01, -i * 0.62 + 0.6);
    tracksGroup.add(print);
    printMeshes.push(print);
  }
  const trackMarker = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 10), glowTrackMat);
  trackMarker.rotation.x = Math.PI;
  trackMarker.position.set(0.4, 0.95, -0.4);
  tracksGroup.add(trackMarker);

  tagInteractive(tracksGroup, 'wildlife_tracks');
  root.add(tracksGroup);
  interactables.push(tracksGroup);
  labelAnchors.set('wildlife_tracks', new THREE.Vector3(-1.2, 1.5, 1.4));

  // --- 2. ARTICULATED ASIAN ELEPHANT (Body, Head, Flapping Ears, Swinging Trunk, Tusks) ---
  const elephantGroup = new THREE.Group();
  elephantGroup.position.set(2.1, 0, -0.4);
  const eleMat = mats.standard('#64748b', 0.84, 0.04);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.25, 2.2), eleMat);
  body.position.y = 1.48;
  body.castShadow = true;
  elephantGroup.add(body);

  [[-0.45, 0.72], [0.45, 0.72], [-0.45, -0.72], [0.45, -0.72]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 1.05, 12), eleMat);
    leg.position.set(lx, 0.525, lz);
    leg.castShadow = true;
    elephantGroup.add(leg);
  });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 14), eleMat);
  head.position.set(0, 1.85, 1.22);
  head.castShadow = true;
  const earL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.1), eleMat);
  earL.position.set(-0.68, 1.9, 1.05);
  const earR = earL.clone();
  earR.position.x = 0.68;

  const trunkPivot = new THREE.Group();
  trunkPivot.position.set(0, 1.65, 1.72);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.08, 1.15, 12), eleMat);
  trunk.position.y = -0.52;
  trunk.rotation.x = 0.22;
  trunkPivot.add(trunk);

  const tuskMat = mats.standard('#fef9c3', 0.35, 0.05);
  const tuskL = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.48, 10), tuskMat);
  tuskL.position.set(-0.24, 1.46, 1.72);
  tuskL.rotation.x = Math.PI * 0.42;
  const tuskR = tuskL.clone();
  tuskR.position.x = 0.24;

  elephantGroup.add(head, earL, earR, trunkPivot, tuskL, tuskR);
  elephantGroup.rotation.y = -0.55;

  tagInteractive(elephantGroup, 'asian_elephant');
  root.add(elephantGroup);
  interactables.push(elephantGroup);
  labelAnchors.set('asian_elephant', new THREE.Vector3(2.1, 2.95, -0.4));
  obstacles.push({minX: 0.7, maxX: 3.5, minZ: -2.0, maxZ: 1.2});

  // --- 3. ILLEGAL POACHING SNARE HAZARD ---
  const hazardGroup = new THREE.Group();
  hazardGroup.position.set(-4.0, 0, -2.2);
  const snareLoop = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.045, 10, 24),
    mats.standard('#dc2626', 0.4, 0.5, {emissive: '#ef4444', emissiveIntensity: 0.45})
  );
  snareLoop.rotation.x = Math.PI / 2;
  snareLoop.position.y = 0.12;
  const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.75, 10), mats.wood('#78350f', '#451a03', 1, 1));
  stake.position.set(-0.5, 0.37, 0);
  const warningSign = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.52, 0.06),
    mats.signTexture('HAZARD', 'Illegal Snare', '#fee2e2', '#991b1b')
  );
  warningSign.position.set(0, 1.05, 0);
  hazardGroup.add(snareLoop, stake, warningSign);

  tagInteractive(hazardGroup, 'forest_hazard');
  root.add(hazardGroup);
  interactables.push(hazardGroup);
  labelAnchors.set('forest_hazard', new THREE.Vector3(-4.0, 1.75, -2.2));

  // --- 4. WILDLIFE RESCUE MEDICAL TENT + PATROL DRONE ---
  const rescueGroup = new THREE.Group();
  rescueGroup.position.set(-4.3, 0, 2.6);
  const tentBody = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.55, 2.1), mats.standard('#f8fafc', 0.78, 0.02));
  tentBody.position.y = 0.78;
  tentBody.castShadow = true;
  const tentRoof = new THREE.Mesh(new THREE.ConeGeometry(1.95, 0.9, 4), mats.standard('#0f766e', 0.75, 0.04));
  tentRoof.position.y = 2.0;
  tentRoof.rotation.y = Math.PI / 4;
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.48, 0.06), mats.standard('#ef4444', 0.4, 0.05));
  crossV.position.set(0, 1.15, 1.08);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.06), mats.standard('#ef4444', 0.4, 0.05));
  crossH.position.set(0, 1.15, 1.08);
  const rescueSign = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.5, 0.06),
    mats.signTexture('RESCUE CENTRE', 'Wildlife Care & Patrol', '#ecfdf5', '#065f46')
  );
  rescueSign.position.set(0, 0.52, 1.08);
  rescueGroup.add(tentBody, tentRoof, crossV, crossH, rescueSign);

  // Conservation patrol drone hovering once protection plan is enforced
  const patrolDrone = new THREE.Group();
  const droneCore = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.45), mats.standard('#0ea5e9', 0.3, 0.5));
  patrolDrone.add(droneCore);
  patrolDrone.position.set(0, 3.3, 0);
  patrolDrone.visible = false;
  rescueGroup.add(patrolDrone);

  tagInteractive(rescueGroup, 'rescue_station');
  root.add(rescueGroup);
  interactables.push(rescueGroup);
  labelAnchors.set('rescue_station', new THREE.Vector3(-4.3, 2.95, 2.6));
  obstacles.push({minX: -5.8, maxX: -2.8, minZ: 1.4, maxZ: 3.9});

  // Ranger Character
  const {group: charGroup, limbs} = createArticulatedCharacter(mats, '#15803d', '#422006');
  charGroup.position.set(0.2, 0, 4.9);
  root.add(charGroup);

  return {
    root,
    interactables,
    draggables: [],
    dropZones: [],
    labelAnchors,
    obstacles,
    walkBounds: {minX: -6.8, maxX: 6.8, minZ: -5.8, maxZ: 5.8},
    characterGroup: charGroup,
    characterLimbs: limbs,
    getInitialState: () =>
      makeBaseState(
        {tracksFollowed: false, elephantLogged: false, snareRemoved: false, rescued: false, planApproved: false},
        {},
        [0.2, 0, 4.9]
      ),
    performAction: (actionId, state) => {
      if (actionId === 'follow_tracks') {
        return {
          changed: true,
          nextState: pushAction(state, 'follow_tracks', 'wildlife_tracks', {tracksFollowed: true}),
          feedbackEn: 'Followed the muddy wildlife footprints toward the watering hole!',
          feedbackVi: 'Đã lần theo dấu chân động vật dẫn tới khu vực hồ nước bảo tồn!',
          soundKey: 'chime',
          spokenEn: 'Wildlife tracks logged! Follow them carefully to observe the Asian elephant.',
        };
      }
      if (actionId === 'identify_elephant') {
        return {
          changed: true,
          nextState: pushAction(state, 'identify_elephant', 'asian_elephant', {elephantLogged: true}),
          feedbackEn: 'Identified Endangered Asian Elephant and recorded its healthy condition.',
          feedbackVi: 'Đã nhận diện Voi châu Á (loài nguy cấp) và ghi nhận tình trạng sức khỏe tốt.',
          soundKey: 'chime',
          spokenEn: 'Asian elephant identified and logged in the sanctuary conservation register.',
        };
      }
      if (actionId === 'remove_snare') {
        return {
          changed: true,
          nextState: pushAction(state, 'remove_snare', 'forest_hazard', {snareRemoved: true}),
          feedbackEn: 'Safely removed the illegal poaching snare! The wildlife corridor is now safe.',
          feedbackVi: 'Đã gỡ bỏ an toàn bẫy săn trái phép! Hành lang rừng đã an toàn.',
          soundKey: 'success',
          spokenEn: 'Illegal poaching snare removed to protect the wildlife habitat.',
        };
      }
      if (actionId === 'rescue_treat') {
        return {
          changed: true,
          nextState: pushAction(state, 'rescue_treat', 'rescue_station', {rescued: true}),
          feedbackEn: 'Treated the injured wild animal at the Rescue Centre and released it safely!',
          feedbackVi: 'Đã thực hiện chăm sóc cứu hộ và thả động vật khỏe mạnh về rừng bảo tồn!',
          soundKey: 'chime',
          spokenEn: 'Wildlife rescue mission completed and animal safely released back into the reserve.',
        };
      }
      if (actionId === 'approve_conservation') {
        return {
          changed: true,
          nextState: pushAction(state, 'approve_conservation', 'rescue_station', {planApproved: true}),
          feedbackEn: 'Sanctuary Protection Plan activated with patrol monitoring & community education!',
          feedbackVi: 'Đã kích hoạt Kế hoạch Bảo tồn toàn diện với tuần tra giám sát và giáo dục cộng đồng!',
          soundKey: 'success',
          spokenEn: 'Long-term sanctuary protection plan enforced for sustainable wildlife conservation.',
        };
      }
      return {changed: false, nextState: state, feedbackEn: '', feedbackVi: ''};
    },
    getMetrics: (state) => {
      const safety =
        (state.flags.tracksFollowed ? 15 : 0) +
        (state.flags.elephantLogged ? 20 : 0) +
        (state.flags.snareRemoved ? 25 : 0) +
        (state.flags.rescued ? 20 : 0) +
        (state.flags.planApproved ? 20 : 0);
      return [
        {
          id: 'safety',
          labelEn: 'Sanctuary Safety Index',
          labelVi: 'Chỉ số An toàn Khu bảo tồn',
          value: `${safety}%`,
          percent: safety,
          tone: safety >= 80 ? 'good' : safety >= 40 ? 'warn' : 'bad',
        },
        {
          id: 'poaching_risk',
          labelEn: 'Poaching Hazard',
          labelVi: 'Nguy cơ bẫy săn',
          value: state.flags.snareRemoved ? 'Cleared (An toàn)' : 'Active Hazard',
          percent: state.flags.snareRemoved ? 10 : 85,
          tone: state.flags.snareRemoved ? 'good' : 'bad',
        },
      ];
    },
    update: (elapsed, _delta, state, paused) => {
      if (paused) return;
      // Gentle living animation on Asian elephant
      trunkPivot.rotation.x = Math.sin(elapsed * 1.9) * 0.24;
      earL.rotation.y = Math.sin(elapsed * 2.4) * 0.18;
      earR.rotation.y = -Math.sin(elapsed * 2.4) * 0.18;
      trackMarker.position.y = 0.95 + Math.sin(elapsed * 3.5) * 0.12;
      trackMarker.visible = !state.flags.tracksFollowed;

      // Hide snare once removed
      hazardGroup.visible = !state.flags.snareRemoved;

      // Patrol drone orbits sanctuary once conservation plan approved
      patrolDrone.visible = !!state.flags.planApproved;
      if (state.flags.planApproved) {
        patrolDrone.position.x = Math.cos(elapsed * 0.9) * 3.8;
        patrolDrone.position.z = Math.sin(elapsed * 0.9) * 3.4;
        patrolDrone.position.y = 3.5 + Math.sin(elapsed * 3.0) * 0.18;
        patrolDrone.rotation.y = -elapsed * 0.9;
      }
    },
    dispose: () => disposeSceneRoot(root, mats),
  };
}
