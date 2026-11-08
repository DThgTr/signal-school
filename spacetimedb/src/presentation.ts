import type { State, TrainingView } from '../../shared/types';
import { selectNext, scenarioById, availableChoices } from './training';

// The browser receives display data, never the catalog or executable rules.
export function presentTraining(state: State): TrainingView {
  const next = selectNext(state);
  const selected = scenarioById(next.scenarioId);
  const exercise = state.exercise;
  const scenario = exercise ? scenarioById(exercise.scenarioId) : null;
  const messages: TrainingView['messages'] = [];
  if (exercise && scenario) {
    messages.push({ role: 'caller', text: scenario.opening });
    for (const decision of exercise.decisions) {
      messages.push({ role: 'learner', text: decision.text });
      if (decision.action === 'question') messages.push({ role: 'caller', text: scenario.followup });
    }
  }
  return {
    ...state,
    history: state.history.map(entry => ({ ...entry, title: scenarioById(entry.scenarioId).title })),
    next: { ...next, title: selected.title, subtitle: selected.subtitle },
    scenario: scenario ? { title: scenario.title, caller: scenario.caller, skill: scenario.skill, difficulty: scenario.difficulty } : null,
    choices: exercise?.status === 'active' ? availableChoices(exercise).map(({ id, text }) => ({ id, text })) : [],
    messages,
  };
}
