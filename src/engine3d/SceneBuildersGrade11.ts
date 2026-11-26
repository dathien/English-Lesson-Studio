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
  characterPos: [number, number, number] = [0, 0, 4.4]
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
// GRADE 11 · UNIT 3: CITIES OF THE FUTURE (Smart District + Moving Transit)
// ============================================================================
export function buildG11U3SmartCity(): BuiltWorld3DScene {
  const mats = new MaterialLibrary();
  const root = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const labelAnchors = new Map<string, THREE.Vector3>();

  // Urban ground platform + intersecting multi-lane asphalt avenues
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(17.5, 18.5, 0.4, 48), mats.standard('#cbd5e1', 0.88, 0.04));
  ground.position.y = -0.2;
  ground.receiveShadow = true;
  root.add(ground);

  const roadNS = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 16.0), mats.asphaltRoad(1, 5));
  roadNS.position.set(0, 0.025, 0);
  const roadEW = new THREE.Mesh(new THREE.BoxGeometry(16.0, 0.05, 2.4), mats.asphaltRoad(5, 1));
  roadEW.position.set(0, 0.026, 0);
  root.add(roadNS, roadEW);

  // Existing background smart city buildings
  const bgPositions: Array<[number, number, number, string]> = [
    [-5.8, 3.2, -5.2, '#dbeafe'],
    [5.6, 2.8, -5.4, '#e2e8f0'],
    [5.8, 2.5, 5.2, '#e0f2fe'],
  ];
  bgPositions.forEach(([x, h, z, c]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.0, h, 2.0), mats.buildingFacade(c, '#0284c7'));
    b.position.set(x, h / 2, z);
    b.castShadow = true;
    root.add(b);
  });

  // --- 1. GREEN SKYSCRAPER CONSTRUCTION PLOT (Rises smoothly when built!) ---
  const towerPlot = new THREE.Group();
  towerPlot.position.set(-3.4, 0, -3.2);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 2.6), mats.standard('#94a3b8', 0.85, 0.05));
  pad.position.y = 0.07;
  towerPlot.add(pad);

  const towerGroup = new THREE.Group();
  const towerMain = new THREE.Mesh(new THREE.BoxGeometry(2.0, 4.4, 2.0), mats.buildingFacade('#f1f5f9', '#0ea5e9'));
  towerMain.position.y = 2.2;
  towerMain.castShadow = true;
  const skyGarden1 = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.25, 2.25), mats.standard('#16a34a', 0.85, 0.02));
  skyGarden1.position.y = 2.1;
  const skyGarden2 = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.25, 2.25), mats.standard('#22c55e', 0.85, 0.02));
  skyGarden2.position.y = 4.45;
  towerGroup.add(towerMain, skyGarden1, skyGarden2);
  towerGroup.scale.y = 0.04;
  towerGroup.visible = false;
  towerPlot.add(towerGroup);

  tagInteractive(towerPlot, 'smart_tower_plot');
  root.add(towerPlot);
  interactables.push(towerPlot);
  labelAnchors.set('smart_tower_plot', new THREE.Vector3(-3.4, 3.6, -3.2));

  // --- 2. CENTRAL ECO-PARK ZONE ---
  const parkPlot = new THREE.Group();
  parkPlot.position.set(-3.4, 0, 3.3);
  const parkLawn = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 3.2), mats.grass('#4ade80', '#22c55e', 3, 3));
  parkLawn.position.y = 0.06;
  parkPlot.add(parkLawn);

  const parkTrees = new THREE.Group();
  [[-0.9, -0.8], [0.85, -0.7], [0, 0.85]].forEach(([tx, tz]) => {
    const tr = createDetailedTree(mats, 0.85, '#15803d');
    tr.position.set(tx, 0.1, tz);
    parkTrees.add(tr);
  });
  parkTrees.scale.setScalar(0.01);
  parkTrees.visible = false;
  parkPlot.add(parkTrees);

  tagInteractive(parkPlot, 'city_park_plot');
  root.add(parkPlot);
  interactables.push(parkPlot);
  labelAnchors.set('city_park_plot', new THREE.Vector3(-3.4, 2.2, 3.3));

  // --- 3. SOLAR POWER ARRAY STATION ---
  const solarStation = new THREE.Group();
  solarStation.position.set(3.4, 0, -3.2);
  const stationBase = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.3, 2.2), mats.standard('#e2e8f0', 0.5, 0.15));
  stationBase.position.y = 0.65;
  stationBase.castShadow = true;
  solarStation.add(stationBase);

  const solarPanels = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 1.6), mats.solarCell());
    panel.position.set(-0.62 + i * 1.24, 1.55, 0);
    panel.rotation.x = 0.32;
    panel.castShadow = true;
    solarPanels.add(panel);
  }
  solarPanels.visible = false;
  solarStation.add(solarPanels);

  tagInteractive(solarStation, 'solar_roof');
  root.add(solarStation);
  interactables.push(solarStation);
  labelAnchors.set('solar_roof', new THREE.Vector3(3.4, 2.4, -3.2));

  // --- 4. SMART TRAFFIC HUB + AUTONOMOUS ELECTRIC BUS ---
  const hubGroup = new THREE.Group();
  hubGroup.position.set(3.4, 0, 3.2);
  const hubBuilding = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.5, 1.8), mats.standard('#1e293b', 0.4, 0.4));
  hubBuilding.position.y = 0.75;
  hubBuilding.castShadow = true;
  const signalLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 14, 12),
    mats.standard('#f59e0b', 0.2, 0.1, {emissive: '#f59e0b', emissiveIntensity: 0.75})
  );
  signalLight.position.set(-1.1, 2.0, -0.8);
  const signalPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.0, 8), mats.metal('#475569', 0.3, 0.8));
  signalPole.position.set(-1.1, 1.0, -0.8);
  hubGroup.add(hubBuilding, signalPole, signalLight);
  tagInteractive(hubGroup, 'traffic_hub');
  root.add(hubGroup);
  interactables.push(hubGroup);
  labelAnchors.set('traffic_hub', new THREE.Vector3(3.4, 2.55, 3.2));

  // Autonomous Electric Bus moving along road
  const busGroup = new THREE.Group();
  const busBody = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.72, 2.1), mats.standard('#0284c7', 0.3, 0.25));
  busBody.position.y = 0.52;
  busBody.castShadow = true;
  const busGlass = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.3, 1.75), mats.glass('#e0f2fe', 0.65));
  busGlass.position.y = 0.62;
  busGroup.add(busBody, busGlass);
  busGroup.position.set(0.55, 0, -5.5);
  busGroup.visible = false;
  root.add(busGroup);

  return {
    root,
    interactables,
    draggables: [],
    dropZones: [],
    labelAnchors,
    obstacles: [],
    walkBounds: {minX: -7, maxX: 7, minZ: -7, maxZ: 7},
    getInitialState: () =>
      makeBaseState({towerBuilt: false, parkBuilt: false, solarInstalled: false, trafficOptimized: false, ebusRunning: false}),
    performAction: (actionId, state) => {
      switch (actionId) {
        case 'build_tower':
          return {changed: true, nextState: pushAction(state, 'build_tower', 'smart_tower_plot', {towerBuilt: true}), feedbackEn: 'Green Skyscraper constructed with vertical sky gardens!', feedbackVi: 'Đã xây dựng Tòa nhà cao tầng xanh với vườn trên không!', soundKey: 'build', spokenEn: 'The smart green skyscraper is now built.'};
        case 'build_park':
          return {changed: true, nextState: pushAction(state, 'build_park', 'city_park_plot', {parkBuilt: true}), feedbackEn: 'Urban Green Park opened for pedestrians!', feedbackVi: 'Đã xây dựng Công viên đô thị rợp bóng cây xanh!', soundKey: 'plant', spokenEn: 'The pedestrian park makes the city more liveable.'};
        case 'install_solar':
          return {changed: true, nextState: pushAction(state, 'install_solar', 'solar_roof', {solarInstalled: true}), feedbackEn: 'Rooftop solar panels activated across the energy hub!', feedbackVi: 'Đã lắp đặt giàn pin năng lượng mặt trời cung cấp điện sạch!', soundKey: 'build', spokenEn: 'Solar panels now supply renewable electricity.'};
        case 'optimize_traffic':
          return {changed: true, nextState: pushAction(state, 'optimize_traffic', 'traffic_hub', {trafficOptimized: true}), feedbackEn: 'Smart sensors synchronized green-wave traffic lights!', feedbackVi: 'Hệ thống cảm biến đã tối ưu đèn tín hiệu giao thông xanh!', soundKey: 'click', spokenEn: 'Traffic flow is now smooth and efficient.'};
        case 'launch_ebus':
          return {changed: true, nextState: pushAction(state, 'launch_ebus', 'traffic_hub', {ebusRunning: true}), feedbackEn: 'Zero-emission electric public bus is cruising the avenue!', feedbackVi: 'Xe buýt điện công cộng đã lăn bánh vận hành êm ái!', soundKey: 'mission_complete', spokenEn: 'The electric public bus is now operating along the avenue.'};
        default:
          return {changed: false, nextState: state, feedbackEn: '', feedbackVi: ''};
      }
    },
    getMetrics: (state) => {
      const done = [state.flags.towerBuilt, state.flags.parkBuilt, state.flags.solarInstalled, state.flags.trafficOptimized, state.flags.ebusRunning].filter(Boolean).length;
      return [
        {id: 'smart', labelEn: 'Smart City Readiness', labelVi: 'Độ hoàn thiện Đô thị thông minh', value: `${done * 20}%`, percent: done * 20, tone: done >= 4 ? 'good' : 'neutral'},
        {id: 'transit', labelEn: 'Traffic Status', labelVi: 'Tình trạng giao thông', value: state.flags.trafficOptimized ? 'Thông thoáng' : 'Cần tối ưu', percent: state.flags.trafficOptimized ? 95 : 40, tone: state.flags.trafficOptimized ? 'good' : 'warn'},
      ];
    },
    update: (elapsed, delta, state, paused) => {
      const d = paused ? 0 : delta || 0.016;
      towerGroup.visible = Boolean(state.flags.towerBuilt);
      towerGroup.scale.y = THREE.MathUtils.damp(towerGroup.scale.y, state.flags.towerBuilt ? 1 : 0.04, 4, d);

      parkTrees.visible = Boolean(state.flags.parkBuilt);
      const ps = THREE.MathUtils.damp(parkTrees.scale.x, state.flags.parkBuilt ? 1 : 0.01, 4.5, d);
      parkTrees.scale.setScalar(ps);

      solarPanels.visible = Boolean(state.flags.solarInstalled);

      const sigMat = signalLight.material as THREE.MeshStandardMaterial;
      sigMat.color.set(state.flags.trafficOptimized ? '#10b981' : '#f59e0b');
      sigMat.emissive.set(state.flags.trafficOptimized ? '#10b981' : '#f59e0b');

      busGroup.visible = Boolean(state.flags.ebusRunning);
      if (state.flags.ebusRunning && !paused) {
        const speed = state.flags.trafficOptimized ? 2.6 : 1.4;
        const z = ((elapsed * speed + 7.5) % 15) - 7.5;
        busGroup.position.set(0.55, 0, z);
      }
    },
    dispose: () => disposeSceneRoot(root, mats),
  };
}

// ============================================================================
// GRADE 11 · UNIT 5: GLOBAL WARMING (3D Earth + Greenhouse Shell + Energy)
// ============================================================================
export function buildG11U5GlobalWarming(): BuiltWorld3DScene {
  const mats = new MaterialLibrary();
  const root = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const labelAnchors = new Map<string, THREE.Vector3>();

  // Base platform
  const base = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.6, 0.35, 48), mats.standard('#e2e8f0', 0.7, 0.12));
  base.position.y = -0.175;
  base.receiveShadow = true;
  root.add(base);

  // --- 1. CENTRAL 3D EARTH + DYNAMIC POLAR ICE + GREENHOUSE SHELL ---
  const earthGroup = new THREE.Group();
  earthGroup.position.set(0, 2.35, 0);

  const earthSphere = new THREE.Mesh(new THREE.SphereGeometry(1.55, 32, 24), mats.earthGlobe());
  earthSphere.castShadow = true;
  earthGroup.add(earthSphere);

  const polarCapNorth = new THREE.Mesh(
    new THREE.SphereGeometry(1.58, 22, 12, 0, Math.PI * 2, 0, 0.55),
    mats.standard('#f8fafc', 0.4, 0.05)
  );
  earthGroup.add(polarCapNorth);

  const greenhouseShellMat = new THREE.MeshStandardMaterial({
    color: '#ef4444',
    transparent: true,
    opacity: 0.32,
    roughness: 0.25,
    side: THREE.DoubleSide,
  });
  const greenhouseShell = new THREE.Mesh(new THREE.SphereGeometry(1.98, 28, 22), greenhouseShellMat);
  earthGroup.add(greenhouseShell);

  tagInteractive(earthGroup, 'earth_model');
  root.add(earthGroup);
  interactables.push(earthGroup);
  labelAnchors.set('earth_model', new THREE.Vector3(0, 4.55, 0));

  // --- 2. FOSSIL FUEL POWER PLANT WITH ANIMATED SMOKE PLUMES ---
  const coalGroup = new THREE.Group();
  coalGroup.position.set(-4.3, 0, -1.6);
  const factory = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.35, 1.4), mats.standard('#475569', 0.75, 0.2));
  factory.position.y = 0.675;
  factory.castShadow = true;
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 2.1, 14), mats.standard('#334155', 0.8, 0.2));
  chimney.position.set(0.45, 1.65, 0);
  coalGroup.add(factory, chimney);

  const smokePuffs: THREE.Mesh[] = [];
  const smokeMat = mats.standard('#475569', 0.95, 0, {transparent: true, opacity: 0.62});
  for (let i = 0; i < 5; i++) {
    const sm = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 1), smokeMat);
    sm.position.set(0.45, 2.8 + i * 0.35, 0);
    coalGroup.add(sm);
    smokePuffs.push(sm);
  }

  tagInteractive(coalGroup, 'coal_plant');
  root.add(coalGroup);
  interactables.push(coalGroup);
  labelAnchors.set('coal_plant', new THREE.Vector3(-4.3, 3.0, -1.6));

  // --- 3. WIND TURBINE FARM ---
  const windGroup = new THREE.Group();
  windGroup.position.set(4.3, 0, -1.6);
  const windRotors: THREE.Group[] = [];
  [-0.75, 0.75].forEach((ox) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 2.7, 10), mats.standard('#f8fafc', 0.3, 0.25));
    pole.position.set(ox, 1.35, 0);
    pole.castShadow = true;
    const rotor = new THREE.Group();
    rotor.position.set(ox, 2.7, 0.16);
    for (let b = 0; b < 3; b++) {
      const wrap = new THREE.Group();
      wrap.rotation.z = (b * Math.PI * 2) / 3;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.95, 0.03), mats.standard('#ffffff', 0.25, 0.2));
      blade.position.y = 0.48;
      wrap.add(blade);
      rotor.add(wrap);
    }
    windGroup.add(pole, rotor);
    windRotors.push(rotor);
  });
  tagInteractive(windGroup, 'wind_farm');
  root.add(windGroup);
  interactables.push(windGroup);
  labelAnchors.set('wind_farm', new THREE.Vector3(4.3, 3.55, -1.6));

  // --- 4. SOLAR COLLECTOR FIELD ---
  const solarField = new THREE.Group();
  solarField.position.set(3.4, 0, 3.0);
  for (let i = 0; i < 2; i++) {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.6, 8), mats.metal('#64748b', 0.4, 0.7));
    stand.position.set(-0.7 + i * 1.4, 0.3, 0);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.07, 0.9), mats.solarCell());
    panel.position.set(-0.7 + i * 1.4, 0.68, 0);
    panel.rotation.x = 0.4;
    solarField.add(stand, panel);
  }
  tagInteractive(solarField, 'solar_field');
  root.add(solarField);
  interactables.push(solarField);
  labelAnchors.set('solar_field', new THREE.Vector3(3.4, 1.65, 3.0));

  // --- 5. CARBON-SINK FOREST BELT ---
  const forestGroup = new THREE.Group();
  forestGroup.position.set(-3.4, 0, 3.0);
  const patch = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.75, 0.12, 20), mats.grass('#4f9a53', '#3b7d3e', 2, 2));
  patch.position.y = 0.06;
  forestGroup.add(patch);
  const forestTrees: THREE.Group[] = [];
  [[-0.7, -0.4], [0.65, -0.35], [0, 0.6]].forEach(([x, z]) => {
    const t = createDetailedTree(mats, 0.85, '#15803d');
    t.position.set(x, 0.1, z);
    t.scale.setScalar(0.35);
    forestGroup.add(t);
    forestTrees.push(t);
  });
  tagInteractive(forestGroup, 'carbon_forest');
  root.add(forestGroup);
  interactables.push(forestGroup);
  labelAnchors.set('carbon_forest', new THREE.Vector3(-3.4, 2.2, 3.0));

  return {
    root,
    interactables,
    draggables: [],
    dropZones: [],
    labelAnchors,
    obstacles: [],
    walkBounds: {minX: -6, maxX: 6, minZ: -6, maxZ: 6},
    getInitialState: () =>
      makeBaseState({compared: false, coalCut: false, windOn: false, solarOn: false, forestGrown: false}),
    performAction: (actionId, state) => {
      switch (actionId) {
        case 'compare_climate':
          return {changed: true, nextState: pushAction(state, 'compare_climate', 'earth_model', {compared: true}), feedbackEn: 'Comparing high-emission heat trapping vs. clean-energy balance.', feedbackVi: 'Đang đối chiếu mô hình hiệu ứng nhà kính phát thải cao và năng lượng sạch.', soundKey: 'click', spokenEn: 'Greenhouse gases trap heat around the Earth.'};
        case 'reduce_coal':
          return {changed: true, nextState: pushAction(state, 'reduce_coal', 'coal_plant', {coalCut: true}), feedbackEn: 'Fossil fuel emissions sharply reduced — smoke plumes cleared!', feedbackVi: 'Đã cắt giảm khí thải nhiệt điện than — khói đen đã ngừng bốc lên!', soundKey: 'plant', spokenEn: 'Cutting fossil fuels reduces greenhouse gas emissions.'};
        case 'enable_wind':
          return {changed: true, nextState: pushAction(state, 'enable_wind', 'wind_farm', {windOn: true}), feedbackEn: 'Clean wind turbines spinning at full capacity!', feedbackVi: 'Các tua-bin điện gió đã vận hành cung cấp điện sạch!', soundKey: 'servo', spokenEn: 'Wind power generates clean renewable electricity.'};
        case 'enable_solar_grid':
          return {changed: true, nextState: pushAction(state, 'enable_solar_grid', 'solar_field', {solarOn: true}), feedbackEn: 'Solar power grid connected cleanly!', feedbackVi: 'Đã kích hoạt lưới điện mặt trời không phát thải!', soundKey: 'click', spokenEn: 'Solar collectors convert sunlight into clean power.'};
        case 'grow_carbon_forest':
          return {changed: true, nextState: pushAction(state, 'grow_carbon_forest', 'carbon_forest', {forestGrown: true}), feedbackEn: 'Forest belt expanded — illustrative greenhouse layer stabilized!', feedbackVi: 'Vành đai rừng xanh đã mở rộng — lớp giữ nhiệt minh họa ổn định hơn!', soundKey: 'mission_complete', spokenEn: 'Healthy forests absorb carbon dioxide from the atmosphere.'};
        default:
          return {changed: false, nextState: state, feedbackEn: '', feedbackVi: ''};
      }
    },
    getMetrics: (state) => {
      const greenSteps = [state.flags.coalCut, state.flags.windOn, state.flags.solarOn, state.flags.forestGrown].filter(Boolean).length;
      const heatPct = Math.max(20, 92 - greenSteps * 18);
      return [
        {id: 'ghg', labelEn: 'Heat-Trapping Layer (Illustrative)', labelVi: 'Mức giữ nhiệt minh họa', value: `${heatPct}%`, percent: heatPct, tone: heatPct <= 40 ? 'good' : heatPct <= 65 ? 'warn' : 'bad', illustrative: true},
        {id: 'clean', labelEn: 'Clean Energy Share (Illustrative)', labelVi: 'Tỉ lệ năng lượng sạch (minh họa)', value: `${greenSteps * 25}%`, percent: greenSteps * 25, tone: greenSteps >= 3 ? 'good' : 'neutral', illustrative: true},
      ];
    },
    update: (elapsed, delta, state, paused) => {
      const d = paused ? 0 : delta || 0.016;
      if (!paused) {
        earthSphere.rotation.y += delta * 0.25;
      }
      const greenCount = [state.flags.coalCut, state.flags.windOn, state.flags.solarOn, state.flags.forestGrown].filter(Boolean).length;
      const ratio = greenCount / 4;

      // Polar ice cap expands when climate actions succeed
      const iceScale = THREE.MathUtils.damp(polarCapNorth.scale.y, 0.72 + ratio * 0.34, 3, d);
      polarCapNorth.scale.set(1, iceScale, 1);

      // Greenhouse shell shifts from dense amber-red -> light translucent cyan
      greenhouseShellMat.opacity = THREE.MathUtils.damp(greenhouseShellMat.opacity, 0.34 - ratio * 0.22, 3, d);
      greenhouseShellMat.color.lerp(new THREE.Color(ratio >= 0.75 ? '#38bdf8' : ratio >= 0.4 ? '#f59e0b' : '#ef4444'), d * 3);

      // Smoke puffs stop when coal cut
      smokePuffs.forEach((s, idx) => {
        s.visible = !state.flags.coalCut;
        if (s.visible && !paused) {
          const t = ((elapsed * 0.6 + idx * 0.2) % 1 + 1) % 1;
          s.position.y = 2.75 + t * 1.4;
          s.position.x = 0.45 + t * 0.4;
          s.scale.setScalar(0.65 + t * 0.7);
        }
      });

      // Wind turbines spin rapidly when enabled
      const spinSpeed = state.flags.windOn ? 3.8 : 0.45;
      if (!paused) {
        windRotors.forEach((r) => {
          r.rotation.z -= delta * spinSpeed;
        });
      }

      // Forest trees grow
      forestTrees.forEach((t) => {
        const s = THREE.MathUtils.damp(t.scale.x, state.flags.forestGrown ? 1.05 : 0.35, 4, d);
        t.scale.setScalar(s);
      });
    },
    dispose: () => {
      greenhouseShellMat.dispose();
      disposeSceneRoot(root, mats);
    },
  };
}

// ============================================================================
// GRADE 11 · UNIT 6: PRESERVING OUR HERITAGE (Walkable Cultural Complex)
// ============================================================================
export function buildG11U6HeritageComplex(): BuiltWorld3DScene {
  const mats = new MaterialLibrary();
  const root = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const labelAnchors = new Map<string, THREE.Vector3>();

  // Stone Courtyard + Surrounding Garden
  const garden = new THREE.Mesh(new THREE.CylinderGeometry(18, 19, 0.4, 48), mats.grass('#4c8c4a', '#397038', 12, 12));
  garden.position.y = -0.2;
  garden.receiveShadow = true;
  root.add(garden);

  const courtyard = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.16, 10.6), mats.heritageStone('#d4c5ab'));
  courtyard.position.set(0, 0.08, 0);
  courtyard.receiveShadow = true;
  root.add(courtyard);

  for (const [tx, tz] of [[-7.2, -5.0], [7.2, -5.0], [-7.4, 4.2], [7.4, 4.2]]) {
    const tr = createDetailedTree(mats, 1.15, '#2e7d32');
    tr.position.set(tx, 0, tz);
    root.add(tr);
  }

  // --- 1. TRADITIONAL CURVED-ROOF PAVILION GATE ---
  const gateGroup = new THREE.Group();
  gateGroup.position.set(0, 0.16, -3.5);
  const crimsonWood = mats.wood('#8c2d19', '#661d0e', 1, 2);
  for (const px of [-2.3, -0.95, 0.95, 2.3]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 2.6, 12), crimsonWood);
    pillar.position.set(px, 1.3, 0);
    pillar.castShadow = true;
    gateGroup.add(pillar);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.34, 0.55), crimsonWood);
  beam.position.set(0, 2.6, 0);
  const roofLower = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.3, 1.9), mats.standard('#b45309', 0.65, 0.1));
  roofLower.position.set(0, 2.95, 0);
  roofLower.castShadow = true;
  const roofUpper = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.1, 4), mats.standard('#92400e', 0.65, 0.1));
  roofUpper.position.set(0, 3.65, 0);
  roofUpper.rotation.y = Math.PI / 4;
  gateGroup.add(beam, roofLower, roofUpper);

  tagInteractive(gateGroup, 'heritage_gate');
  root.add(gateGroup);
  interactables.push(gateGroup);
  labelAnchors.set('heritage_gate', new THREE.Vector3(0, 4.45, -3.5));

  // --- 2. INSCRIBED STONE STELE WITH REMOVABLE MOSS ---
  const steleGroup = new THREE.Group();
  steleGroup.position.set(-3.4, 0.16, 0.2);
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.95), mats.heritageStone('#a89b84'));
  pedestal.position.y = 0.225;
  const tablet = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.75, 0.24), mats.heritageStone('#b8ab94'));
  tablet.position.y = 1.3;
  tablet.castShadow = true;
  const mossOverlay = new THREE.Mesh(new THREE.BoxGeometry(1.04, 1.3, 0.27), mats.standard('#4d7c0f', 0.95, 0, {transparent: true, opacity: 0.68}));
  mossOverlay.position.y = 1.1;
  steleGroup.add(pedestal, tablet, mossOverlay);

  tagInteractive(steleGroup, 'stone_stele');
  root.add(steleGroup);
  interactables.push(steleGroup);
  labelAnchors.set('stone_stele', new THREE.Vector3(-3.4, 2.55, 0.2));

  // --- 3. ANCIENT BRONZE DRUM ARTIFACT + PROTECTIVE GLASS CASE ---
  const drumExhibit = new THREE.Group();
  drumExhibit.position.set(3.4, 0.16, 0.2);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.55, 20), mats.heritageStone('#b5a58d'));
  plinth.position.y = 0.275;
  const bronzeDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.48, 0.72, 24), mats.metal('#92622a', 0.34, 0.78));
  bronzeDrum.position.y = 0.92;
  bronzeDrum.castShadow = true;
  const glassCase = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.3, 1.55), mats.glass('#bae6fd', 0.35));
  glassCase.position.y = 1.15;
  glassCase.visible = false;
  drumExhibit.add(plinth, bronzeDrum, glassCase);

  tagInteractive(drumExhibit, 'bronze_artifact');
  root.add(drumExhibit);
  interactables.push(drumExhibit);
  labelAnchors.set('bronze_artifact', new THREE.Vector3(3.4, 2.15, 0.2));

  // --- 4. TOUR GUIDE PODIUM ---
  const podiumGroup = new THREE.Group();
  podiumGroup.position.set(0, 0.16, 2.7);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.1, 0.55), mats.wood('#784c2a', '#59361a'));
  stand.position.y = 0.55;
  const plaque = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.65, 0.08),
    mats.signTexture('HERITAGE GUIDE', 'Welcome Visitors!', '#fffbeb', '#78350f')
  );
  plaque.position.set(0, 1.25, 0);
  plaque.rotation.x = -0.35;
  podiumGroup.add(stand, plaque);
  tagInteractive(podiumGroup, 'tour_podium');
  root.add(podiumGroup);
  interactables.push(podiumGroup);
  labelAnchors.set('tour_podium', new THREE.Vector3(0, 1.95, 2.7));

  // Controllable Guide Character
  const guide = createArticulatedCharacter(mats, '#b45309', '#1e293b');
  guide.group.position.set(0, 0.16, 4.2);
  root.add(guide.group);

  return {
    root,
    interactables,
    draggables: [],
    dropZones: [],
    labelAnchors,
    obstacles: [],
    walkBounds: {minX: -5.2, maxX: 5.2, minZ: -2.2, maxZ: 4.8},
    characterGroup: guide.group,
    characterLimbs: guide.limbs,
    getInitialState: () =>
      makeBaseState({gateHeard: false, steleRead: false, steleCleaned: false, artifactProtected: false, speechDone: false}, {}, [0, 0.16, 4.2]),
    performAction: (actionId, state) => {
      switch (actionId) {
        case 'listen_gate_guide':
          return {changed: true, nextState: pushAction(state, 'listen_gate_guide', 'heritage_gate', {gateHeard: true}), feedbackEn: 'Audio Guide: Notice the curved tiled roof and solid wooden pillars.', feedbackVi: 'Thuyết minh: Mái ngói cong và hệ cột gỗ biểu trưng cho kiến trúc truyền thống Việt Nam.', soundKey: 'click', spokenEn: 'Welcome to our cultural heritage complex. Notice the traditional curved tiled roof and carved wooden pillars.'};
        case 'read_stele':
          return {changed: true, nextState: pushAction(state, 'read_stele', 'stone_stele', {steleRead: true}), feedbackEn: 'Stone Stele Plaque: Records historical achievements and community traditions.', feedbackVi: 'Đã đọc bia đá: Ghi nhận giá trị lịch sử và truyền thống hiếu học.', soundKey: 'click', spokenEn: 'This stone stele records valuable historical memories for future generations.'};
        case 'clean_stele':
          return {changed: true, nextState: pushAction(state, 'clean_stele', 'stone_stele', {steleCleaned: true}), feedbackEn: 'Surface moss carefully removed — stone inscriptions restored!', feedbackVi: 'Đã làm sạch lớp rêu mốc cẩn thận — bề mặt bia đá sáng rõ trở lại!', soundKey: 'plant', spokenEn: 'Careful conservation helps preserve historical monuments.'};
        case 'protect_artifact':
          return {changed: true, nextState: pushAction(state, 'protect_artifact', 'bronze_artifact', {artifactProtected: true}), feedbackEn: 'Protective glass enclosure installed around the bronze drum!', feedbackVi: 'Đã lắp lồng kính bảo vệ hiện vật Trống đồng an toàn!', soundKey: 'build', spokenEn: 'The protective glass case keeps the bronze artifact safe.'};
        case 'deliver_tour_speech':
          return {changed: true, nextState: pushAction(state, 'deliver_tour_speech', 'tour_podium', {speechDone: true}), feedbackEn: 'Inspiring tour guide welcome delivered to international visitors!', feedbackVi: 'Bạn đã hoàn thành vai hướng dẫn viên giới thiệu di sản bằng tiếng Anh!', soundKey: 'mission_complete', spokenEn: 'Ladies and gentlemen, thank you for visiting and helping us preserve our cultural heritage.'};
        default:
          return {changed: false, nextState: state, feedbackEn: '', feedbackVi: ''};
      }
    },
    getMetrics: (state) => {
      const done = [state.flags.gateHeard, state.flags.steleRead, state.flags.steleCleaned, state.flags.artifactProtected, state.flags.speechDone].filter(Boolean).length;
      return [{id: 'herit', labelEn: 'Conservation Progress', labelVi: 'Tiến độ Bảo tồn Di sản', value: `${done}/5`, percent: (done / 5) * 100, tone: done >= 4 ? 'good' : 'neutral'}];
    },
    update: (_elapsed, delta, state, paused) => {
      const d = paused ? 0 : delta || 0.016;
      mossOverlay.visible = !state.flags.steleCleaned;
      glassCase.visible = Boolean(state.flags.artifactProtected);
      if (state.flags.artifactProtected) {
        glassCase.scale.y = THREE.MathUtils.damp(glassCase.scale.y, 1, 5, d);
      } else {
        glassCase.scale.y = 0.05;
      }
    },
    dispose: () => disposeSceneRoot(root, mats),
  };
}

// ============================================================================
// GRADE 11 · UNIT 10: THE ECOSYSTEM (Living Forest, Lake & Food Chain Arcs)
// ============================================================================
export function buildG11U10Ecosystem(): BuiltWorld3DScene {
  const mats = new MaterialLibrary();
  const root = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const labelAnchors = new Map<string, THREE.Vector3>();

  // Rolling meadow & forest base
  const terrain = new THREE.Mesh(new THREE.CylinderGeometry(17.5, 18.5, 0.4, 48), mats.grass('#4f9a53', '#36753a', 12, 12));
  terrain.position.y = -0.2;
  terrain.receiveShadow = true;
  root.add(terrain);

  // Backdrop forest ring
  const bgTrees: THREE.Group[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const t = createDetailedTree(mats, 1.0 + (i % 3) * 0.18, '#1b5e20');
    t.position.set(Math.cos(a) * 8.2, 0, Math.sin(a) * 8.2);
    root.add(t);
    bgTrees.push(t);
  }

  // --- 1. CENTRAL FRESHWATER LAKE + SWIMMING FISH ---
  const lakeGroup = new THREE.Group();
  lakeGroup.position.set(0, 0.03, 0.2);
  const lakeWaterMat = mats.water('#0284c7');
  const lakeMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.7, 0.08, 32), lakeWaterMat);
  lakeGroup.add(lakeMesh);

  const fishOrbit = new THREE.Group();
  for (let f = 0; f < 3; f++) {
    const fish = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.24, 6, 8), mats.standard('#f97316', 0.3, 0.2));
    fish.rotation.z = Math.PI / 2;
    const ang = (f / 3) * Math.PI * 2;
    fish.position.set(Math.cos(ang) * 1.4, 0.08, Math.sin(ang) * 1.4);
    fishOrbit.add(fish);
  }
  lakeGroup.add(fishOrbit);
  tagInteractive(lakeGroup, 'eco_lake');
  root.add(lakeGroup);
  interactables.push(lakeGroup);
  labelAnchors.set('eco_lake', new THREE.Vector3(0, 1.15, 0.2));

  // --- 2. PRODUCERS (GREEN PLANTS & SHRUBS) ---
  const plantsGroup = new THREE.Group();
  plantsGroup.position.set(-4.2, 0, 2.2);
  const heroTree = createDetailedTree(mats, 1.05, '#22c55e');
  plantsGroup.add(heroTree);
  for (let s = 0; s < 3; s++) {
    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 1), mats.standard('#16a34a', 0.88, 0));
    bush.position.set(-0.9 + s * 0.9, 0.35, 0.85);
    plantsGroup.add(bush);
  }
  tagInteractive(plantsGroup, 'eco_plants');
  root.add(plantsGroup);
  interactables.push(plantsGroup);
  labelAnchors.set('eco_plants', new THREE.Vector3(-4.2, 2.55, 2.2));

  // --- 3. PRIMARY CONSUMER (DEER) ---
  const deerGroup = new THREE.Group();
  deerGroup.position.set(-3.4, 0, -2.8);
  const deerMat = mats.standard('#b47342', 0.8, 0.02);
  const dBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.65, 8, 12), deerMat);
  dBody.rotation.z = Math.PI / 2;
  dBody.position.y = 0.82;
  dBody.castShadow = true;
  const dHead = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.2), deerMat);
  dHead.position.set(0.55, 1.32, 0);
  deerGroup.add(dBody, dHead);
  for (const [lx, lz] of [[-0.25, 0.14], [-0.25, -0.14], [0.25, 0.14], [0.25, -0.14]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.66, 8), deerMat);
    leg.position.set(lx, 0.33, lz);
    deerGroup.add(leg);
  }
  tagInteractive(deerGroup, 'eco_deer');
  root.add(deerGroup);
  interactables.push(deerGroup);
  labelAnchors.set('eco_deer', new THREE.Vector3(-3.4, 1.9, -2.8));

  // --- 4. SECONDARY CONSUMER (WOODLAND FOX) ---
  const foxGroup = new THREE.Group();
  foxGroup.position.set(3.5, 0, -2.6);
  const foxMat = mats.standard('#ea580c', 0.78, 0.04);
  const fBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.56, 8, 10), foxMat);
  fBody.rotation.z = Math.PI / 2;
  fBody.position.y = 0.55;
  fBody.castShadow = true;
  const fHead = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 8), foxMat);
  fHead.rotation.z = -Math.PI / 2;
  fHead.position.set(0.5, 0.68, 0);
  const fTail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.52, 8), mats.standard('#f97316', 0.82, 0.02));
  fTail.rotation.z = Math.PI / 2.6;
  fTail.position.set(-0.5, 0.65, 0);
  foxGroup.add(fBody, fHead, fTail);
  tagInteractive(foxGroup, 'eco_fox');
  root.add(foxGroup);
  interactables.push(foxGroup);
  labelAnchors.set('eco_fox', new THREE.Vector3(3.5, 1.45, -2.6));

  // --- 5. DECOMPOSERS (FOREST FUNGI CLUSTER) ---
  const fungiGroup = new THREE.Group();
  fungiGroup.position.set(4.1, 0, 2.3);
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 1.6, 12), mats.wood('#6b4423', '#4a2e16'));
  log.rotation.z = Math.PI / 2;
  log.position.y = 0.24;
  fungiGroup.add(log);
  [-0.45, 0, 0.45].forEach((mx, i) => {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.36, 10), mats.standard('#fef3c7', 0.7, 0));
    stem.position.set(mx, 0.52, 0.1 * (i - 1));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mats.standard('#d97706', 0.6, 0.04));
    cap.position.set(mx, 0.68, 0.1 * (i - 1));
    fungiGroup.add(stem, cap);
  });
  tagInteractive(fungiGroup, 'eco_fungi');
  root.add(fungiGroup);
  interactables.push(fungiGroup);
  labelAnchors.set('eco_fungi', new THREE.Vector3(4.1, 1.4, 2.3));

  // Glowing Food-Chain Energy Arcs (Appear as learner links trophic levels!)
  const makeArc = (a: THREE.Vector3, b: THREE.Vector3, colorHex: string) => {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y += 1.65;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 24, 0.06, 8, false),
      mats.standard(colorHex, 0.2, 0.2, {emissive: colorHex, emissiveIntensity: 0.65})
    );
    tube.visible = false;
    root.add(tube);
    return tube;
  };
  const arc1 = makeArc(new THREE.Vector3(-4.2, 1.1, 2.2), new THREE.Vector3(-3.4, 1.1, -2.8), '#22c55e');
  const arc2 = makeArc(new THREE.Vector3(-3.4, 1.1, -2.8), new THREE.Vector3(3.5, 0.8, -2.6), '#f59e0b');
  const arc3 = makeArc(new THREE.Vector3(3.5, 0.8, -2.6), new THREE.Vector3(4.1, 0.8, 2.3), '#a855f7');
  const arc4 = makeArc(new THREE.Vector3(4.1, 0.8, 2.3), new THREE.Vector3(-4.2, 1.1, 2.2), '#06b6d4');

  return {
    root,
    interactables,
    draggables: [],
    dropZones: [],
    labelAnchors,
    obstacles: [],
    walkBounds: {minX: -6, maxX: 6, minZ: -6, maxZ: 6},
    getInitialState: () =>
      makeBaseState({producerLinked: false, herbivoreLinked: false, predatorLinked: false, decomposerLinked: false, aquaticChecked: false, rainfallBalanced: false}),
    performAction: (actionId, state) => {
      switch (actionId) {
        case 'link_producer':
          return {changed: true, nextState: pushAction(state, 'link_producer', 'eco_plants', {producerLinked: true}), feedbackEn: 'Step 1: Green Plants produce energy via photosynthesis.', feedbackVi: 'Bước 1: Thực vật quang hợp tạo nguồn năng lượng khởi đầu chuỗi thức ăn.', soundKey: 'plant', spokenEn: 'Green plants are the producers of the ecosystem.'};
        case 'link_herbivore':
          if (!state.flags.producerLinked) return {changed: false, nextState: state, feedbackEn: 'Start with Green Plants (Producer) first!', feedbackVi: 'Hãy chọn Thảm thực vật (Bước 1) trước!', soundKey: 'error'};
          return {changed: true, nextState: pushAction(state, 'link_herbivore', 'eco_deer', {herbivoreLinked: true}), feedbackEn: 'Step 2: Forest Deer consumes green plants!', feedbackVi: 'Bước 2: Hươu rừng (động vật ăn cỏ) nối tiếp nguồn năng lượng từ thực vật!', soundKey: 'plant', spokenEn: 'Herbivores like deer feed directly on plants.'};
        case 'link_predator':
          if (!state.flags.herbivoreLinked) return {changed: false, nextState: state, feedbackEn: 'Link the Forest Deer (Step 2) first!', feedbackVi: 'Hãy nối Hươu rừng (Bước 2) trước!', soundKey: 'error'};
          return {changed: true, nextState: pushAction(state, 'link_predator', 'eco_fox', {predatorLinked: true}), feedbackEn: 'Step 3: Woodland Fox maintains healthy population balance!', feedbackVi: 'Bước 3: Cáo rừng giúp điều hòa và cân bằng quần thể sinh vật!', soundKey: 'plant', spokenEn: 'Predators help keep the ecosystem in natural balance.'};
        case 'link_decomposer':
          if (!state.flags.predatorLinked) return {changed: false, nextState: state, feedbackEn: 'Complete Steps 1–3 first!', feedbackVi: 'Hãy hoàn thành 3 mắt xích đầu tiên trước khi nối Nấm phân giải!', soundKey: 'error'};
          return {changed: true, nextState: pushAction(state, 'link_decomposer', 'eco_fungi', {decomposerLinked: true}), feedbackEn: 'Step 4: Fungi recycle organic nutrients back to the soil — Food Chain complete!', feedbackVi: 'Bước 4: Nấm phân giải hoàn trả dinh dưỡng cho đất — Chuỗi thức ăn khép kín!', soundKey: 'mission_complete', spokenEn: 'Decomposers complete the cycle by returning nutrients to the soil.'};
        case 'inspect_aquatic':
          return {changed: true, nextState: pushAction(state, 'inspect_aquatic', 'eco_lake', {aquaticChecked: true}), feedbackEn: 'Freshwater fish thrive in the clean aquatic lake habitat.', feedbackVi: 'Đàn cá đang bơi lội trong môi trường sống thủy sinh nước ngọt.', soundKey: 'water', spokenEn: 'Fish live in the freshwater aquatic habitat.'};
        case 'balance_rainfall':
          return {changed: true, nextState: pushAction(state, 'balance_rainfall', 'eco_lake', {rainfallBalanced: true}), feedbackEn: 'Balanced rainfall keeps both lake and forest biodiversity healthy!', feedbackVi: 'Lượng mưa cân bằng giúp hồ nước đầy và thảm rừng xanh tươi!', soundKey: 'water', spokenEn: 'Balanced water levels sustain the whole ecosystem.'};
        default:
          return {changed: false, nextState: state, feedbackEn: '', feedbackVi: ''};
      }
    },
    getMetrics: (state) => {
      const chain = [state.flags.producerLinked, state.flags.herbivoreLinked, state.flags.predatorLinked, state.flags.decomposerLinked].filter(Boolean).length;
      return [
        {id: 'chain', labelEn: 'Food Chain Links', labelVi: 'Mắt xích chuỗi thức ăn', value: `${chain}/4`, percent: (chain / 4) * 100, tone: chain === 4 ? 'good' : 'neutral'},
        {id: 'bal', labelEn: 'Ecosystem Balance (Illustrative)', labelVi: 'Cân bằng sinh thái (minh họa)', value: state.flags.rainfallBalanced ? 'Ổn định' : 'Đang khám phá', percent: state.flags.rainfallBalanced ? 95 : 55, tone: state.flags.rainfallBalanced ? 'good' : 'neutral', illustrative: true},
      ];
    },
    update: (elapsed, _delta, state, paused) => {
      arc1.visible = Boolean(state.flags.herbivoreLinked);
      arc2.visible = Boolean(state.flags.predatorLinked);
      arc3.visible = Boolean(state.flags.decomposerLinked);
      arc4.visible = Boolean(state.flags.decomposerLinked);

      if (!paused) {
        fishOrbit.rotation.y = elapsed * 0.85;
        if (lakeWaterMat.map) lakeWaterMat.map.offset.x = (elapsed * 0.12) % 1;
        deerGroup.position.x = -3.4 + Math.sin(elapsed * 0.55) * 0.5;
        foxGroup.position.z = -2.6 + Math.cos(elapsed * 0.75) * 0.55;
        bgTrees.forEach((t, i) => {
          t.rotation.z = Math.sin(elapsed * 1.3 + i) * 0.025;
        });
      }
    },
    dispose: () => disposeSceneRoot(root, mats),
  };
}
