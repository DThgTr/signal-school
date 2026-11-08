import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, startExercise, submitDecision, selectNext, detectScam, CATALOG, exitExercise } from '../spacetimedb/src/training';
import { presentTraining } from '../spacetimedb/src/presentation';
const start = () => startExercise(initialState(), 'exercise-1', 1);
test('backend supplies display data without answer metadata or future messages', () => {
  const view = presentTraining(start());
  assert.equal(view.next.title, 'The account alert');
  assert.equal(view.messages.length, 1);
  assert.equal(view.choices.length, 3);
  assert.ok(view.choices.every(choice => !('action' in choice)));
  assert.ok(view.scenario && !('isScam' in view.scenario) && !('followup' in view.scenario));
  const questioned = presentTraining(submitDecision(start(), 'exercise-1', 'question', 0, 2));
  assert.equal(questioned.messages.length, 3);
  const complete = presentTraining(submitDecision(start(), 'exercise-1', 'verify', 0, 2));
  assert.equal(complete.choices.length, 0);
  assert.equal(complete.next.skill, 'urgency');
  assert.equal(complete.history[0].title, 'The account alert');
});
test('contrasting choices produce different saved scores and next exercises', () => {
  const safe = submitDecision(start(), 'exercise-1', 'verify', 0, 2);
  const risky = submitDecision(start(), 'exercise-1', 'comply', 0, 2);
  assert.equal(safe.scores.authority, 60);
  assert.equal(risky.scores.authority, 40);
  assert.equal(selectNext(safe).skill, 'urgency');
  assert.equal(selectNext(risky).skill, 'authority');
  assert.notEqual(selectNext(safe).scenarioId, selectNext(risky).scenarioId);
  assert.deepEqual(JSON.parse(JSON.stringify(risky)), risky);
});
test('duplicate submissions are idempotent and stale turns are rejected', () => {
  const complete = submitDecision(start(), 'exercise-1', 'comply', 0, 2);
  assert.equal(submitDecision(complete, 'exercise-1', 'comply', 0, 3), complete);
  const question = submitDecision(start(), 'exercise-1', 'question', 0, 2);
  assert.throws(() => submitDecision(question, 'exercise-1', 'comply', 0, 3));
  assert.equal(question.history.length, 0);
  assert.equal(submitDecision(question, 'exercise-1', 'verify', 1, 4).history.length, 1);
});
test('detector sees content only; urgent legitimate control avoids a high-risk label', () => {
  for (const scenario of CATALOG) {
    const result = detectScam(scenario.opening);
    if (scenario.isScam) assert.notEqual(result.label, 'No strong signals', scenario.id);
    else assert.equal(result.label, 'No strong signals');
  }
  assert.equal(detectScam('Please respond immediately.').label, 'Some risk signals');
  assert.equal(detectScam('Share your password immediately.').label, 'High risk');
});
test('legitimate control rewards verification, not indiscriminate refusal', () => {
  const control = startExercise(initialState(), 'control', 1, true);
  assert.equal(submitDecision(control, 'control', 'verify', 0, 2).history[0].delta, 10);
  assert.equal(submitDecision(control, 'control', 'decline', 0, 2).history[0].delta, 0);
});
test('clamps scores, handles exit without scoring, and rejects invalid choices', () => {
  let state = start(); state.scores.authority = 100;
  assert.equal(submitDecision(state, 'exercise-1', 'verify', 0, 2).scores.authority, 100);
  state = start(); state.scores.authority = 0;
  assert.equal(submitDecision(state, 'exercise-1', 'comply', 0, 2).scores.authority, 0);
  assert.equal(exitExercise(start()).history.length, 0);
  assert.throws(() => submitDecision(exitExercise(start()), 'exercise-1', 'verify', 0, 2));
  assert.throws(() => submitDecision(start(), 'exercise-1', 'invented', 0, 2));
});
test('skill selection takes precedence over success-based difficulty', () => {
  const state = start(); state.scores.authority = 20;
  const safe = submitDecision(state, 'exercise-1', 'verify', 0, 2);
  assert.equal(selectNext(safe).skill, 'authority');
  assert.equal(selectNext(safe).difficulty, 2);
});
