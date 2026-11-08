import assert from 'node:assert/strict';
import { DbConnection } from '../src/module_bindings';
import { selectNext, type State } from '../shared/training';

async function open(token?: string) {
  let sessionToken = '';
  const conn = await new Promise<DbConnection>((resolve, reject) => {
    DbConnection.builder().withUri('ws://127.0.0.1:3000').withDatabaseName('signal-school-local').withToken(token)
      .onConnect((c, _identity, t) => { sessionToken = t; resolve(c); })
      .onConnectError((_c, e) => reject(e)).build();
  });
  await new Promise<void>((resolve, reject) => conn.subscriptionBuilder().onApplied(() => resolve()).onError(() => reject(new Error('Subscription failed'))).subscribe('SELECT * FROM my_learner'));
  await conn.reducers.ensureLearner({});
  return { conn, token: sessionToken };
}
async function waitFor(conn: DbConnection, predicate: (state: State) => boolean) {
  for (let i = 0; i < 100; i++) {
    const row = [...conn.db.myLearner.iter()][0];
    if (row) { const state = JSON.parse(row.data) as State; if (predicate(state)) return state; }
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('Timed out waiting for saved state.');
}
const opened: DbConnection[] = [];
try {
  const a = await open(); opened.push(a.conn);
  await waitFor(a.conn, s => s.scores.authority === 50);
  await a.conn.reducers.start({ control: false });
  const active = await waitFor(a.conn, s => s.exercise?.status === 'active');
  const id = active.exercise!.id;
  await a.conn.reducers.decide({ exerciseId: id, optionId: 'comply', turn: 0 });
  const complete = await waitFor(a.conn, s => s.exercise?.status === 'completed');
  assert.equal(complete.scores.authority, 40);
  assert.equal(selectNext(complete).skill, 'authority');
  await a.conn.reducers.decide({ exerciseId: id, optionId: 'comply', turn: 0 });
  assert.equal((await waitFor(a.conn, s => s.history.length === 1)).scores.authority, 40);
  console.log('PASS: actual reducer scoring, adaptation, and idempotency');
  a.conn.disconnect();
  const resumed = await open(a.token); opened.push(resumed.conn);
  assert.equal((await waitFor(resumed.conn, s => s.history.length === 1)).scores.authority, 40);
  console.log('PASS: persisted identity/profile survives reconnection');
  const b = await open(); opened.push(b.conn);
  const fresh = await waitFor(b.conn, s => s.scores.authority === 50);
  assert.equal(fresh.history.length, 0);
  assert.equal([...b.conn.db.myLearner.iter()].length, 1);
  await assert.rejects(b.conn.reducers.decide({ exerciseId: id, optionId: 'verify', turn: 0 }));
  console.log('PASS: private learner view and cross-identity action rejection');
  if (process.argv.includes('--ai')) {
    const result = await resumed.conn.procedures.coach({ exerciseId: id });
    const coached = await waitFor(resumed.conn, s => ['live', 'unavailable'].includes(s.coaching.status));
    console.log('Coaching procedure:', result, coached.coaching.status, coached.coaching.error || '');
    assert.equal(coached.coaching.status, 'live');
    assert.equal(coached.trace.filter(t => t.source === 'nemotron' && t.status === 'ok').length, 4);
    console.log('PASS: live Nemotron called three real tools and persisted personalized feedback');
  }
  await resumed.conn.reducers.start({ control: false });
  const next = await waitFor(resumed.conn, s => s.exercise?.status === 'active');
  assert.equal(next.exercise!.scenarioId, selectNext(complete).scenarioId);
  console.log('PASS: next exercise uses saved weakness');
  await resumed.conn.reducers.reset({});
  await b.conn.reducers.reset({});
} finally { opened.forEach(c => c.disconnect()); }
