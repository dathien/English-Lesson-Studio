import type {GrammarSimulation} from '../../types/interactiveLab';
import {GRAMMAR_PART_1} from './grammarPart1';
import {GRAMMAR_PART_2} from './grammarPart2';

export const GRAMMAR_SIMULATIONS: GrammarSimulation[] = [
  ...GRAMMAR_PART_1,
  ...GRAMMAR_PART_2,
];

export function getGrammarSimulationById(id: string): GrammarSimulation | undefined {
  return GRAMMAR_SIMULATIONS.find((g) => g.id === id);
}
