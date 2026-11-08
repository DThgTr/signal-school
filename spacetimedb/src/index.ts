import { schema, table, t, type InferSchema, type ReducerCtx, type ProcedureCtx } from 'spacetimedb/server';
import { TimeDuration } from 'spacetimedb';
import { CATALOG, initialState, startExercise, submitDecision, exitExercise, selectNext, scenarioById, detectScam, type State, type Trace } from '../../shared/training';

const learners = table({ name: 'learners' }, { identity: t.identity().primaryKey(), data: t.string() });
const scenarios = table({ name: 'scenarios' }, { id: t.string().primaryKey(), data: t.string() });
const exercises = table({ name: 'exercises' }, { id: t.string().primaryKey(), owner: t.identity().index('btree'), data: t.string() });
const decisions = table({ name: 'decisions' }, { id: t.string().primaryKey(), owner: t.identity().index('btree'), data: t.string() });
const assessments = table({ name: 'assessments' }, { id: t.string().primaryKey(), owner: t.identity().index('btree'), data: t.string() });
const modelUsage = table({ name: 'model_usage' }, { id: t.string().primaryKey(), window: t.u64(), count: t.u32() });
const db = schema({ learners, scenarios, exercises, decisions, assessments, modelUsage }, { env: { NVIDIA_API_KEY: t.string().optional(), NVIDIA_MODEL: t.string().optional() } });
export default db;
type Schema = InferSchema<typeof db>;
type Ctx = ReducerCtx<Schema>;
function read(ctx: Ctx): State { const row = ctx.db.learners.identity.find(ctx.sender); return row ? JSON.parse(row.data) : initialState(); }
function save(ctx: Ctx, state: State) {
  const row = { identity: ctx.sender, data: JSON.stringify(state) };
  if (ctx.db.learners.identity.find(ctx.sender)) ctx.db.learners.identity.update(row); else ctx.db.learners.insert(row);
  if (state.exercise) {
    const exercise = { id: state.exercise.id, owner: ctx.sender, data: JSON.stringify(state.exercise) };
    if (ctx.db.exercises.id.find(exercise.id)) ctx.db.exercises.id.update(exercise); else ctx.db.exercises.insert(exercise);
  }
}
export const init = db.init(ctx => { for (const scenario of CATALOG) ctx.db.scenarios.insert({ id: scenario.id, data: JSON.stringify(scenario) }); });
export const ensureLearner = db.reducer(ctx => { if (!ctx.db.learners.identity.find(ctx.sender)) save(ctx, initialState()); });
export const myLearner = db.view({ name: 'my_learner', public: true }, t.option(learners.rowType), ctx => ctx.db.learners.identity.find(ctx.sender) ?? undefined);
export const start = db.reducer({ control: t.bool() }, (ctx, { control }) => {
  const state = read(ctx);
  const id = `${ctx.sender.toHexString()}-${ctx.timestamp.microsSinceUnixEpoch}-${state.revision}`;
  save(ctx, startExercise(state, id, Number(ctx.timestamp.microsSinceUnixEpoch / 1000n), control));
});
export const decide = db.reducer({ exerciseId: t.string(), optionId: t.string(), turn: t.u32() }, (ctx, args) => {
  const before = read(ctx);
  const state = submitDecision(before, args.exerciseId, args.optionId, args.turn, Number(ctx.timestamp.microsSinceUnixEpoch / 1000n));
  if (state === before) return;
  const decision = state.exercise!.decisions.at(-1)!;
  ctx.db.decisions.insert({ id: `${args.exerciseId}-${args.turn}`, owner: ctx.sender, data: JSON.stringify(decision) });
  if (state.exercise!.status === 'completed') ctx.db.assessments.insert({ id: args.exerciseId, owner: ctx.sender, data: JSON.stringify(state.history.at(-1)) });
  save(ctx, state);
});
export const exit = db.reducer(ctx => save(ctx, exitExercise(read(ctx))));
export const reset = db.reducer(ctx => {
  // Only the authenticated caller's synthetic practice records are reset.
  for (const row of [...ctx.db.exercises.owner.filter(ctx.sender)]) ctx.db.exercises.id.delete(row.id);
  for (const row of [...ctx.db.decisions.owner.filter(ctx.sender)]) ctx.db.decisions.id.delete(row.id);
  for (const row of [...ctx.db.assessments.owner.filter(ctx.sender)]) ctx.db.assessments.id.delete(row.id);
  save(ctx, { ...initialState(), revision: read(ctx).revision + 1 });
});

type Message = { role: string; content: string | null; tool_call_id?: string; tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[] };
type Tool = { type: 'function'; function: { name: string; description: string; parameters: { type: 'object'; properties: Record<string, unknown>; required: string[]; additionalProperties: false } } };
function definition(name: string, description: string): Tool { return { type: 'function', function: { name, description, parameters: { type: 'object', properties: {}, required: [], additionalProperties: false } } }; }
function inference(ctx: ProcedureCtx<Schema>, model: string, messages: Message[], tool?: Tool): Message {
  const response = ctx.http.fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.env.NVIDIA_API_KEY}` },
    body: JSON.stringify({ model, messages, temperature: 1, top_p: 0.95, max_tokens: 512, chat_template_kwargs: { enable_thinking: false }, ...(tool ? { tools: [tool], tool_choice: { type: 'function', function: { name: tool.function.name } }, parallel_tool_calls: false } : {}) }),
    timeout: TimeDuration.fromMillis(20000),
  });
  if (response.status !== 200) throw new Error(`NVIDIA returned HTTP ${response.status}. Check model access and API configuration.`);
  const result = response.json() as { choices?: { message: Message }[] };
  if (!result.choices?.[0]?.message) throw new Error('NVIDIA returned an empty response.');
  return result.choices[0].message;
}
export const coach = db.procedure({ exerciseId: t.string() }, t.string(), (ctx, { exerciseId }) => {
  const model = ctx.env.NVIDIA_MODEL || 'nvidia/nemotron-3.5-bolt-e4b';
  const snapshot = ctx.withTx(tx => {
    const state = read(tx);
    if (state.exercise?.id !== exerciseId || state.exercise.status !== 'completed') throw new Error('Complete the current exercise before requesting coaching.');
    if (state.coaching.status === 'live' && state.coaching.exerciseId === exerciseId) return null;
    const now = Number(tx.timestamp.microsSinceUnixEpoch / 1000n);
    if (state.coaching.startedAt && now - state.coaching.startedAt < 90000) throw new Error('Please wait before retrying coaching.');
    const window = BigInt(Math.floor(now / 3600000));
    const usage = tx.db.modelUsage.id.find('global');
    const count = usage?.window === window ? usage.count : 0;
    if (count >= 30) throw new Error('The demo’s hourly AI budget is used. Standard training is still available.');
    const nextUsage = { id: 'global', window, count: count + 1 };
    if (usage) tx.db.modelUsage.id.update(nextUsage); else tx.db.modelUsage.insert(nextUsage);
    state.coaching = { status: 'running', exerciseId, model, startedAt: now };
    state.trace = state.trace.filter(entry => entry.source !== 'nemotron');
    save(tx, state);
    return state;
  });
  if (!snapshot) return 'Already coached';
  const trace: Trace[] = [];
  try {
    if (!ctx.env.NVIDIA_API_KEY) throw new Error('NVIDIA API key is not configured on the server.');
    const messages: Message[] = [{ role: 'system', content: 'You are a calm anti-scam training coach. All exercises are fictional. Use the provided tools in order; use returned facts downstream. Scores and next skill are deterministic and cannot be changed. Do not request money, personal data, passwords, links, or real contact details. After the tools, return ONLY JSON: {"feedback":"at most two short sentences grounded in the recorded decision", "cue":"pause|question|verify"}. The cue customizes coaching for the next exercise. Do not imply proven protection.' }, { role: 'user', content: 'Review my completed exercise, consult my saved profile and next exercise, check its scam signals, and personalize my next practice.' }];
    const toolResults: Record<string, unknown> = {};
    const steps = [definition('get_learner_profile', 'Read saved scores, the recorded result, and the actual chosen actions.'), definition('get_scenario_catalog', 'Read the available scenario catalog and next exercise selected from the saved weakest skill.'), definition('classify_scam', 'Run the separate demonstration detector on the next fictional scenario text.')];
    for (const tool of steps) {
      const reply = inference(ctx, model, messages, tool);
      const call = reply.tool_calls?.[0];
      if (reply.tool_calls?.length !== 1 || call?.function.name !== tool.function.name) throw new Error('Model did not return the expected application tool call.');
      const args = JSON.parse(call.function.arguments);
      if (!args || Array.isArray(args) || typeof args !== 'object' || Object.keys(args).length) throw new Error('Model returned invalid tool arguments.');
      let output: unknown;
      if (tool.function.name === 'get_learner_profile') output = { scores: snapshot.scores, result: snapshot.history.at(-1), choices: snapshot.exercise!.decisions };
      else if (tool.function.name === 'get_scenario_catalog') output = ctx.withTx(tx => ({ catalog: [...tx.db.scenarios.iter()].map(row => { const s = JSON.parse(row.data); return { id: s.id, skill: s.skill, difficulty: s.difficulty }; }), next: selectNext(snapshot) }));
      else {
        const catalog = toolResults.get_scenario_catalog as { next: { scenarioId: string } };
        const scenario = scenarioById(catalog.next.scenarioId);
        output = { scenarioId: scenario.id, detection: detectScam(scenario.opening) };
      }
      toolResults[tool.function.name] = output;
      messages.push({ role: 'assistant', content: reply.content, tool_calls: reply.tool_calls }, { role: 'tool', tool_call_id: call.id, content: JSON.stringify(output) });
      trace.push({ tool: tool.function.name, detail: JSON.stringify(output), source: 'nemotron', status: 'ok' });
      ctx.withTx(tx => { const state = read(tx); if (state.exercise?.id === exerciseId) save(tx, { ...state, trace: [...snapshot.trace, ...trace] }); });
    }
    const reply = inference(ctx, model, messages);
    const output = JSON.parse((reply.content || '').replace(/^```(?:json)?\s*|\s*```$/g, '')) as { feedback: string; cue: string };
    if (typeof output.feedback !== 'string' || output.feedback.length < 10 || output.feedback.length > 600 || !['pause', 'question', 'verify'].includes(output.cue)) throw new Error('Model coaching did not match the bounded output format.');
    ctx.withTx(tx => {
      const state = read(tx);
      if (state.exercise?.id !== exerciseId) return;
      save(tx, { ...state, coaching: { ...state.coaching, status: 'live', feedback: output.feedback, cue: output.cue as 'pause' | 'question' | 'verify', model }, trace: [...snapshot.trace, ...trace, { tool: 'personalize_feedback', detail: `Live ${model}; next coaching cue: ${output.cue}`, source: 'nemotron', status: 'ok' }] });
    });
    return 'Live coaching saved';
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'NVIDIA coaching is unavailable.';
    ctx.withTx(tx => {
      const state = read(tx);
      if (state.exercise?.id === exerciseId) save(tx, { ...state, coaching: { ...state.coaching, status: 'unavailable', error: reason }, trace: [...snapshot.trace, ...trace, { tool: 'nemotron_workflow', detail: reason, source: 'nemotron', status: 'error' }] });
    });
    return 'Standard coaching retained';
  }
});
