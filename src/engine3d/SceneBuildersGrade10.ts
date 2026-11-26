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
  characterPos: [number, number, number] = [0, 0, 3.8]
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
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
    }
  });
  mats.dispose();
}

// ============================================================================
// GRADE 10 · UNIT 1: FAMILY LIFE (Cutaway Home: Kitchen + Laundry + Living)
// ============================================================================
export function buildG10U1FamilyHome(): BuiltWorld3DScene {
  const mats = new MaterialLibrary();
  const root = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const draggables: THREE.Object3D[] = [];
  const labelAnchors = new Map<string, THREE.Vector3>();

  // Floor (Tile for kitchen/laundry back half, warm wood parquet for living front half)
  const backFloor = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.2, 4.4), mats.tileFloor('#f1f5f9', '#cbd5e1', 8, 4));
  backFloor.position.set(0, -0.1, -1.8);
  backFloor.receiveShadow = true;
  root.add(backFloor);

  const frontFloor = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.2, 4.4), mats.wood('#b6895b', '#8d6238', 5, 3));
  frontFloor.position.set(0, -0.1, 2.6);
  frontFloor.receiveShadow = true;
  root.add(frontFloor);

  // Back & Side Cutaway Walls
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(10.8, 3.4, 0.22), mats.standard('#f8fafc', 0.85, 0.02));
  backWall.position.set(0, 1.7, -4.0);
  backWall.receiveShadow = true;
  root.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 8.8), mats.standard('#f1f5f9', 0.85, 0.02));
  leftWall.position.set(-5.4, 1.7, 0.4);
  leftWall.receiveShadow = true;
  root.add(leftWall);

  // --- 1. REFRIGERATOR (Articulated Hinged Door + Interior Shelves + Groceries) ---
  const fridgeGroup = new THREE.Group();
  fridgeGroup.position.set(-3.9, 0, -2.9);

  const fridgeBody = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.35, 1.1), mats.metal('#e2e8f0', 0.28, 0.55));
  fridgeBody.position.y = 1.175;
  fridgeBody.castShadow = true;
  fridgeGroup.add(fridgeBody);

  const fridgeInterior = new THREE.Mesh(new THREE.BoxGeometry(1.06, 2.05, 0.85), mats.standard('#e0f2fe', 0.3, 0.05, {emissive: '#bae6fd', emissiveIntensity: 0.25}));
  fridgeInterior.position.set(0, 1.18, 0.14);
  fridgeGroup.add(fridgeInterior);

  const groceryGroup = new THREE.Group();
  const milkCarton = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.32, 0.18), mats.standard('#ffffff', 0.4, 0.05));
  milkCarton.position.set(-0.28, 1.48, 0.25);
  const appleMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), mats.standard('#ef4444', 0.35, 0.05));
  appleMesh.position.set(0.05, 1.42, 0.25);
  const veggieBox = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.24), mats.standard('#22c55e', 0.65, 0.04));
  veggieBox.position.set(0.22, 0.92, 0.25);
  groceryGroup.add(milkCarton, appleMesh, veggieBox);
  fridgeGroup.add(groceryGroup);

  // Door Hinge Pivot on Left Edge
  const fridgeDoorPivot = new THREE.Group();
  fridgeDoorPivot.position.set(-0.62, 1.18, 0.56);
  const fridgeDoor = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.32, 0.12), mats.metal('#f8fafc', 0.22, 0.65));
  fridgeDoor.position.set(0.62, 0, 0.06);
  fridgeDoor.castShadow = true;
  const fridgeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 10), mats.metal('#475569', 0.25, 0.85));
  fridgeHandle.position.set(1.1, 0.1, 0.16);
  fridgeDoorPivot.add(fridgeDoor, fridgeHandle);
  fridgeGroup.add(fridgeDoorPivot);

  tagInteractive(fridgeGroup, 'fridge');
  root.add(fridgeGroup);
  interactables.push(fridgeGroup);
  labelAnchors.set('fridge', new THREE.Vector3(-3.9, 2.65, -2.9));

  // --- 2. KITCHEN SINK + FAUCET + ANIMATED WATER STREAM + DISHES ---
  const sinkGroup = new THREE.Group();
  sinkGroup.position.set(-1.3, 0, -2.95);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.96, 1.05), mats.wood('#78553a', '#5a3d28', 2, 1));
  counter.position.y = 0.48;
  counter.castShadow = true;
  counter.receiveShadow = true;
  sinkGroup.add(counter);

  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.08, 1.12), mats.standard('#e2e8f0', 0.25, 0.1));
  counterTop.position.y = 1.0;
  sinkGroup.add(counterTop);

  const basin = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.16, 0.65), mats.metal('#94a3b8', 0.22, 0.8));
  basin.position.set(0, 0.98, 0.02);
  sinkGroup.add(basin);

  const faucetPost = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.45, 10), mats.metal('#cbd5e1', 0.18, 0.9));
  faucetPost.position.set(0, 1.24, -0.34);
  const faucetSpout = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 8, 16, Math.PI), mats.metal('#cbd5e1', 0.18, 0.9));
  faucetSpout.position.set(0, 1.44, -0.2);
  faucetSpout.rotation.y = Math.PI / 2;
  sinkGroup.add(faucetPost, faucetSpout);

  // Animated water stream particles
  const waterDrops: THREE.Mesh[] = [];
  const waterMat = mats.standard('#38bdf8', 0.12, 0.2, {transparent: true, opacity: 0.82, emissive: '#0284c7', emissiveIntensity: 0.3});
  for (let i = 0; i < 8; i++) {
    const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.11, 8), waterMat);
    drop.position.set(0, 1.4 - i * 0.05, -0.06);
    drop.visible = false;
    sinkGroup.add(drop);
    waterDrops.push(drop);
  }

  // Dirty -> Clean Dish Stack
  const dishMat = mats.standard('#cbd5e1', 0.4, 0.1);
  const dishesGroup = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.04, 16), dishMat);
    plate.position.set(0.75, 1.07 + i * 0.045, 0);
    dishesGroup.add(plate);
  }
  sinkGroup.add(dishesGroup);

  tagInteractive(sinkGroup, 'sink');
  root.add(sinkGroup);
  interactables.push(sinkGroup);
  labelAnchors.set('sink', new THREE.Vector3(-1.3, 1.85, -2.95));

  // --- 3. KITCHEN STOVE & SIMMERING POT ---
  const stoveGroup = new THREE.Group();
  stoveGroup.position.set(1.25, 0, -2.95);
  const stoveBody = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.98, 1.02), mats.metal('#334155', 0.35, 0.65));
  stoveBody.position.y = 0.49;
  stoveBody.castShadow = true;
  stoveGroup.add(stoveBody);

  const burnerGlow = new THREE.Mesh(
    new THREE.RingGeometry(0.14, 0.22, 20),
    mats.standard('#f97316', 0.3, 0.1, {emissive: '#ef4444', emissiveIntensity: 0})
  );
  burnerGlow.rotation.x = -Math.PI / 2;
  burnerGlow.position.set(0, 1.0, 0);
  stoveGroup.add(burnerGlow);

  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.28, 16), mats.metal('#94a3b8', 0.22, 0.85));
  pot.position.set(0, 1.15, 0);
  pot.castShadow = true;
  stoveGroup.add(pot);

  const steamPuffs: THREE.Mesh[] = [];
  const steamMat = mats.standard('#ffffff', 0.9, 0, {transparent: true, opacity: 0.45});
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), steamMat);
    puff.position.set((i - 1.5) * 0.06, 1.4 + i * 0.12, 0);
    puff.visible = false;
    stoveGroup.add(puff);
    steamPuffs.push(puff);
  }

  tagInteractive(stoveGroup, 'stove');
  root.add(stoveGroup);
  interactables.push(stoveGroup);
  labelAnchors.set('stove', new THREE.Vector3(1.25, 1.85, -2.95));

  // --- 4. FRONT-LOAD WASHING MACHINE (Hinged Glass Door + Spinning Drum + Clothes) ---
  const washerGroup = new THREE.Group();
  washerGroup.position.set(3.65, 0, -2.9);

  const washerBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.32, 1.08), mats.standard('#f8fafc', 0.3, 0.15));
  washerBody.position.y = 0.66;
  washerBody.castShadow = true;
  washerGroup.add(washerBody);

  const controlPanel = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.22, 0.08), mats.standard('#1e293b', 0.4, 0.3));
  controlPanel.position.set(0, 1.16, 0.54);
  washerGroup.add(controlPanel);

  const statusLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 10, 8),
    mats.standard('#94a3b8', 0.2, 0.1, {emissive: '#10b981', emissiveIntensity: 0})
  );
  statusLed.position.set(0.38, 1.16, 0.59);
  washerGroup.add(statusLed);

  // Spinning inner drum + clothes inside
  const drumGroup = new THREE.Group();
  drumGroup.position.set(0, 0.62, 0.38);
  const drumRing = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.45, 20, 1, true), mats.metal('#64748b', 0.25, 0.85));
  drumRing.rotation.x = Math.PI / 2;
  drumGroup.add(drumRing);

  const loadedClothes = new THREE.Group();
  const shirt1 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.24), mats.standard('#3b82f6', 0.9, 0));
  shirt1.position.set(-0.08, -0.06, 0);
  const shirt2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.22), mats.standard('#f59e0b', 0.9, 0));
  shirt2.position.set(0.1, 0.06, 0.04);
  loadedClothes.add(shirt1, shirt2);
  loadedClothes.visible = false;
  drumGroup.add(loadedClothes);
  washerGroup.add(drumGroup);

  // Hinged Front Door
  const washerDoorPivot = new THREE.Group();
  washerDoorPivot.position.set(-0.36, 0.62, 0.56);
  const doorRim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.055, 12, 24), mats.metal('#cbd5e1', 0.25, 0.75));
  doorRim.position.set(0.36, 0, 0);
  const doorGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 20), mats.glass('#93c5fd', 0.45));
  doorGlass.rotation.x = Math.PI / 2;
  doorGlass.position.set(0.36, 0, 0);
  washerDoorPivot.add(doorRim, doorGlass);
  washerGroup.add(washerDoorPivot);

  tagInteractive(washerGroup, 'washer');
  root.add(washerGroup);
  interactables.push(washerGroup);
  labelAnchors.set('washer', new THREE.Vector3(3.65, 1.75, -2.9));

  // --- 5. DRAGGABLE LAUNDRY BASKET ---
  const basketGroup = new THREE.Group();
  basketGroup.position.set(3.55, 0, -0.55);
  const basketBody = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.28, 0.46, 16), mats.wood('#d4a373', '#a97142', 2, 1));
  basketBody.position.y = 0.23;
  basketBody.castShadow = true;
  const basketPile = new THREE.Mesh(new THREE.DodecahedronGeometry(0.26, 1), mats.standard('#3b82f6', 0.88, 0.02));
  basketPile.position.y = 0.45;
  basketGroup.add(basketBody, basketPile);

  tagInteractive(basketGroup, 'laundry_basket', true);
  root.add(basketGroup);
  interactables.push(basketGroup);
  draggables.push(basketGroup);
  labelAnchors.set('laundry_basket', new THREE.Vector3(3.55, 0.95, -0.55));

  // --- 6. LIVING ROOM SOFA + COFFEE TABLE + DUST CLUSTERS ---
  const livingGroup = new THREE.Group();
  livingGroup.position.set(-1.6, 0, 2.2);

  const rug = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.03, 2.8), mats.standard('#dbeafe', 0.92, 0.01));
  rug.position.y = 0.015;
  rug.receiveShadow = true;
  livingGroup.add(rug);

  const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.45, 0.95), mats.standard('#334155', 0.85, 0.03));
  sofaBase.position.set(0, 0.25, 0.65);
  sofaBase.castShadow = true;
  const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.62, 0.22), mats.standard('#1e293b', 0.85, 0.03));
  sofaBack.position.set(0, 0.72, 1.02);
  sofaBack.castShadow = true;
  livingGroup.add(sofaBase, sofaBack);

  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.08, 0.75), mats.wood('#9a6b42', '#7c502d', 1, 1));
  tableTop.position.set(0, 0.46, -0.45);
  tableTop.castShadow = true;
  livingGroup.add(tableTop);

  // Dust specks that vanish when swept
  const dustCluster = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const dust = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 0), mats.standard('#94a3b8', 0.95, 0));
    dust.position.set(-1.1 + i * 0.44, 0.07, -0.9 + (i % 2) * 0.35);
    dustCluster.add(dust);
  }
  livingGroup.add(dustCluster);

  tagInteractive(livingGroup, 'living_room');
  root.add(livingGroup);
  interactables.push(livingGroup);
  labelAnchors.set('living_room', new THREE.Vector3(-1.6, 1.45, 2.2));

  return {
    root,
    interactables,
    draggables,
    dropZones: [
      {id: 'washer', position: new THREE.Vector3(3.65, 0.6, -2.5), radius: 1.5, accepts: ['laundry_basket']},
    ],
    labelAnchors,
    obstacles: [],
    walkBounds: {minX: -4.8, maxX: 4.8, minZ: -3.2, maxZ: 4.0},
    getInitialState: () =>
      makeBaseState({
        fridgeOpen: false,
        foodArranged: false,
        faucetOn: false,
        dishesClean: false,
        washerOpen: false,
        clothesLoaded: false,
        washerRunning: false,
        stoveOn: false,
        mealReady: false,
        roomSwept: false,
      }),
    performAction: (actionId, state) => {
      switch (actionId) {
        case 'fridge_open':
          return {
            changed: true,
            nextState: pushAction(state, 'fridge_open', 'fridge', {fridgeOpen: true}),
            feedbackEn: 'The refrigerator door is now open.',
            feedbackVi: 'Đã mở cửa tủ lạnh — bên trong có kệ sắp xếp thực phẩm.',
            soundKey: 'click',
            spokenEn: 'You opened the refrigerator door.',
          };
        case 'food_arrange':
          if (!state.flags.fridgeOpen) {
            return {changed: false, nextState: state, feedbackEn: 'Open the refrigerator door first!', feedbackVi: 'Hãy mở cửa tủ lạnh trước khi sắp xếp thực phẩm!', soundKey: 'error'};
          }
          return {
            changed: true,
            nextState: pushAction(state, 'food_arrange', 'fridge', {foodArranged: true}),
            feedbackEn: 'Groceries are neatly arranged on the fridge shelves!',
            feedbackVi: 'Đã sắp xếp gọn gàng sữa, hoa quả và rau củ lên kệ tủ lạnh!',
            soundKey: 'plant',
            spokenEn: 'Great job arranging the groceries inside the fridge.',
          };
        case 'fridge_close':
          return {
            changed: true,
            nextState: pushAction(state, 'fridge_close', 'fridge', {fridgeOpen: false}),
            feedbackEn: 'Refrigerator door closed tightly to save electricity.',
            feedbackVi: 'Đã đóng kín cửa tủ lạnh để giữ lạnh và tiết kiệm điện.',
            soundKey: 'click',
            spokenEn: 'You closed the refrigerator door.',
          };
        case 'faucet_open':
          return {
            changed: true,
            nextState: pushAction(state, 'faucet_open', 'sink', {faucetOn: true}),
            feedbackEn: 'Water is running from the kitchen tap.',
            feedbackVi: 'Đã mở vòi nước — dòng nước đang chảy xuống bồn rửa.',
            soundKey: 'water',
            spokenEn: 'The kitchen tap is turned on.',
          };
        case 'dishes_wash':
          if (!state.flags.faucetOn) {
            return {changed: false, nextState: state, feedbackEn: 'Turn on the tap before washing dishes!', feedbackVi: 'Cần mở vòi nước trước khi rửa bát!', soundKey: 'error'};
          }
          return {
            changed: true,
            nextState: pushAction(state, 'dishes_wash', 'sink', {dishesClean: true}),
            feedbackEn: 'All dirty dishes are sparkling clean!',
            feedbackVi: 'Đã rửa sạch bóng toàn bộ bát đĩa!',
            soundKey: 'water',
            spokenEn: 'The dishes are now sparkling clean.',
          };
        case 'faucet_close':
          return {
            changed: true,
            nextState: pushAction(state, 'faucet_close', 'sink', {faucetOn: false}),
            feedbackEn: 'Tap turned off to save clean water.',
            feedbackVi: 'Đã khóa vòi nước cẩn thận.',
            soundKey: 'click',
            spokenEn: 'You turned off the kitchen tap.',
          };
        case 'washer_open':
          return {
            changed: true,
            nextState: pushAction(state, 'washer_open', 'washer', {washerOpen: true, washerRunning: false}),
            feedbackEn: 'Washing machine glass door opened.',
            feedbackVi: 'Đã mở cửa kính máy giặt.',
            soundKey: 'click',
            spokenEn: 'The washing machine door is open.',
          };
        case 'clothes_load':
          if (!state.flags.washerOpen) {
            return {changed: false, nextState: state, feedbackEn: 'Open the washing machine door first!', feedbackVi: 'Hãy mở cửa máy giặt trước khi bỏ quần áo vào!', soundKey: 'error'};
          }
          return {
            changed: true,
            nextState: pushAction(state, 'clothes_load', 'washer', {clothesLoaded: true}),
            feedbackEn: 'Laundry clothes loaded inside the drum!',
            feedbackVi: 'Đã đưa quần áo từ giỏ vào bên trong lồng máy giặt!',
            soundKey: 'plant',
            spokenEn: 'You put the clothes inside the washing machine.',
          };
        case 'washer_close':
          return {
            changed: true,
            nextState: pushAction(state, 'washer_close', 'washer', {washerOpen: false}),
            feedbackEn: 'Washing machine door closed securely.',
            feedbackVi: 'Đã đóng chặt cửa máy giặt.',
            soundKey: 'click',
            spokenEn: 'The washing machine door is closed.',
          };
        case 'washer_start':
          if (state.flags.washerOpen || !state.flags.clothesLoaded) {
            return {
              changed: false,
              nextState: state,
              feedbackEn: 'Make sure clothes are inside and the door is closed before starting!',
              feedbackVi: 'Cần bỏ quần áo vào và đóng kín cửa trước khi bấm chạy máy giặt!',
              soundKey: 'error',
            };
          }
          return {
            changed: true,
            nextState: pushAction(state, 'washer_start', 'washer', {washerRunning: true}),
            feedbackEn: 'Washing machine started — the drum is spinning!',
            feedbackVi: 'Máy giặt đã khởi động — lồng giặt đang quay đều!',
            soundKey: 'washer',
            spokenEn: 'The washing machine is running now.',
          };
        case 'stove_on':
          return {
            changed: true,
            nextState: pushAction(state, 'stove_on', 'stove', {stoveOn: true}),
            feedbackEn: 'Kitchen stove turned on; pot is heating up.',
            feedbackVi: 'Đã bật bếp — nồi súp đang sôi bốc hơi.',
            soundKey: 'click',
            spokenEn: 'The kitchen stove is turned on.',
          };
        case 'meal_prepare':
          if (!state.flags.stoveOn) {
            return {changed: false, nextState: state, feedbackEn: 'Turn on the stove first!', feedbackVi: 'Hãy bật bếp trước khi nấu bữa tối!', soundKey: 'error'};
          }
          return {
            changed: true,
            nextState: pushAction(state, 'meal_prepare', 'stove', {mealReady: true}),
            feedbackEn: 'A delicious warm family dinner is ready!',
            feedbackVi: 'Bữa tối ấm cúng cho cả gia đình đã nấu xong!',
            soundKey: 'mission_complete',
            spokenEn: 'Dinner is ready for the whole family.',
          };
        case 'floor_sweep':
          return {
            changed: true,
            nextState: pushAction(state, 'floor_sweep', 'living_room', {roomSwept: true}),
            feedbackEn: 'Living room floor swept spotless!',
            feedbackVi: 'Đã quét sạch bụi bẩn và dọn gọn phòng khách!',
            soundKey: 'plant',
            spokenEn: 'The living room is clean and tidy.',
          };
        default:
          return {changed: false, nextState: state, feedbackEn: '', feedbackVi: ''};
      }
    },
    getMetrics: (state) => {
      const done = [
        state.flags.foodArranged && !state.flags.fridgeOpen,
        state.flags.dishesClean && !state.flags.faucetOn,
        state.flags.washerRunning,
        state.flags.mealReady,
        state.flags.roomSwept,
      ].filter(Boolean).length;
      return [
        {id: 'chores', labelEn: 'Household Chores Done', labelVi: 'Việc nhà hoàn thành', value: `${done}/5`, percent: (done / 5) * 100, tone: done >= 4 ? 'good' : 'neutral'},
        {id: 'water_save', labelEn: 'Water Valve', labelVi: 'Trạng thái vòi nước', value: state.flags.faucetOn ? 'Đang mở' : 'Đã khóa', percent: state.flags.faucetOn ? 30 : 100, tone: state.flags.faucetOn ? 'warn' : 'good'},
      ];
    },
    update: (elapsed, delta, state, paused) => {
      const d = paused ? 0 : delta;
      // Smoothly swing fridge door open/close
      const targetFridgeAngle = state.flags.fridgeOpen ? -1.45 : 0;
      fridgeDoorPivot.rotation.y = THREE.MathUtils.damp(fridgeDoorPivot.rotation.y, targetFridgeAngle, 7, d || 0.016);
      groceryGroup.position.x = THREE.MathUtils.damp(groceryGroup.position.x, state.flags.foodArranged ? 0 : -0.08, 6, d || 0.016);

      // Faucet water stream particles
      waterDrops.forEach((drop, i) => {
        drop.visible = Boolean(state.flags.faucetOn);
        if (drop.visible && !paused) {
          const t = ((elapsed * 3.5 + i / waterDrops.length) % 1 + 1) % 1;
          drop.position.y = 1.42 - t * 0.44;
        }
      });
      dishMat.color.set(state.flags.dishesClean ? '#ffffff' : '#cbd5e1');

      // Washer hinged door + spinning drum + clothes visibility
      const targetWasherAngle = state.flags.washerOpen ? -1.35 : 0;
      washerDoorPivot.rotation.y = THREE.MathUtils.damp(washerDoorPivot.rotation.y, targetWasherAngle, 7, d || 0.016);
      loadedClothes.visible = Boolean(state.flags.clothesLoaded);
      basketPile.visible = !state.flags.clothesLoaded;
      if (state.flags.washerRunning && !paused) {
        drumGroup.rotation.z -= delta * 7.5;
        (statusLed.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.85;
      } else {
        (statusLed.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
      }

      // Stove glow & rising steam
      (burnerGlow.material as THREE.MeshStandardMaterial).emissiveIntensity = state.flags.stoveOn ? 1.1 : 0;
      steamPuffs.forEach((p, idx) => {
        p.visible = Boolean(state.flags.stoveOn);
        if (p.visible && !paused) {
          const t = ((elapsed * 0.9 + idx * 0.25) % 1 + 1) % 1;
          p.position.y = 1.35 + t * 0.7;
          p.scale.setScalar(0.6 + t * 0.8);
        }
      });

      // Living room dust
      dustCluster.visible = !state.flags.roomSwept;
    },
    dispose: () => disposeSceneRoot(root, mats),
  };
}

// ============================================================================
// GRADE 10 · UNIT 2: HUMANS AND THE ENVIRONMENT (Park + Drag/Drop Waste Bins)
// ============================================================================
export function buildG10U2EcoPark(): BuiltWorld3DScene {
  const mats = new MaterialLibrary();
  const root = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const draggables: THREE.Object3D[] = [];
  const labelAnchors = new Map<string, THREE.Vector3>();

  // Expansive meadow ground (natural horizon, no rectangular room walls!)
  const terrain = new THREE.Mesh(new THREE.CylinderGeometry(16, 17, 0.4, 48), mats.grass('#4f9a53', '#3b7d3e', 12, 12));
  terrain.position.y = -0.2;
  terrain.receiveShadow = true;
  root.add(terrain);

  // Curved gravel park path
  const pathMesh = new THREE.Mesh(new THREE.RingGeometry(3.4, 5.2, 36, 1, 0, Math.PI * 1.4), mats.standard('#d6cbb5', 0.92, 0.02));
  pathMesh.rotation.x = -Math.PI / 2;
  pathMesh.position.y = 0.02;
  pathMesh.receiveShadow = true;
  root.add(pathMesh);

  // Natural perimeter tree grove
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const t = createDetailedTree(mats, 1.0 + (i % 3) * 0.22, i % 2 === 0 ? '#2e7d32' : '#388e3c');
    t.position.set(Math.cos(a) * 9.5, 0, Math.sin(a) * 9.5);
    root.add(t);
  }

  // Park Bench
  const bench = new THREE.Group();
  bench.position.set(0, 0, -4.6);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 0.58), mats.wood('#8d5b34', '#6b4222', 2, 1));
  seat.position.y = 0.48;
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.42, 0.09), mats.wood('#8d5b34', '#6b4222', 2, 1));
  back.position.set(0, 0.82, -0.24);
  bench.add(seat, back);
  root.add(bench);

  // --- SORTING BINS WITH ARTICULATED HINGED LIDS ---
  const makeBin = (id: string, x: number, z: number, colorHex: string) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.15, 0.85), mats.standard(colorHex, 0.45, 0.12));
    body.position.y = 0.575;
    body.castShadow = true;
    g.add(body);

    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 1.16, -0.42);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.12, 0.9), mats.standard(colorHex, 0.35, 0.18));
    lid.position.set(0, 0.06, 0.42);
    lid.castShadow = true;
    lidPivot.add(lid);
    g.add(lidPivot);

    tagInteractive(g, id);
    root.add(g);
    interactables.push(g);
    labelAnchors.set(id, new THREE.Vector3(x, 1.65, z));
    return {group: g, lidPivot};
  };

  const recycleBin = makeBin('bin_recycle', -1.5, -2.5, '#2563eb');
  const organicBin = makeBin('bin_organic', 1.5, -2.5, '#16a34a');

  // --- DRAGGABLE LITTER ITEMS ---
  const bottle = new THREE.Group();
  bottle.position.set(-2.6, 0, 2.2);
  const bBody = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.42, 12), mats.glass('#38bdf8', 0.65));
  bBody.position.y = 0.21;
  const bCap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 10), mats.standard('#1d4ed8', 0.4, 0.1));
  bCap.position.y = 0.45;
  bottle.add(bBody, bCap);
  tagInteractive(bottle, 'bottle_litter', true);
  root.add(bottle);
  interactables.push(bottle);
  draggables.push(bottle);
  labelAnchors.set('bottle_litter', new THREE.Vector3(-2.6, 0.85, 2.2));

  const banana = new THREE.Group();
  banana.position.set(1.9, 0, 2.5);
  const peel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.06, 8, 16, Math.PI * 1.1), mats.standard('#eab308', 0.6, 0.02));
  peel.position.y = 0.14;
  peel.rotation.x = Math.PI / 3;
  banana.add(peel);
  tagInteractive(banana, 'banana_litter', true);
  root.add(banana);
  interactables.push(banana);
  draggables.push(banana);
  labelAnchors.set('banana_litter', new THREE.Vector3(1.9, 0.65, 2.5));

  const can = new THREE.Group();
  can.position.set(-0.2, 0, 3.1);
  const canMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.3, 14), mats.metal('#ef4444', 0.24, 0.78));
  canMesh.position.y = 0.15;
  canMesh.rotation.z = Math.PI / 2.2;
  can.add(canMesh);
  tagInteractive(can, 'can_litter', true);
  root.add(can);
  interactables.push(can);
  draggables.push(can);
  labelAnchors.set('can_litter', new THREE.Vector3(-0.2, 0.65, 3.1));

  // --- SOIL PLOTS & GROWING TREES ---
  const makePlot = (id: string, x: number, z: number) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.14, 18), mats.standard('#6b4423', 0.95, 0.01));
    soil.position.y = 0.07;
    g.add(soil);
    const tree = createDetailedTree(mats, 1.0, '#16a34a');
    tree.scale.setScalar(0.01);
    tree.visible = false;
    g.add(tree);
    tagInteractive(g, id);
    root.add(g);
    interactables.push(g);
    labelAnchors.set(id, new THREE.Vector3(x, 1.45, z));
    return {group: g, tree};
  };

  const plot1 = makePlot('tree_plot_1', -4.2, -0.4);
  const plot2 = makePlot('tree_plot_2', 4.2, -0.4);

  // Blooming flowers appear when park becomes clean
  const flowersGroup = new THREE.Group();
  const flowerColors = ['#f43f5e', '#f59e0b', '#ec4899', '#8b5cf6'];
  for (let i = 0; i < 12; i++) {
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mats.standard(flowerColors[i % 4], 0.5, 0.05));
    fl.position.set(-4.5 + (i % 6) * 1.8, 0.16, 4.4 + Math.floor(i / 6) * 0.9);
    flowersGroup.add(fl);
  }
  flowersGroup.visible = false;
  root.add(flowersGroup);

  return {
    root,
    interactables,
    draggables,
    dropZones: [
      {id: 'bin_recycle', position: new THREE.Vector3(-1.5, 0.8, -2.5), radius: 1.5, accepts: ['bottle_litter', 'can_litter']},
      {id: 'bin_organic', position: new THREE.Vector3(1.5, 0.8, -2.5), radius: 1.5, accepts: ['banana_litter']},
    ],
    labelAnchors,
    obstacles: [],
    walkBounds: {minX: -7, maxX: 7, minZ: -6, maxZ: 6},
    getInitialState: () =>
      makeBaseState({
        recycleOpen: false,
        organicOpen: false,
        plasticSorted: false,
        organicSorted: false,
        canSorted: false,
        tree1Planted: false,
        tree1Watered: false,
        tree2Planted: false,
      }),
    performAction: (actionId, state) => {
      switch (actionId) {
        case 'bin_recycle_open':
          return {changed: true, nextState: pushAction(state, 'bin_recycle_open', 'bin_recycle', {recycleOpen: true}), feedbackEn: 'Blue Recycling Bin lid opened.', feedbackVi: 'Đã mở nắp thùng Tái chế.', soundKey: 'click'};
        case 'bin_recycle_close':
          return {changed: true, nextState: pushAction(state, 'bin_recycle_close', 'bin_recycle', {recycleOpen: false}), feedbackEn: 'Recycling Bin lid closed.', feedbackVi: 'Đã đóng nắp thùng Tái chế.', soundKey: 'click'};
        case 'bin_organic_open':
          return {changed: true, nextState: pushAction(state, 'bin_organic_open', 'bin_organic', {organicOpen: true}), feedbackEn: 'Green Organic Bin lid opened.', feedbackVi: 'Đã mở nắp thùng Hữu cơ.', soundKey: 'click'};
        case 'bin_organic_close':
          return {changed: true, nextState: pushAction(state, 'bin_organic_close', 'bin_organic', {organicOpen: false}), feedbackEn: 'Organic Bin lid closed.', feedbackVi: 'Đã đóng nắp thùng Hữu cơ.', soundKey: 'click'};
        case 'sort_plastic':
          return {changed: true, nextState: pushAction(state, 'sort_plastic', 'bottle_litter', {plasticSorted: true, recycleOpen: true}), feedbackEn: 'Plastic bottle recycled correctly!', feedbackVi: 'Chính xác! Chai nhựa đã vào thùng Tái chế.', soundKey: 'plant', spokenEn: 'Great! The plastic bottle goes into the recycling bin.'};
        case 'sort_organic':
          return {changed: true, nextState: pushAction(state, 'sort_organic', 'banana_litter', {organicSorted: true, organicOpen: true}), feedbackEn: 'Organic waste sorted for composting!', feedbackVi: 'Chính xác! Rác hữu cơ đã vào thùng Hữu cơ.', soundKey: 'plant', spokenEn: 'Organic food waste goes into the green organic bin.'};
        case 'sort_can':
          return {changed: true, nextState: pushAction(state, 'sort_can', 'can_litter', {canSorted: true}), feedbackEn: 'Aluminium can collected and recycled!', feedbackVi: 'Đã thu gom lon nhôm vào thùng Tái chế.', soundKey: 'plant', spokenEn: 'Aluminium can recycled.'};
        case 'plant_tree_1':
          return {changed: true, nextState: pushAction(state, 'plant_tree_1', 'tree_plot_1', {tree1Planted: true}), feedbackEn: 'Sapling A planted in the soil!', feedbackVi: 'Đã trồng cây non tại Hố A.', soundKey: 'plant', spokenEn: 'You planted a young tree.'};
        case 'water_tree_1':
          if (!state.flags.tree1Planted) return {changed: false, nextState: state, feedbackEn: 'Plant the sapling first!', feedbackVi: 'Hãy trồng cây non trước khi tưới nước!', soundKey: 'error'};
          return {changed: true, nextState: pushAction(state, 'water_tree_1', 'tree_plot_1', {tree1Watered: true}), feedbackEn: 'Sapling A watered — watch it grow tall!', feedbackVi: 'Đã tưới nước — cây xanh đang vươn cao tỏa tán!', soundKey: 'water', spokenEn: 'Watering helps the young tree grow strong.'};
        case 'plant_tree_2':
          return {changed: true, nextState: pushAction(state, 'plant_tree_2', 'tree_plot_2', {tree2Planted: true}), feedbackEn: 'Second tree planted — the park is flourishing!', feedbackVi: 'Đã trồng cây thứ hai — công viên xanh mát rực rỡ hoa!', soundKey: 'mission_complete', spokenEn: 'The park looks clean and green now.'};
        default:
          return {changed: false, nextState: state, feedbackEn: '', feedbackVi: ''};
      }
    },
    getMetrics: (state) => {
      const sorted = [state.flags.plasticSorted, state.flags.organicSorted, state.flags.canSorted].filter(Boolean).length;
      const trees = [state.flags.tree1Planted, state.flags.tree2Planted].filter(Boolean).length;
      const scorePct = Math.round(((sorted + trees) / 5) * 100);
      return [
        {id: 'waste', labelEn: 'Park Cleanliness', labelVi: 'Độ sạch công viên', value: `${sorted}/3 vật phẩm`, percent: (sorted / 3) * 100, tone: sorted === 3 ? 'good' : 'warn'},
        {id: 'greenery', labelEn: 'Green Index', labelVi: 'Độ phủ xanh (minh họa)', value: `${scorePct}%`, percent: scorePct, tone: scorePct >= 80 ? 'good' : 'neutral', illustrative: true},
      ];
    },
    update: (elapsed, delta, state, paused) => {
      const d = paused ? 0 : delta;
      recycleBin.lidPivot.rotation.x = THREE.MathUtils.damp(recycleBin.lidPivot.rotation.x, state.flags.recycleOpen ? -1.45 : 0, 8, d || 0.016);
      organicBin.lidPivot.rotation.x = THREE.MathUtils.damp(organicBin.lidPivot.rotation.x, state.flags.organicOpen ? -1.45 : 0, 8, d || 0.016);

      bottle.visible = !state.flags.plasticSorted;
      banana.visible = !state.flags.organicSorted;
      can.visible = !state.flags.canSorted;

      // Growing & gently swaying trees
      plot1.tree.visible = Boolean(state.flags.tree1Planted);
      const t1Scale = state.flags.tree1Watered ? 1.15 : state.flags.tree1Planted ? 0.55 : 0.01;
      const s1 = THREE.MathUtils.damp(plot1.tree.scale.x, t1Scale, 4, d || 0.016);
      plot1.tree.scale.setScalar(s1);
      if (!paused) plot1.tree.rotation.z = Math.sin(elapsed * 1.4) * 0.03;

      plot2.tree.visible = Boolean(state.flags.tree2Planted);
      const t2Scale = state.flags.tree2Planted ? 1.05 : 0.01;
      const s2 = THREE.MathUtils.damp(plot2.tree.scale.x, t2Scale, 4, d || 0.016);
      plot2.tree.scale.setScalar(s2);
      if (!paused) plot2.tree.rotation.z = Math.cos(elapsed * 1.3) * 0.03;

      flowersGroup.visible = Boolean(state.flags.plasticSorted && state.flags.organicSorted && state.flags.tree1Planted);
    },
    dispose: () => disposeSceneRoot(root, mats),
  };
}

// ============================================================================
// GRADE 10 · UNIT 3: MUSIC (Playable Piano Keys + Guitar + Drum Kit + Mixer)
// ============================================================================
export function buildG10U3MusicStage(): BuiltWorld3DScene {
  const mats = new MaterialLibrary();
  const root = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const labelAnchors = new Map<string, THREE.Vector3>();

  // Wooden Acoustic Concert Stage
  const stageDeck = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.55, 6.8), mats.wood('#784c2a', '#59361a', 6, 4));
  stageDeck.position.set(0, -0.275, -0.4);
  stageDeck.receiveShadow = true;
  root.add(stageDeck);

  // Stage Lighting Truss Arch
  const trussMat = mats.metal('#334155', 0.35, 0.8);
  const leftPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4.4, 10), trussMat);
  leftPillar.position.set(-5.0, 2.2, -3.2);
  const rightPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4.4, 10), trussMat);
  rightPillar.position.set(5.0, 2.2, -3.2);
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.22, 0.22), trussMat);
  topBar.position.set(0, 4.35, -3.2);
  root.add(leftPillar, rightPillar, topBar);

  const stageSpotLights: THREE.Mesh[] = [];
  [-3.2, -1.1, 1.1, 3.2].forEach((x, idx) => {
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 10),
      mats.standard('#fef08a', 0.2, 0.1, {emissive: idx % 2 === 0 ? '#38bdf8' : '#f59e0b', emissiveIntensity: 0.35})
    );
    bulb.position.set(x, 4.15, -3.1);
    root.add(bulb);
    stageSpotLights.push(bulb);
  });

  // --- 1. CONCERT PIANO WITH INDIVIDUAL ANIMATED KEYS ---
  const pianoGroup = new THREE.Group();
  pianoGroup.position.set(-3.1, 0, -0.6);
  const pBody = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.05, 1.0), mats.standard('#0f172a', 0.22, 0.2));
  pBody.position.y = 0.85;
  pBody.castShadow = true;
  pianoGroup.add(pBody);

  // Legs
  for (const [lx, lz] of [[-0.95, 0.35], [0.95, 0.35], [-0.95, -0.35], [0.95, -0.35]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.85, 8), mats.standard('#0f172a', 0.25, 0.2));
    leg.position.set(lx, 0.425, lz);
    pianoGroup.add(leg);
  }

  // 7 White Keys + 5 Black Keys
  const whiteKeys: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const key = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.46), mats.standard('#ffffff', 0.2, 0.05));
    key.position.set(-0.84 + i * 0.28, 0.96, 0.62);
    pianoGroup.add(key);
    whiteKeys.push(key);
  }
  [0, 1, 3, 4, 5].forEach((slot) => {
    const bk = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.28), mats.standard('#1e293b', 0.2, 0.1));
    bk.position.set(-0.7 + slot * 0.28, 1.01, 0.52);
    pianoGroup.add(bk);
  });

  tagInteractive(pianoGroup, 'piano');
  root.add(pianoGroup);
  interactables.push(pianoGroup);
  labelAnchors.set('piano', new THREE.Vector3(-3.1, 1.9, -0.6));

  // --- 2. ACOUSTIC GUITAR ON STAND WITH STRINGS ---
  const guitarGroup = new THREE.Group();
  guitarGroup.position.set(3.2, 0, -0.5);
  const gStand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.22, 0.55, 10), mats.metal('#334155', 0.4, 0.7));
  gStand.position.y = 0.275;
  guitarGroup.add(gStand);

  const gBodyLow = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.18, 22), mats.wood('#c27d38', '#8a5220', 2, 1));
  gBodyLow.rotation.x = Math.PI / 2;
  gBodyLow.position.set(0, 0.9, 0);
  gBodyLow.castShadow = true;
  const gHole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.19, 16), mats.standard('#1e1b18', 0.9, 0));
  gHole.rotation.x = Math.PI / 2;
  gHole.position.set(0, 0.95, 0.01);
  const gNeck = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.08), mats.wood('#5c3a1e', '#3e2511', 1, 1));
  gNeck.position.set(0, 1.75, 0);
  guitarGroup.add(gBodyLow, gHole, gNeck);

  const guitarStrings: THREE.Mesh[] = [];
  for (let s = 0; s < 4; s++) {
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.35, 6), mats.metal('#e2e8f0', 0.15, 0.95));
    str.position.set(-0.045 + s * 0.03, 1.45, 0.1);
    guitarGroup.add(str);
    guitarStrings.push(str);
  }

  tagInteractive(guitarGroup, 'guitar');
  root.add(guitarGroup);
  interactables.push(guitarGroup);
  labelAnchors.set('guitar', new THREE.Vector3(3.2, 2.45, -0.5));

  // --- 3. 5-PIECE STAGE DRUM KIT ---
  const drumGroup = new THREE.Group();
  drumGroup.position.set(0, 0, -1.35);

  const kick = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.52, 22), mats.standard('#dc2626', 0.28, 0.25));
  kick.rotation.x = Math.PI / 2;
  kick.position.set(0, 0.58, 0);
  kick.castShadow = true;
  const snare = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 18), mats.metal('#e2e8f0', 0.25, 0.75));
  snare.position.set(-0.78, 0.82, 0.25);
  const hihatStand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.25, 8), mats.metal('#cbd5e1', 0.25, 0.85));
  hihatStand.position.set(-1.15, 0.625, 0.15);
  const hihat = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.04, 20), mats.metal('#eab308', 0.22, 0.9));
  hihat.position.set(-1.15, 1.26, 0.15);
  const floorTom = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.48, 18), mats.standard('#dc2626', 0.28, 0.25));
  floorTom.position.set(0.82, 0.62, 0.18);
  drumGroup.add(kick, snare, hihatStand, hihat, floorTom);

  tagInteractive(drumGroup, 'drums');
  root.add(drumGroup);
  interactables.push(drumGroup);
  labelAnchors.set('drums', new THREE.Vector3(0, 1.75, -1.35));

  // --- 4. AUDIO MIXER & STAGE CONSOLE ---
  const mixerGroup = new THREE.Group();
  mixerGroup.position.set(0, 0, 1.75);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.88, 0.72), mats.standard('#1e293b', 0.45, 0.35));
  desk.position.y = 0.44;
  desk.castShadow = true;
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.09, 14), mats.metal('#06b6d4', 0.25, 0.7));
  knob.position.set(0.35, 0.92, 0);
  mixerGroup.add(desk, knob);

  tagInteractive(mixerGroup, 'mixer');
  root.add(mixerGroup);
  interactables.push(mixerGroup);
  labelAnchors.set('mixer', new THREE.Vector3(0, 1.4, 1.75));

  let activeKeyIndex = -1;
  let keyPulse = 0;
  let guitarPulse = 0;
  let drumPulse = 0;

  return {
    root,
    interactables,
    draggables: [],
    dropZones: [],
    labelAnchors,
    obstacles: [],
    walkBounds: {minX: -5, maxX: 5, minZ: -3, maxZ: 3},
    getInitialState: () =>
      makeBaseState({stageArranged: false, concertVolume: false}, {volume: 60}),
    performAction: (actionId, state) => {
      switch (actionId) {
        case 'piano_c':
          activeKeyIndex = 0;
          keyPulse = 1;
          return {changed: true, nextState: pushAction(state, 'piano_c', 'piano'), feedbackEn: 'Played Piano Note C4 (Do).', feedbackVi: 'Đã nhấn phím Piano Đô (C4).', soundKey: 'piano_261.63'};
        case 'piano_e':
          activeKeyIndex = 2;
          keyPulse = 1;
          return {changed: true, nextState: pushAction(state, 'piano_e', 'piano'), feedbackEn: 'Played Piano Note E4 (Mi).', feedbackVi: 'Đã nhấn phím Piano Mi (E4).', soundKey: 'piano_329.63'};
        case 'piano_g':
          activeKeyIndex = 4;
          keyPulse = 1;
          return {changed: true, nextState: pushAction(state, 'piano_g', 'piano'), feedbackEn: 'Played Piano Note G4 (Sol) — C-Major chord complete!', feedbackVi: 'Đã nhấn phím Piano Sol (G4)!', soundKey: 'piano_392.00'};
        case 'guitar_low':
          guitarPulse = 1;
          return {changed: true, nextState: pushAction(state, 'guitar_low', 'guitar'), feedbackEn: 'Plucked Acoustic Guitar bass string (E).', feedbackVi: 'Đã gảy dây trầm (E) trên đàn Guitar thùng.', soundKey: 'guitar_164.81'};
        case 'guitar_high':
          guitarPulse = 1;
          return {changed: true, nextState: pushAction(state, 'guitar_high', 'guitar'), feedbackEn: 'Plucked Acoustic Guitar melody string (G).', feedbackVi: 'Đã gảy dây giai điệu (G) trên đàn Guitar.', soundKey: 'guitar_392.00'};
        case 'drum_kick':
          drumPulse = 1;
          return {changed: true, nextState: pushAction(state, 'drum_kick', 'drums'), feedbackEn: 'Hit the Bass Kick Drum!', feedbackVi: 'Đã đánh trống Bass!', soundKey: 'drum_kick'};
        case 'drum_snare':
          drumPulse = 1;
          return {changed: true, nextState: pushAction(state, 'drum_snare', 'drums'), feedbackEn: 'Hit the Snare Drum!', feedbackVi: 'Đã đánh trống Snare!', soundKey: 'drum_snare'};
        case 'drum_hihat':
          drumPulse = 1;
          return {changed: true, nextState: pushAction(state, 'drum_hihat', 'drums'), feedbackEn: 'Struck the Hi-Hat Cymbal!', feedbackVi: 'Đã đánh chũm chọe Hi-Hat!', soundKey: 'drum_hihat'};
        case 'volume_boost':
          return {changed: true, nextState: pushAction(state, 'volume_boost', 'mixer', {concertVolume: true}, {volume: 85}), feedbackEn: 'Stage volume set to 85% for live soundcheck.', feedbackVi: 'Đã chỉnh âm lượng sân khấu lên 85%.', soundKey: 'click', spokenEn: 'Stage audio volume is ready for the concert.'};
        case 'stage_arrange':
          return {changed: true, nextState: pushAction(state, 'stage_arrange', 'mixer', {stageArranged: true}), feedbackEn: 'Concert formation locked in and stage spotlights illuminated!', feedbackVi: 'Đã sắp xếp đội hình biểu diễn và bật sáng đèn sân khấu!', soundKey: 'mission_complete', spokenEn: 'All musical instruments are ready on stage.'};
        default:
          return {changed: false, nextState: state, feedbackEn: '', feedbackVi: ''};
      }
    },
    getMetrics: (state) => [
      {id: 'vol', labelEn: 'Stage Volume', labelVi: 'Âm lượng sân khấu', value: `${state.values.volume ?? 60}%`, percent: state.values.volume ?? 60, tone: 'good'},
      {id: 'stage', labelEn: 'Concert Setup', labelVi: 'Đội hình sân khấu', value: state.flags.stageArranged ? 'Sẵn sàng' : 'Đang thử âm', percent: state.flags.stageArranged ? 100 : 45, tone: state.flags.stageArranged ? 'good' : 'neutral'},
    ],
    update: (elapsed, delta, state, paused) => {
      if (!paused) {
        keyPulse = Math.max(0, keyPulse - delta * 3.2);
        guitarPulse = Math.max(0, guitarPulse - delta * 2.8);
        drumPulse = Math.max(0, drumPulse - delta * 4.5);
      }
      whiteKeys.forEach((k, idx) => {
        k.position.y = idx === activeKeyIndex ? 0.96 - keyPulse * 0.045 : 0.96;
      });
      guitarStrings.forEach((s, idx) => {
        s.position.x = -0.045 + idx * 0.03 + Math.sin(elapsed * 55 + idx) * guitarPulse * 0.015;
      });
      kick.scale.setScalar(1 + drumPulse * 0.05);
      hihat.rotation.z = Math.sin(elapsed * 26) * drumPulse * 0.12;

      // Concert formation smooth shift
      const d = paused ? 0 : delta || 0.016;
      pianoGroup.position.x = THREE.MathUtils.damp(pianoGroup.position.x, state.flags.stageArranged ? -2.75 : -3.3, 4, d);
      guitarGroup.position.x = THREE.MathUtils.damp(guitarGroup.position.x, state.flags.stageArranged ? 2.75 : 3.3, 4, d);
      knob.rotation.y = THREE.MathUtils.damp(knob.rotation.y, state.flags.concertVolume ? 2.2 : 0, 5, d);

      stageSpotLights.forEach((b, i) => {
        const mat = b.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = state.flags.stageArranged ? 0.85 + Math.sin(elapsed * 3 + i) * 0.25 : 0.25;
      });
    },
    dispose: () => disposeSceneRoot(root, mats),
  };
}

// ============================================================================
// GRADE 10 · UNIT 5: INVENTIONS (Workbench + Assembly Sequence + Power Test)
// ============================================================================
export function buildG10U5InventionWorkshop(): BuiltWorld3DScene {
  const mats = new MaterialLibrary();
  const root = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const draggables: THREE.Object3D[] = [];
  const labelAnchors = new Map<string, THREE.Vector3>();

  // Workshop studio floor & pegboard wall
  const floor = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.2, 8.2), mats.tileFloor('#e2e8f0', '#cbd5e1', 6, 5));
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  root.add(floor);

  const wall = new THREE.Mesh(new THREE.BoxGeometry(10.5, 4.2, 0.2), mats.standard('#1e293b', 0.7, 0.2));
  wall.position.set(0, 2.1, -3.6);
  root.add(wall);

  // --- WORKBENCH + CENTRAL PROTOTYPE CRADLE ---
  const benchGroup = new THREE.Group();
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.16, 2.8), mats.wood('#8d5b34', '#6b4222', 4, 2));
  tableTop.position.set(0, 1.0, 0);
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  benchGroup.add(tableTop);

  for (const [lx, lz] of [[-3.1, 1.1], [3.1, 1.1], [-3.1, -1.1], [3.1, -1.1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 0.16), mats.metal('#334155', 0.4, 0.75));
    leg.position.set(lx, 0.5, lz);
    benchGroup.add(leg);
  }

  // Diagnostic Monitor on bench back
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 0.12), mats.standard('#0f172a', 0.35, 0.4));
  monitor.position.set(0, 1.68, -1.05);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.32, 0.76),
    mats.standard('#0f172a', 0.2, 0.1, {emissive: '#06b6d4', emissiveIntensity: 0.08})
  );
  screen.position.set(0, 1.68, -0.98);
  benchGroup.add(monitor, screen);

  // Central Assembly Cradle
  const cradle = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.82, 0.12, 24), mats.metal('#475569', 0.35, 0.75));
  cradle.position.set(0, 1.14, 0.2);
  benchGroup.add(cradle);

  // Assembled prototype parts (revealed sequentially on cradle!)
  const assembledBattery = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.26, 0.76), mats.standard('#0ea5e9', 0.35, 0.35));
  assembledBattery.position.set(0, 1.33, 0.2);
  assembledBattery.visible = false;

  const assembledChip = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.14, 0.6), mats.standard('#10b981', 0.3, 0.5));
  assembledChip.position.set(0, 1.54, 0.2);
  assembledChip.visible = false;

  const assembledSensor = new THREE.Group();
  assembledSensor.position.set(0, 1.72, 0.2);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mats.glass('#38bdf8', 0.6));
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.09), mats.metal('#f59e0b', 0.2, 0.8));
  rotor.position.y = 0.08;
  assembledSensor.add(dome, rotor);
  assembledSensor.visible = false;

  // Circuit connecting wires
  const wireMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.56, 0.035, 8, 24),
    mats.standard('#f59e0b', 0.3, 0.5, {emissive: '#f59e0b', emissiveIntensity: 0})
  );
  wireMesh.rotation.x = Math.PI / 2;
  wireMesh.position.set(0, 1.46, 0.2);
  wireMesh.visible = false;

  benchGroup.add(assembledBattery, assembledChip, assembledSensor, wireMesh);
  tagInteractive(benchGroup, 'workbench');
  root.add(benchGroup);
  interactables.push(benchGroup);
  labelAnchors.set('workbench', new THREE.Vector3(0, 2.35, 0.1));

  // --- 3 DRAGGABLE PARTS ON SIDE TRAYS ---
  const partBat = new THREE.Group();
  partBat.position.set(-2.35, 1.08, 0.35);
  const pbMesh = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.24, 0.62), mats.standard('#0ea5e9', 0.35, 0.35));
  pbMesh.position.y = 0.12;
  partBat.add(pbMesh);
  tagInteractive(partBat, 'part_battery', true);
  root.add(partBat);
  interactables.push(partBat);
  draggables.push(partBat);
  labelAnchors.set('part_battery', new THREE.Vector3(-2.35, 1.7, 0.35));

  const partChip = new THREE.Group();
  partChip.position.set(2.25, 1.08, 0.45);
  const pcMesh = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.12, 0.55), mats.standard('#10b981', 0.3, 0.5));
  pcMesh.position.y = 0.06;
  partChip.add(pcMesh);
  tagInteractive(partChip, 'part_chip', true);
  root.add(partChip);
  interactables.push(partChip);
  draggables.push(partChip);
  labelAnchors.set('part_chip', new THREE.Vector3(2.25, 1.65, 0.45));

  const partSensor = new THREE.Group();
  partSensor.position.set(2.35, 1.08, -0.55);
  const psMesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mats.glass('#38bdf8', 0.7));
  partSensor.add(psMesh);
  tagInteractive(partSensor, 'part_sensor', true);
  root.add(partSensor);
  interactables.push(partSensor);
  draggables.push(partSensor);
  labelAnchors.set('part_sensor', new THREE.Vector3(2.35, 1.65, -0.55));

  return {
    root,
    interactables,
    draggables,
    dropZones: [
      {id: 'workbench', position: new THREE.Vector3(0, 1.2, 0.2), radius: 1.4, accepts: ['part_battery', 'part_chip', 'part_sensor']},
    ],
    labelAnchors,
    obstacles: [],
    walkBounds: {minX: -4, maxX: 4, minZ: -2, maxZ: 3},
    getInitialState: () =>
      makeBaseState({
        batteryMounted: false,
        chipMounted: false,
        sensorMounted: false,
        wiresConnected: false,
        powerOn: false,
        testPassed: false,
      }),
    performAction: (actionId, state) => {
      switch (actionId) {
        case 'mount_battery':
          return {changed: true, nextState: pushAction(state, 'mount_battery', 'part_battery', {batteryMounted: true}), feedbackEn: 'Battery pack mounted onto the assembly cradle!', feedbackVi: 'Đã lắp khối pin sạc vào khung thiết bị.', soundKey: 'build', spokenEn: 'Battery pack mounted.'};
        case 'mount_chip':
          if (!state.flags.batteryMounted) return {changed: false, nextState: state, feedbackEn: 'Mount the battery pack first!', feedbackVi: 'Hãy lắp Khối pin sạc trước!', soundKey: 'error'};
          return {changed: true, nextState: pushAction(state, 'mount_chip', 'part_chip', {chipMounted: true}), feedbackEn: 'Smart microcontroller installed cleanly.', feedbackVi: 'Đã lắp bo mạch vi điều khiển lên trên khối pin.', soundKey: 'build', spokenEn: 'Microcontroller installed.'};
        case 'mount_sensor':
          if (!state.flags.chipMounted) return {changed: false, nextState: state, feedbackEn: 'Install the processor board first!', feedbackVi: 'Hãy lắp Bo mạch điều khiển trước!', soundKey: 'error'};
          return {changed: true, nextState: pushAction(state, 'mount_sensor', 'part_sensor', {sensorMounted: true}), feedbackEn: 'Optical sensor dome attached!', feedbackVi: 'Đã gắn cụm cảm biến quang học lên đỉnh nguyên mẫu.', soundKey: 'build', spokenEn: 'Optical sensor attached.'};
        case 'connect_wires':
          if (!state.flags.sensorMounted) return {changed: false, nextState: state, feedbackEn: 'Assemble all 3 components first!', feedbackVi: 'Cần lắp đủ 3 linh kiện trước khi kết nối dây mạch!', soundKey: 'error'};
          return {changed: true, nextState: pushAction(state, 'connect_wires', 'workbench', {wiresConnected: true}), feedbackEn: 'Circuit wiring linked across all modules!', feedbackVi: 'Đã nối hoàn chỉnh mạch điện liên kết các linh kiện.', soundKey: 'click', spokenEn: 'All circuit wires are connected.'};
        case 'power_on':
          if (!state.flags.wiresConnected) return {changed: false, nextState: state, feedbackEn: 'Connect circuit wires before powering on!', feedbackVi: 'Hãy kết nối dây mạch trước khi bật nguồn!', soundKey: 'error'};
          return {changed: true, nextState: pushAction(state, 'power_on', 'workbench', {powerOn: true}), feedbackEn: 'Prototype powered ON — monitor active!', feedbackVi: 'Đã bật nguồn — màn hình chẩn đoán đã sáng!', soundKey: 'servo', spokenEn: 'Power is on.'};
        case 'run_test':
          if (!state.flags.powerOn) return {changed: false, nextState: state, feedbackEn: 'Switch power ON first!', feedbackVi: 'Hãy bật nguồn trước khi chạy kiểm thử!', soundKey: 'error'};
          return {changed: true, nextState: pushAction(state, 'run_test', 'workbench', {testPassed: true}), feedbackEn: 'Diagnostic test passed! The invention is operating smoothly.', feedbackVi: 'Kiểm thử thành công! Cánh quạt và cảm biến vận hành ổn định.', soundKey: 'mission_complete', spokenEn: 'Diagnostic test passed. The invention is working.'};
        default:
          return {changed: false, nextState: state, feedbackEn: '', feedbackVi: ''};
      }
    },
    getMetrics: (state) => {
      const parts = [state.flags.batteryMounted, state.flags.chipMounted, state.flags.sensorMounted].filter(Boolean).length;
      return [
        {id: 'asm', labelEn: 'Assembly Progress', labelVi: 'Tiến độ lắp ráp', value: `${parts}/3 linh kiện`, percent: (parts / 3) * 100, tone: parts === 3 ? 'good' : 'neutral'},
        {id: 'pwr', labelEn: 'Prototype Status', labelVi: 'Trạng thái thiết bị', value: state.flags.testPassed ? 'Đạt chuẩn' : state.flags.powerOn ? 'Đang bật nguồn' : 'Chờ lắp ráp', percent: state.flags.testPassed ? 100 : state.flags.powerOn ? 70 : 15, tone: state.flags.testPassed ? 'good' : 'neutral'},
      ];
    },
    update: (elapsed, delta, state, paused) => {
      partBat.visible = !state.flags.batteryMounted;
      partChip.visible = !state.flags.chipMounted;
      partSensor.visible = !state.flags.sensorMounted;

      assembledBattery.visible = Boolean(state.flags.batteryMounted);
      assembledChip.visible = Boolean(state.flags.chipMounted);
      assembledSensor.visible = Boolean(state.flags.sensorMounted);
      wireMesh.visible = Boolean(state.flags.wiresConnected);

      (wireMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = state.flags.powerOn ? 0.75 : 0.05;
      (screen.material as THREE.MeshStandardMaterial).emissiveIntensity = state.flags.testPassed
        ? 0.75 + Math.sin(elapsed * 5) * 0.15
        : state.flags.powerOn
          ? 0.45
          : 0.08;
      if (state.flags.testPassed && !paused) {
        rotor.rotation.y += delta * 9.5;
      }
    },
    dispose: () => disposeSceneRoot(root, mats),
  };
}

// ============================================================================
// GRADE 10 · UNIT 9: PROTECTING THE ENVIRONMENT (River Valley Transformation)
// ============================================================================
export function buildG10U9RiverValley(): BuiltWorld3DScene {
  const mats = new MaterialLibrary();
  const root = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const labelAnchors = new Map<string, THREE.Vector3>();

  // Valley terrain
  const terrain = new THREE.Mesh(new THREE.CylinderGeometry(16.5, 17.5, 0.4, 48), mats.grass('#65a34e', '#4c8239', 10, 10));
  terrain.position.y = -0.2;
  terrain.receiveShadow = true;
  root.add(terrain);

  // Flowing River channel (transitions color murky -> crystal blue!)
  const riverMat = mats.water('#6b5e4c');
  const river = new THREE.Mesh(new THREE.BoxGeometry(24, 0.12, 3.2), riverMat);
  river.position.set(0, 0.01, 0.8);
  river.rotation.y = 0.18;
  root.add(river);

  // Residential Village Houses on far bank
  for (let i = 0; i < 3; i++) {
    const house = new THREE.Group();
    house.position.set(-4.2 + i * 2.5, 0, -4.4);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.25, 1.3), mats.standard('#f8fafc', 0.8, 0.04));
    body.position.y = 0.625;
    body.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.85, 4), mats.standard('#dc2626', 0.7, 0.08));
    roof.position.y = 1.65;
    roof.rotation.y = Math.PI / 4;
    house.add(body, roof);
    root.add(house);
  }

  // --- 1. FLOATING RIVER PLASTIC DEBRIS ---
  const wasteGroup = new THREE.Group();
  wasteGroup.position.set(-1.2, 0.12, 1.0);
  for (let i = 0; i < 7; i++) {
    const piece = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.16, 0),
      mats.standard(i % 2 === 0 ? '#e2e8f0' : '#f97316', 0.4, 0.1)
    );
    piece.position.set(-1.5 + i * 0.55, 0.04, (i % 3 - 1) * 0.45);
    wasteGroup.add(piece);
  }
  tagInteractive(wasteGroup, 'river_waste');
  root.add(wasteGroup);
  interactables.push(wasteGroup);
  labelAnchors.set('river_waste', new THREE.Vector3(-1.2, 0.95, 1.0));

  // --- 2. WATER TREATMENT STATION ---
  const filterGroup = new THREE.Group();
  filterGroup.position.set(3.8, 0, -2.1);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.0, 1.4, 20), mats.metal('#94a3b8', 0.32, 0.7));
  tank.position.y = 0.7;
  tank.castShadow = true;
  const aerator = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.18), mats.metal('#0ea5e9', 0.25, 0.6));
  aerator.position.y = 1.48;
  filterGroup.add(tank, aerator);
  tagInteractive(filterGroup, 'filter_station');
  root.add(filterGroup);
  interactables.push(filterGroup);
  labelAnchors.set('filter_station', new THREE.Vector3(3.8, 2.05, -2.1));

  // --- 3. WATERSHED HILLSIDE & GROWING FOREST ---
  const hillGroup = new THREE.Group();
  hillGroup.position.set(-3.6, 0, 4.1);
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 3.0, 0.6, 16), mats.standard('#78553a', 0.95, 0));
  mound.position.y = 0.3;
  hillGroup.add(mound);

  const hillTrees: THREE.Group[] = [];
  for (let i = 0; i < 4; i++) {
    const tr = createDetailedTree(mats, 1.0, '#16a34a');
    tr.position.set(-1.2 + i * 0.85, 0.55, (i % 2 - 0.5) * 0.9);
    tr.scale.setScalar(0.01);
    tr.visible = false;
    hillGroup.add(tr);
    hillTrees.push(tr);
  }
  tagInteractive(hillGroup, 'hill_forest');
  root.add(hillGroup);
  interactables.push(hillGroup);
  labelAnchors.set('hill_forest', new THREE.Vector3(-3.6, 2.1, 4.1));

  // --- 4. COMMUNITY ACTION BOARD ---
  const boardGroup = new THREE.Group();
  boardGroup.position.set(3.2, 0, 3.6);
  const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8), mats.wood('#6b4222', '#4a2c15'));
  post1.position.set(-0.65, 0.75, 0);
  const post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8), mats.wood('#6b4222', '#4a2c15'));
  post2.position.set(0.65, 0.75, 0);
  const boardFace = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.95, 0.08),
    mats.signTexture('GREEN VALLEY', 'Zero-Plastic Plan', '#ecfdf5', '#065f46')
  );
  boardFace.position.y = 1.35;
  boardGroup.add(post1, post2, boardFace);
  tagInteractive(boardGroup, 'eco_board');
  root.add(boardGroup);
  interactables.push(boardGroup);
  labelAnchors.set('eco_board', new THREE.Vector3(3.2, 2.25, 3.6));

  return {
    root,
    interactables,
    draggables: [],
    dropZones: [],
    labelAnchors,
    obstacles: [],
    walkBounds: {minX: -7, maxX: 7, minZ: -6, maxZ: 6},
    getInitialState: () =>
      makeBaseState({trashCollected: false, filterActive: false, hillPlanted: false, hillCared: false, greenPlan: false}),
    performAction: (actionId, state) => {
      switch (actionId) {
        case 'collect_river_trash':
          return {changed: true, nextState: pushAction(state, 'collect_river_trash', 'river_waste', {trashCollected: true}), feedbackEn: 'All floating plastic debris cleared from the riverbank!', feedbackVi: 'Đã thu gom sạch rác nhựa ven sông!', soundKey: 'plant', spokenEn: 'The riverbank is now free of plastic waste.'};
        case 'activate_filter':
          return {changed: true, nextState: pushAction(state, 'activate_filter', 'filter_station', {filterActive: true}), feedbackEn: 'Water purification active — watch the river turn crystal blue!', feedbackVi: 'Trạm lọc nước đã hoạt động — dòng sông chuyển sang xanh trong!', soundKey: 'water', spokenEn: 'Clean water is flowing into the river.'};
        case 'reforest_plant':
          return {changed: true, nextState: pushAction(state, 'reforest_plant', 'hill_forest', {hillPlanted: true}), feedbackEn: 'Native saplings planted along the hillside.', feedbackVi: 'Đã trồng hàng cây bản địa trên sườn đồi.', soundKey: 'plant', spokenEn: 'Young trees are planted on the hillside.'};
        case 'reforest_care':
          if (!state.flags.hillPlanted) return {changed: false, nextState: state, feedbackEn: 'Plant hillside trees first!', feedbackVi: 'Hãy trồng rừng trước khi chăm sóc!', soundKey: 'error'};
          return {changed: true, nextState: pushAction(state, 'reforest_care', 'hill_forest', {hillCared: true}), feedbackEn: 'Hillside forest thriving tall and dense!', feedbackVi: 'Rừng đầu nguồn đã phát triển xanh rậm bảo vệ lưu vực sông!', soundKey: 'water', spokenEn: 'The forest is growing strong and protecting the river.'};
        case 'choose_green_plan':
          return {changed: true, nextState: pushAction(state, 'choose_green_plan', 'eco_board', {greenPlan: true}), feedbackEn: 'Community adopted the Zero-Plastic Village Plan!', feedbackVi: 'Khu dân cư đã cam kết thực hiện kế hoạch Làng không rác nhựa!', soundKey: 'mission_complete', spokenEn: 'The community has adopted the green protection plan.'};
        default:
          return {changed: false, nextState: state, feedbackEn: '', feedbackVi: ''};
      }
    },
    getMetrics: (state) => {
      const done = [state.flags.trashCollected, state.flags.filterActive, state.flags.hillPlanted, state.flags.hillCared, state.flags.greenPlan].filter(Boolean).length;
      return [
        {id: 'water_q', labelEn: 'Water Clarity (Illustrative)', labelVi: 'Độ trong nước sông (minh họa)', value: state.flags.filterActive && state.flags.trashCollected ? 'Trong xanh' : 'Đang phục hồi', percent: state.flags.filterActive ? (state.flags.trashCollected ? 96 : 70) : 25, tone: state.flags.filterActive && state.flags.trashCollected ? 'good' : 'warn', illustrative: true},
        {id: 'valley', labelEn: 'Valley Restoration', labelVi: 'Phục hồi thung lũng', value: `${done}/5`, percent: (done / 5) * 100, tone: done >= 4 ? 'good' : 'neutral'},
      ];
    },
    update: (elapsed, delta, state, paused) => {
      wasteGroup.visible = !state.flags.trashCollected;
      if (!paused && riverMat.map) {
        riverMat.map.offset.x = (elapsed * 0.25) % 1;
      }
      const targetColor = new THREE.Color(state.flags.filterActive ? '#0284c7' : state.flags.trashCollected ? '#0e7490' : '#6b5e4c');
      riverMat.color.lerp(targetColor, paused ? 0 : Math.min(1, delta * 2.5));

      if (state.flags.filterActive && !paused) {
        aerator.rotation.y += delta * 4.5;
      }

      const d = paused ? 0 : delta || 0.016;
      hillTrees.forEach((tr, i) => {
        tr.visible = Boolean(state.flags.hillPlanted);
        const s = THREE.MathUtils.damp(tr.scale.x, state.flags.hillCared ? 1.15 : state.flags.hillPlanted ? 0.55 : 0.01, 4, d);
        tr.scale.setScalar(s);
        if (!paused) tr.rotation.z = Math.sin(elapsed * 1.4 + i) * 0.03;
      });
    },
    dispose: () => disposeSceneRoot(root, mats),
  };
}

// ============================================================================
// GRADE 10 · UNIT 10: ECOTOURISM (Walkable Trail + Wooden Bridge + Deer)
// ============================================================================
export function buildG10U10EcotourismPark(): BuiltWorld3DScene {
  const mats = new MaterialLibrary();
  const root = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const labelAnchors = new Map<string, THREE.Vector3>();

  // Lush nature reserve ground
  const terrain = new THREE.Mesh(new THREE.CylinderGeometry(18, 19, 0.4, 48), mats.grass('#3f8f46', '#2e6f34', 12, 12));
  terrain.position.y = -0.2;
  terrain.receiveShadow = true;
  root.add(terrain);

  // Flowing mountain stream cutting across X = 0
  const streamMat = mats.water('#0ea5e9');
  const stream = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 26), streamMat);
  stream.position.set(0, 0.01, 0);
  root.add(stream);

  // Dirt hiking trail
  const trail = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.03, 1.5), mats.standard('#c2a378', 0.94, 0.01));
  trail.position.set(0, 0.015, 0.5);
  root.add(trail);

  // Surrounding forest grove
  const treePositions: Array<[number, number, number]> = [
    [-6.2, 0, -4.5], [-4.5, 0, -5.8], [5.8, 0, -4.6], [6.8, 0, 2.8],
    [-6.8, 0, 3.8], [4.5, 0, 5.2], [-3.2, 0, 5.5], [3.5, 0, -5.5],
  ];
  const swayingTrees: THREE.Group[] = [];
  treePositions.forEach(([x, y, z], i) => {
    const tr = createDetailedTree(mats, 1.05 + (i % 3) * 0.2, i % 2 === 0 ? '#1b5e20' : '#2e7d32');
    tr.position.set(x, y, z);
    root.add(tr);
    swayingTrees.push(tr);
  });

  // --- 1. WOODEN TRAIL SIGNPOST ---
  const signGroup = new THREE.Group();
  signGroup.position.set(-4.0, 0, 1.8);
  const sPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.7, 10), mats.wood('#6b4222', '#4a2c15'));
  sPost.position.y = 0.85;
  const sFace = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.85, 0.09),
    mats.signTexture('ECO TRAIL →', 'Stay on Path · No Litter', '#fef3c7', '#78350f')
  );
  sFace.position.y = 1.55;
  signGroup.add(sPost, sFace);
  tagInteractive(signGroup, 'trail_sign');
  root.add(signGroup);
  interactables.push(signGroup);
  labelAnchors.set('trail_sign', new THREE.Vector3(-4.0, 2.3, 1.8));

  // --- 2. ARCHED WOODEN BRIDGE ---
  const bridgeGroup = new THREE.Group();
  bridgeGroup.position.set(0, 0, 0.5);
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const x = -1.75 + t * 3.5;
    const archY = Math.sin(t * Math.PI) * 0.34 + 0.14;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 1.7), mats.wood('#8d5b34', '#633d1f'));
    plank.position.set(x, archY, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    bridgeGroup.add(plank);
  }
  for (const rz of [-0.82, 0.82]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 0.08), mats.wood('#6b4222', '#4e2f16'));
    rail.position.set(0, 0.92, rz);
    bridgeGroup.add(rail);
  }
  tagInteractive(bridgeGroup, 'wood_bridge');
  root.add(bridgeGroup);
  interactables.push(bridgeGroup);
  labelAnchors.set('wood_bridge', new THREE.Vector3(0, 1.6, 0.5));

  // --- 3. ANIMATED FOREST DEER ---
  const deerGroup = new THREE.Group();
  deerGroup.position.set(3.6, 0, -2.0);
  const deerMat = mats.standard('#b07241', 0.82, 0.02);
  const dBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.65, 8, 12), deerMat);
  dBody.rotation.z = Math.PI / 2;
  dBody.position.y = 0.82;
  dBody.castShadow = true;
  const dNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.52, 10), deerMat);
  dNeck.position.set(0.45, 1.12, 0);
  dNeck.rotation.z = -0.35;
  const dHead = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.18), deerMat);
  dHead.position.set(0.62, 1.38, 0);
  deerGroup.add(dBody, dNeck, dHead);
  for (const [lx, lz] of [[-0.28, 0.14], [-0.28, -0.14], [0.28, 0.14], [0.28, -0.14]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.68, 8), deerMat);
    leg.position.set(lx, 0.34, lz);
    deerGroup.add(leg);
  }
  tagInteractive(deerGroup, 'forest_deer');
  root.add(deerGroup);
  interactables.push(deerGroup);
  labelAnchors.set('forest_deer', new THREE.Vector3(3.6, 1.9, -2.0));

  // --- 4. ECO-REST STATION ---
  const campGroup = new THREE.Group();
  campGroup.position.set(4.2, 0, 2.2);
  const pavilionBase = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 1.9), mats.wood('#8d5b34', '#633d1f'));
  pavilionBase.position.y = 0.09;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 0.9, 4), mats.standard('#15803d', 0.78, 0.05));
  roof.position.y = 2.35;
  roof.rotation.y = Math.PI / 4;
  campGroup.add(pavilionBase, roof);
  for (const [px, pz] of [[-0.9, 0.75], [0.9, 0.75], [-0.9, -0.75], [0.9, -0.75]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.85, 8), mats.wood('#6b4222', '#4a2c15'));
    p.position.set(px, 1.0, pz);
    campGroup.add(p);
  }
  tagInteractive(campGroup, 'eco_camp');
  root.add(campGroup);
  interactables.push(campGroup);
  labelAnchors.set('eco_camp', new THREE.Vector3(4.2, 2.95, 2.2));

  // --- CONTROLLABLE EXPLORER CHARACTER ---
  const explorer = createArticulatedCharacter(mats, '#059669', '#334155');
  explorer.group.position.set(-4.5, 0, 0.5);
  root.add(explorer.group);

  return {
    root,
    interactables,
    draggables: [],
    dropZones: [],
    labelAnchors,
    obstacles: [],
    walkBounds: {minX: -6.5, maxX: 6.5, minZ: -5.2, maxZ: 5.2},
    characterGroup: explorer.group,
    characterLimbs: explorer.limbs,
    getInitialState: () =>
      makeBaseState({signRead: false, bridgeCrossed: false, deerObserved: false, bottleRefilled: false, pledged: false}, {}, [-4.5, 0, 0.5]),
    performAction: (actionId, state) => {
      switch (actionId) {
        case 'read_sign':
          return {changed: true, nextState: pushAction(state, 'read_sign', 'trail_sign', {signRead: true}), feedbackEn: 'Trail Sign: Stay on marked paths and respect wildlife!', feedbackVi: 'Đã đọc biển chỉ dẫn: Đi đúng đường mòn và bảo vệ sinh vật rừng.', soundKey: 'click', spokenEn: 'Follow the wooden trail and leave no trace.'};
        case 'cross_bridge': {
          const next = pushAction(state, 'cross_bridge', 'wood_bridge', {bridgeCrossed: true});
          next.characterPos = [2.4, 0, 0.5];
          return {changed: true, nextState: next, feedbackEn: 'You crossed the wooden bridge over the clear mountain stream!', feedbackVi: 'Nhân vật đã băng qua cầu gỗ bắc qua dòng suối trong vắt!', soundKey: 'water', spokenEn: 'You safely crossed the wooden bridge.'};
        }
        case 'observe_deer':
          return {changed: true, nextState: pushAction(state, 'observe_deer', 'forest_deer', {deerObserved: true}), feedbackEn: 'Observed the wild forest deer quietly from a respectful distance.', feedbackVi: 'Đã quan sát hươu rừng yên lặng, giữ khoảng cách an toàn.', soundKey: 'plant', spokenEn: 'Observing wildlife quietly protects their natural habitat.'};
        case 'eco_bottle':
          return {changed: true, nextState: pushAction(state, 'eco_bottle', 'eco_camp', {bottleRefilled: true}), feedbackEn: 'Refilled your reusable bottle — zero single-use plastic!', feedbackVi: 'Đã lấy nước vào bình tái sử dụng tại trạm xanh!', soundKey: 'water', spokenEn: 'Using a reusable bottle reduces plastic waste.'};
        case 'eco_pledge':
          return {changed: true, nextState: pushAction(state, 'eco_pledge', 'eco_camp', {pledged: true}), feedbackEn: 'Leave-No-Trace ecotourism visit completed!', feedbackVi: 'Hoàn thành chuyến du lịch sinh thái có trách nhiệm!', soundKey: 'mission_complete', spokenEn: 'Thank you for being a responsible ecotourist.'};
        default:
          return {changed: false, nextState: state, feedbackEn: '', feedbackVi: ''};
      }
    },
    getMetrics: (state) => {
      const done = [state.flags.signRead, state.flags.bridgeCrossed, state.flags.deerObserved, state.flags.bottleRefilled, state.flags.pledged].filter(Boolean).length;
      return [
        {id: 'eco_resp', labelEn: 'Responsible Ecotourist', labelVi: 'Hành vi du lịch xanh', value: `${done}/5`, percent: (done / 5) * 100, tone: done >= 4 ? 'good' : 'neutral'},
      ];
    },
    update: (elapsed, _delta, _state, paused) => {
      if (!paused) {
        if (streamMat.map) streamMat.map.offset.y = (elapsed * 0.35) % 1;
        // Natural deer grazing head bob & gentle walk loop
        deerGroup.position.z = -2.0 + Math.sin(elapsed * 0.45) * 0.7;
        dHead.position.y = 1.38 + Math.sin(elapsed * 1.8) * 0.08;
        swayingTrees.forEach((tr, i) => {
          tr.rotation.z = Math.sin(elapsed * 1.3 + i) * 0.025;
        });
      }
    },
    dispose: () => disposeSceneRoot(root, mats),
  };
}
