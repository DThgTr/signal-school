import type { State } from './types';
export const COACHING_TIMEOUT_MS = 120_000;
export function recoverCoaching(state: State, now: number): State {
  if (state.coaching.status !== 'running' || state.coaching.startedAt === undefined || now - state.coaching.startedAt < COACHING_TIMEOUT_MS) return state;
  return { ...state, coaching: { ...state.coaching, status: 'unavailable', error: 'Coaching was interrupted. Your result is saved; you can retry.' } };
}
export function ownsCoachingAttempt(state: State, exerciseId: string, attemptId: string): boolean {
  return state.exercise?.id === exerciseId && state.coaching.status === 'running' && state.coaching.attemptId === attemptId;
}
