# Signal School

A short, fictional anti-scam training loop: choose a response, see the signals, save a practice score, and get an exercise adapted to your weakest skill.

Built for the HackUTD adaptive anti-scam MVP. Six scam exercises cover authority, urgency, and independent verification at two difficulties; a legitimate control tests verification without teaching blanket suspicion.

## Run the complete local demo

Prerequisites: Node.js compatible with SpacetimeDB 2.14.1 (`^22.23.4`, `^24.22.1`, or `>=26.12.1`), npm, and the [SpacetimeDB CLI](https://spacetimedb.com/install). The development machine’s Node 24.15.0 completed all checks but produces an SDK engine warning; use a supported version for a fresh installation. Windows binaries already downloaded in this workspace are ignored under `.tools/spacetime/`. Other installations use `spacetime` on PATH.

```powershell
npm ci
npm ci --prefix spacetimedb
# If .env.local does not already exist, copy .env.example to .env.local.
# Set NVIDIA_API_KEY in .env.local. Keep it out of Git.
npm run db:start
```

Leave the database terminal running. In a second terminal:

```powershell
npm run db:publish
npm run dev
```

Open **http://127.0.0.1:5173/**. Publishing loads the key into SpacetimeDB's server-only environment; it never reaches Vite's client bundle. Default model: `nvidia/nemotron-3.5-bolt-e4b`, verified with actual tool calls on November 8, 2026. Older Super/Nano free endpoints returned account/function 404s; the API model list alone does not guarantee callable endpoints.

Database data, local identity credentials, and signing keys are under ignored `.runtime/spacetime/`. Preserve that directory to preserve the local database. The browser retains its own anonymous identity token to reload the same profile; clearing browser storage starts a new learner. No login UI is needed.

## Architecture

```text
React + Vite UI
  → official generated SpacetimeDB SDK bindings
  → private tables: learners / scenarios / exercises / decisions / assessments
  → sender-scoped my_learner view
  → transactional reducers: start / decide / exit / reset
  → coach procedure → NVIDIA Nemotron Bolt API
```

All scenarios, scoring, session progression, detector invocation, and adaptation live in `spacetimedb/src/training.ts` and execute only on the backend. `spacetimedb/src/presentation.ts` prepares the current messages, legal choices, and next-exercise explanation for the UI. Backend-owned contracts live in `spacetimedb/src/types.ts`; the frontend imports them as types only. The backend folder is self-contained. The frontend renders server data and submits actions; it cannot run training offline. There is no second API backend.

The app uses structured response buttons. Asking for details opens a second decision; protective or risky choices end the exercise immediately. A protective choice adds 10 to one target skill, a risky one subtracts 10, and refusal without verification in the legitimate control changes nothing. Scores clamp to 0–100. Repeated submissions cannot double-score. Exit does not score.

Selection prioritizes the lowest saved score, rotates away from the previous skill on ties where possible, then chooses difficulty based on the most recent result for the selected skill. A successful but still-weak skill stays selected with greater complexity. The UI explains the choice. The profile retains its latest 50 assessments; complete per-exercise records remain in private tables until reset.

The separate text-only detector does not receive the scenario's known scam label. It matches explicit patterns for sensitive requests, money, urgency, secrecy, blocked verification, and sender-supplied links. Results include matched evidence and uncertainty. It is a demonstration baseline with limited language coverage, not a calibrated fraud detector or a T-Mobile model.

## Real Nemotron workflow

After the reducer has saved the completed result, the client requests the `coach` procedure. Four bounded model requests run outside transactions:

1. The model returns a `get_learner_profile` tool call. The application returns stored scores, the actual decisions, and the deterministic result.
2. The model sees that result and calls `get_scenario_catalog`. The application reads the stored catalog and returns the deterministic next selection.
3. The model calls `classify_scam`. The application uses the preceding selection to run the text-only detector on that next scenario.
4. The model consumes the returned evidence and calls `personalize_feedback` with short personalized feedback and a bounded coaching cue (`pause`, `question`, or `verify`). The tool schema enumerates allowed cues; the server validates and saves the result. The cue carries into the next exercise.

The model cannot modify scores or select an unsupported scenario. Real calls and outputs are shown in the expandable trace. Standard guidance remains available during errors; it is never labeled as live AI. There are at most four model requests per coaching attempt, 512 output tokens per request, a 20-second HTTP timeout per request, a 90-second per-exercise retry cooldown, and a global cap of 30 workflows per hour. Reset does not clear the global quota. AI completion is discarded if the learner has moved on to another exercise.

## Verification

```powershell
npm test
npm run check:server
npm run build
npm run probe:nvidia
npm run test:integration -- --ai
npm run test:browser
```

Local integration and browser tests require the published local database; the browser test also requires Vite on port 5173 and installed Microsoft Edge. For Maincloud, use `npm run test:cloud`, then `npm run build:cloud` and `npm run test:browser -- --cloud`. The cloud browser test serves the exact production artifact and connects to the real Maincloud backend. Tests use fresh synthetic identities and make live NVIDIA calls. Unit tests check adaptation, detector control behavior, clamping, stale decisions, duplicate submissions, exit, coaching timeout recovery, and stale AI attempts. Integration checks cover persistence across reconnection and isolation between learner identities. Browser checks cover desktop/mobile layouts, two-turn decisions, refresh, live AI, adaptation, the legitimate control, reset, and refusal to train without a backend. Local screenshots are stored under ignored `.runtime/screenshots/`.

After changing the module schema, run `npm run db:generate`. Generated bindings are committed source, not hand-maintained stubs.

## Hosting and provisioning

The backend is deployed to [SpacetimeDB Maincloud](https://spacetimedb.com/signal-school-fraud-prep-2026). The [private website](https://signal-school-fraud-prep.breezy-tide-1043.chatgpt.site) connects directly to it. Your laptop does not need to run a server. NVIDIA requests originate in the Maincloud procedure, and its key is stored only in the server environment.

`deployments.json` names separate local and cloud targets. `npm run dev` uses localhost; `npm run build` (also `build:cloud`) embeds the Maincloud target even if development environment overrides exist. `npm run build:local` produces a development-target build. To deploy backend changes:

```powershell
# Once per machine/account, using this project's isolated CLI configuration:
node scripts/spacetime.mjs login
npm run db:publish:cloud
npm run test:cloud
npm run build:cloud
```

Cloud publishing requires `NVIDIA_API_KEY` in `.env.local`, type-checks the backend, and refuses destructive data replacement. `npm run db:publish:local` explicitly targets the local server; `db:publish` is its compatibility alias. Frontend changes must also be republished through the existing private Sites project. Local `.env.local` edits do not update Maincloud until publishing again.

Interrupted coaching expires after two minutes via a scheduled reducer and is also recovered on reconnect. Attempt IDs prevent late responses from overwriting retries or newer exercises. The active scenario catalog synchronizes on connection/start/coaching after module updates. Existing in-flight exercises use the current compiled scenario definitions, so preserve scenario IDs/choice IDs when deploying catalog changes during a demo.

There is a per-identity cap of 10 coaching workflows/hour and a global default cap of 30 (configurable with server-only `AI_HOURLY_LIMIT`). Reset does not clear either quota. The Maincloud API accepts anonymous learners; the private website gate does not make the database endpoint owner-only. Sender-scoped data isolation protects profiles, while anonymous identity rotation can still exhaust the shared AI budget. Public release would need stronger user admission/rate limiting.

A disconnected client cannot start, score, or advance an exercise. The browser stores only its identity token; saved training progress belongs to SpacetimeDB. Legacy browser-only progress is ignored. Local identities and practice history are separate from Maincloud; no local data was migrated.

No T-Mobile sample files or supplied classifier were available in the workspace. If supplied, replace the backend text-only detector behind the existing `detectScam(text)` boundary, preserve uncertainty, and test legitimate controls. No other third-party infrastructure is necessary.

## Demo (about 90 seconds)

1. Reset practice to 50/50/50. Start the account alert.
2. Choose to comply. See the high-risk signals and authority score fall to 40.
3. Show the adapted exercise explanation; the same weak skill gets a gentle repeat.
4. Show “LIVE NEMOTRON” and expand the actual tool trace.
5. Complete a protective response, then show the skill switch when scores tie.
6. From home, try the legitimate request and independently verify; the detector withholds a strong scam flag.

## Sponsor evidence and limits

| Track | Implemented evidence | Limits |
| --- | --- | --- |
| T-Mobile Safe Signal | Real detector invocation, synthetic scam/control scenarios, explicit safer actions, uncertainty | Demonstration rules only; no supplied sponsor classifier |
| NVIDIA Nemotron | Actual Bolt inference, three sequential tool calls with returned results used downstream, persisted personalized coaching | Free API availability/rate limits; fallback clearly labeled |
| Spacetime | Maincloud-hosted training logic, private data, transactions, views, timeout recovery, and outbound AI procedure | Anonymous demo identities; shared AI budget and hosting availability |

This is training practice, not validated fraud prevention. No real messages, calls, payments, or customer data are used. API keys, browser identity tokens, and server signing keys must remain private. The Sites source repository is separate from the GitHub `origin`; public GitHub publication and submission are not performed automatically.

Official references: [HackUTD challenges](https://zeroday.hackutd.co/), [Spacetime AI procedure guide](https://spacetimedb.com/docs/how-to/app-patterns/call-ai-model/), [Nemotron Bolt endpoint](https://build.nvidia.com/nvidia/nemotron-3.5-bolt-e4b).
