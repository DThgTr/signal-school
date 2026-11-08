// Backend-owned data contracts. Frontend imports these with `import type` only.
export type Skill = 'authority' | 'urgency' | 'verification';
export type Action = 'verify' | 'comply' | 'question' | 'decline';
export type Choice = { id: string; text: string; action: Action };
export type Scenario = { id: string; title: string; subtitle: string; caller: string; skill: Skill; difficulty: 1 | 2; isScam: boolean; opening: string; followup: string; choices: Choice[]; finalChoices: Choice[]; lesson: string };
export type Detection = { label: 'High risk' | 'Some risk signals' | 'No strong signals'; reasons: { signal: string; evidence: string }[]; baseline: true };
export type Decision = { optionId: string; text: string; action: Action; turn: number };
export type Exercise = { id: string; scenarioId: string; status: 'active' | 'completed' | 'exited'; decisions: Decision[]; startedAt: number; completedAt?: number; cue?: 'pause' | 'question' | 'verify' };
export type Assessment = { exerciseId: string; scenarioId: string; skill: Skill; outcome: 'protective' | 'risky' | 'incomplete'; oldScore: number; newScore: number; delta: number; feedback: string; detection: Detection; completedAt: number };
export type Trace = { tool: string; detail: string; source: 'application' | 'nemotron'; status: 'ok' | 'error' };
export type Coaching = { status: 'idle' | 'running' | 'live' | 'unavailable'; exerciseId?: string; attemptId?: string; feedback?: string; cue?: 'pause' | 'question' | 'verify'; model?: string; error?: string; startedAt?: number };
export type State = { version: 1; scores: Record<Skill, number>; exercise: Exercise | null; history: Assessment[]; trace: Trace[]; coaching: Coaching; revision: number };
export type Selection = { scenarioId: string; skill: Skill; rationale: string; difficulty: number };
export type TrainingView = Omit<State, 'history'> & {
  history: (Assessment & { title: string })[];
  next: Selection & { title: string; subtitle: string };
  scenario: Pick<Scenario, 'title' | 'caller' | 'skill' | 'difficulty'> | null;
  choices: Pick<Choice, 'id' | 'text'>[];
  messages: { role: 'caller' | 'learner'; text: string }[];
};
