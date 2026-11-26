import type {BuiltWorld3DScene, World3DUnitId} from './types';
import {
  buildG10U1FamilyHome,
  buildG10U2EcoPark,
  buildG10U3MusicStage,
  buildG10U5InventionWorkshop,
  buildG10U9RiverValley,
  buildG10U10EcotourismPark,
} from './SceneBuildersGrade10';
import {
  buildG11U3SmartCity,
  buildG11U5GlobalWarming,
  buildG11U6HeritageComplex,
  buildG11U10Ecosystem,
} from './SceneBuildersGrade11';
import {
  buildG12U2MulticulturalExpo,
  buildG12U3GreenLiving,
  buildG12U4Urbanisation,
  buildG12U6RoboticsLab,
  buildG12U8WildlifeSanctuary,
} from './SceneBuildersGrade12';

const SCENE_BUILDERS: Record<World3DUnitId, () => BuiltWorld3DScene> = {
  'gs10-u1': buildG10U1FamilyHome,
  'gs10-u2': buildG10U2EcoPark,
  'gs10-u3': buildG10U3MusicStage,
  'gs10-u5': buildG10U5InventionWorkshop,
  'gs10-u9': buildG10U9RiverValley,
  'gs10-u10': buildG10U10EcotourismPark,
  'gs11-u3': buildG11U3SmartCity,
  'gs11-u5': buildG11U5GlobalWarming,
  'gs11-u6': buildG11U6HeritageComplex,
  'gs11-u10': buildG11U10Ecosystem,
  'gs12-u2': buildG12U2MulticulturalExpo,
  'gs12-u3': buildG12U3GreenLiving,
  'gs12-u4': buildG12U4Urbanisation,
  'gs12-u6': buildG12U6RoboticsLab,
  'gs12-u8': buildG12U8WildlifeSanctuary,
};

export function createWorld3DScene(unitId: World3DUnitId): BuiltWorld3DScene {
  const builder = SCENE_BUILDERS[unitId];
  return builder();
}

export const SUPPORTED_WORLD_3D_IDS = Object.keys(SCENE_BUILDERS) as World3DUnitId[];
