import type { Skill, Action, Choice, Scenario, Detection, Decision, Exercise, Assessment, Trace, Coaching, State, Selection } from '../../shared/types';
export type { Skill, Action, Choice, Scenario, Detection, Decision, Exercise, Assessment, Trace, Coaching, State, Selection } from '../../shared/types';
export const SKILLS = ['authority', 'urgency', 'verification'] as const;
export const LABELS: Record<Skill, string> = { authority: 'Question authority', urgency: 'Resist urgency', verification: 'Verify independently' };
const scamChoices: Choice[] = [
  { id: 'verify', text: 'End this chat and contact them through a source I already trust.', action: 'verify' },
  { id: 'question', text: 'Ask for more details before deciding.', action: 'question' },
  { id: 'comply', text: 'Do what they ask so the problem is resolved quickly.', action: 'comply' },
];
const finalChoices: Choice[] = [
  { id: 'verify', text: 'Stop and verify through a trusted contact or official app.', action: 'verify' },
  { id: 'comply', text: 'Accept their explanation and follow the instructions.', action: 'comply' },
  { id: 'decline', text: 'End the conversation without sharing anything.', action: 'decline' },
];
export const CATALOG: Scenario[] = [
  { id: 'bank-1', title: 'The account alert', subtitle: 'An unexpected message from your bank.', caller: 'Northstar Bank · Account team', skill: 'authority', difficulty: 1, isScam: true,
    opening: "I'm with Northstar Bank's security team. We detected an unusual payment. Share the one-time code we just sent to stop it.",
    followup: 'I am an authorized bank specialist. Do not call your branch; they cannot help with this case. Share the one-time code here.',
    choices: scamChoices, finalChoices, lesson: 'A title is a claim, not proof. End the conversation and open your bank’s app or use a contact number you already trust.' },
  { id: 'bank-2', title: 'The security specialist', subtitle: 'A confident caller has a convincing story.', caller: 'Northstar Bank · Fraud support', skill: 'authority', difficulty: 2, isScam: true,
    opening: "This is the Northstar Bank fraud department. Your case is NS-204. To secure your account, transfer your balance to a safe account while we investigate.",
    followup: 'This is an official investigation. Keep this confidential and do not contact your branch. Transfer the money to the safe account now.',
    choices: scamChoices, finalChoices, lesson: 'Case numbers and official language can be invented. Independently contact the bank before moving money.' },
  { id: 'family-1', title: 'A message from family', subtitle: 'Someone you care about seems to need help.', caller: 'Unknown number · “Alex”', skill: 'urgency', difficulty: 1, isScam: true,
    opening: "It's Alex. My phone broke and I need money immediately for a ride. Send money now, please. Don't call me, I can't talk.",
    followup: "You only have five minutes. Don't tell anyone, just send money now. I'll explain later.",
    choices: scamChoices, finalChoices, lesson: 'Urgency is a reason to pause. Call your relative on their saved number or check with another trusted person before sending money.' },
  { id: 'family-2', title: 'The urgent favor', subtitle: 'A familiar story, an unfamiliar number.', caller: 'Unknown number · “Jamie”', skill: 'urgency', difficulty: 2, isScam: true,
    opening: "Hey, it's Jamie. Remember our weekend plans? Something happened and I need a gift card immediately. Send the gift card code in the next five minutes.",
    followup: "Please keep this secret. Don't call anyone else. Send the gift card code now and we can talk later.",
    choices: scamChoices, finalChoices, lesson: 'A familiar detail does not verify a person. Pause the payment and reach them through a separate, trusted channel.' },
  { id: 'delivery-1', title: 'The delivery detour', subtitle: 'A package update asks you to take action.', caller: 'ParcelPoint · Delivery notice', skill: 'verification', difficulty: 1, isScam: true,
    opening: 'Your ParcelPoint delivery is on hold. Use the link in this message to enter your password and pay a redelivery fee immediately.',
    followup: 'The link is the only way to release the package. Do not use the official app. Enter your password on our form.',
    choices: scamChoices, finalChoices, lesson: 'Open the delivery service’s official app yourself. A link supplied by the sender is not an independent way to verify their claim.' },
  { id: 'delivery-2', title: 'The helpful support agent', subtitle: 'A support agent offers to verify their own claim.', caller: 'ParcelPoint · Support', skill: 'verification', difficulty: 2, isScam: true,
    opening: 'I am from ParcelPoint support. Your delivery needs confirmation. To verify me, use the link in this message and enter your password on the confirmation form.',
    followup: 'Our verification form is secure. Do not use the official app for this request. Enter your password to continue.',
    choices: scamChoices, finalChoices, lesson: 'Verification must be independent. A website or number supplied by the same person can repeat the same false story.' },
  { id: 'service-control', title: 'The service reminder', subtitle: 'An ordinary request deserves a thoughtful response.', caller: 'Cedar Services · Appointment team', skill: 'verification', difficulty: 1, isScam: false,
    opening: 'A water leak means we need to reschedule your service appointment urgently. Open the official app yourself or call the number on your existing invoice to confirm. No payment or private information is needed in this chat.',
    followup: 'Of course. Please use your existing invoice or open the official app yourself. We can wait while you check independently.',
    choices: [ { id: 'verify', text: 'Check my existing invoice and contact the service independently.', action: 'verify' }, { id: 'question', text: 'Ask how I can confirm this appointment.', action: 'question' }, { id: 'decline', text: 'Ignore it because every urgent message must be a scam.', action: 'decline' } ],
    finalChoices: [ { id: 'verify', text: 'Use my existing invoice to verify, then reschedule if confirmed.', action: 'verify' }, { id: 'comply', text: 'Assume the sender is legitimate without checking.', action: 'comply' }, { id: 'decline', text: 'Ignore it without checking the appointment.', action: 'decline' } ],
    lesson: 'Urgency alone does not prove fraud. Verify through an independent source, then decide whether to act.' },
];
// The detector receives text only. It cannot read the scenario's known label.
export function detectScam(text: string): Detection {
  const rules: [string, RegExp, number][] = [
    ['Sensitive information requested', /(?:share|enter).{0,45}(?:one-time code|password)/i, 3],
    ['Money or gift cards requested', /(?:send money|transfer.{0,30}(?:balance|money)|send.{0,20}gift card code)/i, 3],
    ['Pressure to act quickly', /(?:immediately|five minutes|now)/i, 1],
    ['Independent verification discouraged', /(?:do not (?:call|contact|use)|don['’]t call)/i, 3],
    ['Secrecy requested', /(?:keep this (?:secret|confidential)|don['’]t tell anyone)/i, 2],
    ['Sender-supplied verification route', /use the link in this message/i, 2],
  ];
  let score = 0;
  const reasons: Detection['reasons'] = [];
  for (const [signal, pattern, weight] of rules) {
    const match = text.match(pattern);
    if (match) { score += weight; reasons.push({ signal, evidence: match[0] }); }
  }
  return { label: score >= 4 ? 'High risk' : score > 0 ? 'Some risk signals' : 'No strong signals', reasons, baseline: true };
}
export function initialState(): State { return { version: 1, scores: { authority: 50, urgency: 50, verification: 50 }, exercise: null, history: [], trace: [], coaching: { status: 'idle' }, revision: 0 }; }
export function scenarioById(id: string) { const scenario = CATALOG.find(s => s.id === id); if (!scenario) throw new Error('Unknown exercise.'); return scenario; }
export function selectNext(state: State): Selection {
  const last = state.history.at(-1);
  const min = Math.min(...SKILLS.map(s => state.scores[s]));
  const tied = SKILLS.filter(s => state.scores[s] === min);
  const skill = tied.find(s => s !== last?.skill) ?? tied[0];
  const lastForSkill = [...state.history].reverse().find(a => a.skill === skill);
  const difficulty = lastForSkill?.outcome === 'protective' ? 2 : 1;
  const scenario = CATALOG.find(s => s.skill === skill && s.difficulty === difficulty && s.isScam)!;
  const rationale = !last ? 'Start by practicing how to question a claim of authority.' : last.skill === skill && last.outcome !== 'protective'
    ? `${LABELS[skill]} needs another practice round. We’ll keep the pressure light and help you spot the next step.`
    : `${LABELS[skill]} is ${tied.length > 1 ? 'tied for your lowest practice score; we’re switching focus' : 'your lowest practice score'}. ${difficulty === 2 ? 'You handled this skill safely last time, so this version adds a little complexity.' : 'Let’s strengthen it with a short exercise.'}`;
  return { scenarioId: scenario.id, skill, rationale, difficulty };
}
export function startExercise(state: State, id: string, now: number, control = false): State {
  if (state.exercise?.status === 'active') throw new Error('Finish or exit the current exercise first.');
  const next = selectNext(state);
  return { ...state, revision: state.revision + 1, exercise: { id, scenarioId: control ? 'service-control' : next.scenarioId, status: 'active', decisions: [], startedAt: now, ...(state.coaching.status === 'live' && state.coaching.cue ? { cue: state.coaching.cue } : {}) }, coaching: { status: 'idle' }, trace: [{ tool: 'get_learner_profile', detail: 'Loaded saved practice scores.', source: 'application', status: 'ok' }, { tool: 'select_target_skill', detail: control ? 'Legitimate control requested.' : next.rationale, source: 'application', status: 'ok' }] };
}
export function availableChoices(exercise: Exercise): Choice[] { const s = scenarioById(exercise.scenarioId); return exercise.decisions.length === 0 ? s.choices : s.finalChoices; }
export function submitDecision(state: State, exerciseId: string, optionId: string, turn: number, now: number): State {
  const ex = state.exercise;
  if (!ex || ex.id !== exerciseId) throw new Error('This exercise is no longer current.');
  // Retries cannot score twice. A stale decision in an active exercise is rejected.
  if (ex.status === 'completed') return state;
  if (ex.status !== 'active' || turn !== ex.decisions.length) throw new Error('This choice is no longer available.');
  const choice = availableChoices(ex).find(c => c.id === optionId);
  if (!choice) throw new Error('Unknown choice.');
  const scenario = scenarioById(ex.scenarioId);
  const decisions = [...ex.decisions, { optionId, text: choice.text, action: choice.action, turn }];
  if (choice.action === 'question' && turn === 0) return { ...state, revision: state.revision + 1, exercise: { ...ex, decisions } };
  const outcome = choice.action === 'verify' || (choice.action === 'decline' && scenario.isScam) ? 'protective' : choice.action === 'comply' ? 'risky' : 'incomplete';
  const oldScore = state.scores[scenario.skill];
  const newScore = Math.max(0, Math.min(100, oldScore + (outcome === 'protective' ? 10 : outcome === 'risky' ? -10 : 0)));
  const content = scenario.opening + (turn > 0 ? '\n' + scenario.followup : '');
  const detection = detectScam(content);
  const feedback = (outcome === 'protective' ? 'You kept control of the next step. ' : outcome === 'risky' ? 'The request moved ahead before you independently checked it. ' : 'You avoided the request, but didn’t check whether it was genuine. ') + scenario.lesson;
  const result: Assessment = { exerciseId, scenarioId: scenario.id, skill: scenario.skill, outcome, oldScore, newScore, delta: newScore - oldScore, feedback, detection, completedAt: now };
  return { ...state, revision: state.revision + 1, scores: { ...state.scores, [scenario.skill]: newScore }, exercise: { ...ex, decisions, status: 'completed', completedAt: now }, history: [...state.history.slice(-49), result], trace: [...state.trace, { tool: 'classify_scam', detail: `${detection.label}; ${detection.reasons.length} textual signals. Demonstration baseline.`, source: 'application', status: 'ok' }, { tool: 'record_exercise_result', detail: `${outcome}: ${LABELS[scenario.skill]} ${oldScore} → ${newScore}`, source: 'application', status: 'ok' }] };
}
export function exitExercise(state: State): State { return state.exercise?.status === 'active' ? { ...state, revision: state.revision + 1, exercise: { ...state.exercise, status: 'exited' } } : state; }
