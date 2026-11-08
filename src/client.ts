import { DbConnection } from './module_bindings';
import { initialState, startExercise, submitDecision, exitExercise, type State } from '../shared/training';
export type Mode = 'connecting' | 'spacetime' | 'browser' | 'disconnected';
export type Snapshot = { state: State; mode: Mode; error: string | null };
const LOCAL_KEY = 'signal-school-practice-v1';
const uri = import.meta.env.VITE_SPACETIME_URI || (['localhost', '127.0.0.1'].includes(location.hostname) ? 'ws://127.0.0.1:3000' : '');
const database = import.meta.env.VITE_SPACETIME_DATABASE || 'signal-school-local';
const tokenKey = `signal-school-token:${uri}:${database}`;
let connection: DbConnection | null = null;
let snapshot: Snapshot = { state: initialState(), mode: uri ? 'connecting' : 'browser', error: null };
const listeners = new Set<() => void>();
function emit(next: Snapshot) { snapshot = next; listeners.forEach(fn => fn()); }
function storageRead(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function storageWrite(key: string, value: string) { localStorage.setItem(key, value); }
function browserState(): State {
  try {
    const saved = JSON.parse(storageRead(LOCAL_KEY) || 'null');
    if (saved?.version === 1 && saved.scores && Array.isArray(saved.history) && Array.isArray(saved.trace)) return saved;
  } catch { /* Invalid local preview data is discarded. */ }
  return initialState();
}
export function connect() {
  if (!uri) { emit({ state: browserState(), mode: 'browser', error: null }); return; }
  if (connection) return;
  connection = DbConnection.builder().withUri(uri).withDatabaseName(database).withToken(storageRead(tokenKey) || undefined).withAutomaticReconnect()
    .onConnect((conn, _identity, token) => {
      try { storageWrite(tokenKey, token); } catch { emit({ ...snapshot, error: 'Browser storage is unavailable. Your identity may not survive refresh.' }); }
      const refresh = () => {
        const row = [...conn.db.myLearner.iter()][0];
        if (row) emit({ state: JSON.parse(row.data), mode: 'spacetime', error: null });
      };
      conn.db.myLearner.onInsert(refresh);
      conn.db.myLearner.onDelete(refresh);
      conn.db.myLearner.onUpdate(refresh);
      conn.subscriptionBuilder().onApplied(() => { refresh(); conn.reducers.ensureLearner({}).catch(report); }).onError(() => report(new Error('Could not subscribe to your saved profile.'))).subscribe('SELECT * FROM my_learner');
    })
    .onConnectError(() => emit({ ...snapshot, mode: 'disconnected', error: 'Could not reach the training server. Start SpacetimeDB, then reconnect, or choose browser practice.' }))
    .onDisconnect(() => emit({ ...snapshot, mode: 'disconnected', error: 'Connection interrupted. Your saved server progress is preserved. Reconnecting…' }))
    .build();
}
function report(error: unknown) { emit({ ...snapshot, error: error instanceof Error ? error.message : 'Something went wrong. Please try again.' }); }
function localChange(state: State) { storageWrite(LOCAL_KEY, JSON.stringify(state)); emit({ state, mode: 'browser', error: null }); }
export const store = {
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getSnapshot: () => snapshot,
  async start(control = false) {
    if (snapshot.mode === 'browser') localChange(startExercise(snapshot.state, crypto.randomUUID(), Date.now(), control));
    else if (snapshot.mode === 'spacetime' && connection) await connection.reducers.start({ control });
    else throw new Error('Connect to the server or choose browser practice first.');
  },
  async decide(optionId: string) {
    const exercise = snapshot.state.exercise;
    if (!exercise) return;
    if (snapshot.mode === 'browser') localChange(submitDecision(snapshot.state, exercise.id, optionId, exercise.decisions.length, Date.now()));
    else if (snapshot.mode === 'spacetime' && connection) await connection.reducers.decide({ exerciseId: exercise.id, optionId, turn: exercise.decisions.length });
    else throw new Error('The server is disconnected. Please wait before submitting your choice.');
  },
  async exit() {
    if (snapshot.mode === 'browser') localChange(exitExercise(snapshot.state));
    else if (snapshot.mode === 'spacetime' && connection) await connection.reducers.exit({});
    else throw new Error('Reconnect to exit the saved exercise.');
  },
  async reset() {
    if (snapshot.mode === 'browser') localChange(initialState());
    else if (snapshot.mode === 'spacetime' && connection) await connection.reducers.reset({});
    else throw new Error('Reconnect before resetting progress.');
  },
  async coach() {
    if (snapshot.mode === 'spacetime' && connection && snapshot.state.exercise) await connection.procedures.coach({ exerciseId: snapshot.state.exercise.id });
  },
  browserPractice() { connection?.disconnect(); connection = null; emit({ state: browserState(), mode: 'browser', error: null }); },
  reconnect() { connection?.disconnect(); connection = null; emit({ ...snapshot, mode: 'connecting', error: null }); connect(); },
};
