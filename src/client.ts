import { DbConnection } from './module_bindings';
import type { TrainingView } from '../shared/types';
export type Mode = 'connecting' | 'spacetime' | 'disconnected';
export type Snapshot = { state: TrainingView | null; mode: Mode; error: string | null };
const uri = import.meta.env.VITE_SPACETIME_URI || (['localhost', '127.0.0.1'].includes(location.hostname) ? 'ws://127.0.0.1:3000' : '');
const database = import.meta.env.VITE_SPACETIME_DATABASE || 'signal-school-local';
const tokenKey = `signal-school-token:${uri}:${database}`;
let connection: DbConnection | null = null;
let generation = 0;
let snapshot: Snapshot = { state: null, mode: uri ? 'connecting' : 'disconnected', error: null };
const listeners = new Set<() => void>();
function emit(next: Snapshot) { snapshot = next; listeners.forEach(fn => fn()); }
function storageRead(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
export function connect() {
  if (!uri) { emit({ state: null, mode: 'disconnected', error: 'This site is not connected to a training server yet. Training requires SpacetimeDB.' }); return; }
  if (connection) return;
  const current = ++generation;
  let storageWarning: string | null = null;
  const fail = (message: string) => { if (current === generation) emit({ ...snapshot, mode: 'disconnected', error: message }); };
  connection = DbConnection.builder().withUri(uri).withDatabaseName(database).withToken(storageRead(tokenKey) || undefined).withAutomaticReconnect()
    .onConnect((conn, _identity, token) => {
      if (current !== generation) return;
      try { localStorage.setItem(tokenKey, token); } catch { storageWarning = 'Browser storage is unavailable. Your identity may not survive refresh.'; }
      const refresh = () => {
        if (current !== generation) return;
        const row = [...conn.db.myLearner.iter()][0];
        if (row) {
          const state = JSON.parse(row.data) as TrainingView;
          if (!state.next || !Array.isArray(state.choices) || !Array.isArray(state.messages)) {
            fail('The training server needs an update. Publish the current backend, then reconnect.'); return;
          }
          emit({ state, mode: 'spacetime', error: storageWarning });
        }
      };
      conn.db.myLearner.onInsert(refresh);
      conn.db.myLearner.onDelete(refresh);
      conn.db.myLearner.onUpdate(refresh);
      conn.subscriptionBuilder().onApplied(() => {
        refresh();
        conn.reducers.ensureLearner({}).catch(() => fail('Could not load your saved profile. Please reconnect.'));
      }).onError(() => fail('Could not subscribe to your saved profile. Please reconnect.')).subscribe('SELECT * FROM my_learner');
    })
    .onConnectError(() => fail('Could not reach the training server. Start SpacetimeDB, then reconnect.'))
    .onDisconnect(() => fail('Connection interrupted. Your saved progress is preserved on the server. Reconnecting…'))
    .build();
}
function connected() {
  if (snapshot.mode !== 'spacetime' || !connection) throw new Error('Training requires a connection to the server. Please reconnect.');
  return connection;
}
export const store = {
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getSnapshot: () => snapshot,
  async start(control = false) { await connected().reducers.start({ control }); },
  async decide(optionId: string) {
    const conn = connected();
    const exercise = snapshot.state?.exercise;
    if (!exercise) throw new Error('Start an exercise first.');
    await conn.reducers.decide({ exerciseId: exercise.id, optionId, turn: exercise.decisions.length });
  },
  async exit() { await connected().reducers.exit({}); },
  async reset() { await connected().reducers.reset({}); },
  async coach() {
    const conn = connected();
    if (snapshot.state?.exercise) await conn.procedures.coach({ exerciseId: snapshot.state.exercise.id });
  },
  reconnect() {
    generation++;
    connection?.disconnect(); connection = null;
    emit({ ...snapshot, mode: 'connecting', error: null });
    connect();
  },
};
