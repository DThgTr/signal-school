import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, startExercise, submitDecision } from '../spacetimedb/src/training';
import { COACHING_TIMEOUT_MS, recoverCoaching, ownsCoachingAttempt } from '../spacetimedb/src/coaching';

function running() {
  const state = submitDecision(startExercise(initialState(), 'exercise-1', 1), 'exercise-1', 'verify', 0, 2);
  state.coaching = { status: 'running', startedAt: 1000, exerciseId: 'exercise-1', attemptId: 'attempt-1' };
  return state;
}
test('interrupted coaching expires without losing saved scores or assessments', () => {
  const state = running();
  assert.equal(recoverCoaching(state, 1000 + COACHING_TIMEOUT_MS - 1), state);
  const recovered = recoverCoaching(state, 1000 + COACHING_TIMEOUT_MS);
  assert.equal(recovered.coaching.status, 'unavailable');
  assert.deepEqual(recovered.history, state.history);
  assert.deepEqual(recovered.scores, state.scores);
  assert.equal(recoverCoaching(recovered, 999999), recovered);
  state.coaching.status = 'live';
  assert.equal(recoverCoaching(state, 999999), state);
});
test('late AI results cannot overwrite a retry, another exercise, or expired coaching', () => {
  const state = running();
  assert.equal(ownsCoachingAttempt(state, 'exercise-1', 'attempt-1'), true);
  assert.equal(ownsCoachingAttempt(state, 'exercise-1', 'old-attempt'), false);
  assert.equal(ownsCoachingAttempt(state, 'old-exercise', 'attempt-1'), false);
  assert.equal(ownsCoachingAttempt(recoverCoaching(state, 999999), 'exercise-1', 'attempt-1'), false);
  state.coaching = { status: 'idle' };
  assert.equal(ownsCoachingAttempt(state, 'exercise-1', 'attempt-1'), false);
});
