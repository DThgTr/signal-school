import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowUpRight, ArrowRight, ArrowLeft, ShieldCheck, Fingerprint, Clock3, Check, X, Sparkles, Radio, LockKeyhole, MessageCircle, ChevronDown, RotateCcw, Terminal, CircleHelp, CheckCircle2, AlertTriangle, Pause, Search, PhoneOff, LoaderCircle } from 'lucide-react';
import { store, type Snapshot } from './client';
import type { Skill, TrainingView } from '../spacetimedb/src/types';
import { SKILLS, LABELS } from './presentation';

const icons = { authority: ShieldCheck, urgency: Clock3, verification: Fingerprint };
const descriptions: Record<Skill, string> = { authority: 'A convincing title isn’t proof.', urgency: 'Make space for a better decision.', verification: 'Check through a source you trust.' };
const cues = { pause: 'Take a breath. You get to set the pace.', question: 'A confident claim is still just a claim.', verify: 'Choose a way to check that the sender doesn’t control.' };

export function App() {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  if (!snapshot.state) return <div className="app-shell"><header className="topbar"><span className="brand">signalschool.</span></header><main><section className="session-title"><h1>{snapshot.mode === 'connecting' ? 'Connecting to training…' : 'Training server unavailable'}</h1><p role="status">{snapshot.error || 'Loading your saved practice from SpacetimeDB.'}</p><button className="primary" disabled={snapshot.mode === 'connecting'} onClick={store.reconnect}>Reconnect</button></section></main></div>;
  return <TrainingApp {...snapshot} state={snapshot.state}/>;
}
function TrainingApp({ state, mode, error }: Snapshot & { state: TrainingView }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [showHow, setShowHow] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [home, setHome] = useState(false);
  const next = state.next;
  const ex = state.exercise;
  const scenario = state.scenario;
  const result = ex?.status === 'completed' ? state.history.find(h => h.exerciseId === ex.id) : null;
  const screen = home || !ex || ex.status === 'exited' ? 'home' : ex.status === 'active' ? 'exercise' : 'result';
  const heading = useRef<HTMLHeadingElement>(null);
  const askedForCoaching = useRef<string | null>(null);
  const operational = mode === 'spacetime';
  useEffect(() => { heading.current?.focus(); }, [screen]);
  useEffect(() => {
    if (!showHow && !resetOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setShowHow(false); setResetOpen(false); }
      if (event.key === 'Tab') {
        const buttons = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button:not(:disabled)')];
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [showHow, resetOpen]);
  useEffect(() => {
    if (mode === 'spacetime' && ex?.status === 'completed' && state.coaching.status === 'idle' && askedForCoaching.current !== ex.id) {
      askedForCoaching.current = ex.id;
      store.coach().catch(() => setNotice('AI coaching is unavailable. Your result and next exercise are saved.'));
    }
  }, [ex?.id, ex?.status, mode, state.coaching.status]);
  async function act(action: () => Promise<void>) {
    setBusy(true); setNotice('');
    try { await action(); } catch (e) { setNotice(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  const start = (control = false) => act(async () => { await store.start(control); setHome(false); });
  const NextIcon = icons[next.skill];
  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setHome(true)} aria-label="Signal School home"><span className="brand-symbol"><ShieldCheck size={23} strokeWidth={1.8}/></span>signal<span className="brand-light">school</span><span className="brand-period">.</span></button>
      <nav aria-label="Main navigation"><span className="nav-current">Your practice</span><button onClick={() => setShowHow(true)}>How it works <ArrowUpRight size={14}/></button></nav>
      <span className="safe-label"><span className="status-dot"/>A safe space to learn</span>
    </header>
    <main>
      {(error || notice) && <div className="notice" role="alert"><AlertTriangle size={18}/><span>{notice || error}</span>{mode === 'disconnected' && <><button onClick={store.reconnect}>Reconnect</button></>}</div>}
      {screen === 'home' && <>
        <section className="hero">
          <div className="hero-copy"><p className="eyebrow"><span className="short-line"/> BUILD YOUR SCAM-SPOTTING INSTINCTS</p><h1 tabIndex={-1} ref={heading}>A little practice.<br/><span>A stronger instinct.</span></h1><p className="hero-description">The best time to spot a scam is before it happens.<br className="desktop-break"/> Practice real-world situations in a safe, fictional conversation.</p><div className="hero-notes"><span><Clock3 size={15}/> About 2 minutes</span><span><LockKeyhole size={15}/> No personal details</span></div></div>
          <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><span className="orbit-point point-one"/><span className="orbit-point point-two"/><div className="message-preview"><div className="preview-header"><span className="avatar-small"><MessageCircle size={19}/></span><span>Unknown sender<small>FICTIONAL CONVERSATION</small></span><span className="preview-dots">•••</span></div><div className="preview-bubble">“It’s urgent. I need you to<br/>send the money right now.”</div><div className="preview-reply"><Pause size={15}/> Let me check first.</div></div><div className="instinct-tag"><ShieldCheck size={19}/><span>Your pause is your power.</span></div><span className="art-spark">✳</span></div>
        </section>
        <section className="practice-layout">
          <div className="next-card"><div className="section-kicker"><span><span className="status-dot"/>{state.history.length ? 'CHOSEN FOR YOUR NEXT STEP' : 'YOUR FIRST PRACTICE'}</span><span className="pill">{next.difficulty === 1 ? 'Gentle start' : 'A little more challenge'}</span></div><div className="next-card-body"><div className="scenario-icon"><NextIcon size={30} strokeWidth={1.5}/></div><div><h2>{ex?.status === 'active' ? 'Pick up where you left off' : next.title}</h2><p>{ex?.status === 'active' ? 'Your conversation is saved and ready when you are.' : next.subtitle}</p></div></div><div className="next-card-bottom"><span><MessageCircle size={15}/> Interactive conversation <span className="separator">·</span> {LABELS[next.skill]}</span><button className="primary" disabled={busy || !operational} onClick={() => ex?.status === 'active' ? setHome(false) : start()}>{mode === 'connecting' ? 'Connecting…' : ex?.status === 'active' ? 'Resume exercise' : 'Start training'}{busy ? <LoaderCircle className="spin" size={18}/> : <ArrowRight size={18}/>}</button></div>{state.history.length > 0 && <p className="adaptation-note"><Sparkles size={15}/>{next.rationale}</p>}</div>
          <aside className="reassurance-card"><span className="mini-label">PRACTICE, WITHOUT THE PRESSURE</span><h3>It’s okay to get it wrong.</h3><p>Try a response, see the signals you missed, and build your confidence one decision at a time.</p><div><ShieldCheck size={17}/><span>Always fictional. Always in your control.</span></div></aside>
        </section>
        <section className="skills-section"><div className="section-heading"><div><h2>Your practice toolkit</h2><p>Three small habits. A more thoughtful response.</p></div><span className="small-muted">{state.history.length} exercise{state.history.length !== 1 ? 's' : ''} completed</span></div><div className="skill-grid">{SKILLS.map(skill => { const Icon = icons[skill]; return <article className="skill-card" key={skill}><div className="skill-card-top"><span className={`skill-icon ${skill}`}><Icon size={21} strokeWidth={1.7}/></span><span className="score">{state.scores[skill]}<small>/100</small></span></div><h3>{LABELS[skill]}</h3><p>{descriptions[skill]}</p><div className={`score-track ${skill}`} role="meter" aria-label={`${LABELS[skill]} practice score`} aria-valuenow={state.scores[skill]} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${state.scores[skill]}%` }}/></div></article>; })}</div><p className="score-disclaimer">Practice scores reflect your choices here, not a measure of real-world protection.</p></section>
        <div className="control-row"><span><CircleHelp size={17}/> Not every unexpected message is a scam.</span><button disabled={busy || !operational || ex?.status === 'active'} onClick={() => start(true)}>Try a legitimate request <ArrowRight size={15}/></button></div>
      </>}
      {screen === 'exercise' && scenario && ex && <section className="session-wrap">
        <div className="session-top"><span className="training-label"><Radio size={14}/> TRAINING SIMULATION</span><button className="text-button" disabled={busy} onClick={() => act(store.exit)}><X size={15}/> Exit exercise</button></div>
        <div className="session-title"><p className="eyebrow">{LABELS[scenario.skill]} <span> / </span> {scenario.difficulty === 1 ? 'Guided practice' : 'More complexity'}</p><h1 ref={heading} tabIndex={-1}>{scenario.title}</h1><p>Everything in this conversation is fictional. Choose what you would do.</p></div>
        <div className="conversation-layout"><div className="conversation-card"><div className="conversation-heading"><span className="caller-avatar"><MessageCircle size={21}/></span><div>{scenario.caller}<small>Simulated message · no real contact</small></div><span className="conversation-live">Practice</span></div><div className="transcript" aria-live="polite"><span className="conversation-time">TODAY · SIMULATION</span>{state.messages.map((message, index) => <div key={index} className={`message ${message.role === 'caller' ? 'incoming' : 'outgoing'}`}>{message.text}{message.role === 'learner' && <Check size={14}/>}</div>)}</div><div className="choices"><div className="choices-heading"><h2>What would you do?</h2><span>Decision {ex.decisions.length + 1} of up to 2</span></div>{state.choices.map((choice, i) => <button key={choice.id} className="choice" disabled={busy || !operational} onClick={() => act(() => store.decide(choice.id))}><span className="choice-letter">{String.fromCharCode(65 + i)}</span><span>{choice.text}</span><ArrowUpRight size={17}/></button>)}</div></div><aside className="session-sidebar"><div className="sidebar-icon"><Pause size={23}/></div><h3>You set the pace.</h3><p>{ex.cue ? cues[ex.cue] : "Take your time. Read the message and notice what the sender is asking you to do."}</p><hr/><span className="mini-label">A SMALL REMINDER</span><p>You never need to enter a password, phone number, or payment details in this exercise.</p><div className="sidebar-foot"><LockKeyhole size={15}/> Fictional scenario, real practice.</div></aside></div>
      </section>}
      {screen === 'result' && result && scenario && <section className="session-wrap result-wrap"><div className="session-top"><span className="training-label"><CheckCircle2 size={14}/> EXERCISE COMPLETE</span><button className="text-button" onClick={() => setHome(true)}><ArrowLeft size={15}/> Back to practice</button></div><div className="session-title"><p className="eyebrow">A MOMENT TO REFLECT</p><h1 tabIndex={-1} ref={heading}>{result.outcome === 'protective' ? 'A thoughtful next step.' : result.outcome === 'risky' ? 'A useful moment to pause.' : 'There’s one more step.'}</h1><p>{result.outcome === 'protective' ? 'You protected your options before taking action.' : 'This is exactly what practice is for. Here’s what to look for next time.'}</p></div><div className="result-grid"><article className="feedback-card"><span className="mini-label">YOUR DECISION</span><blockquote>“{ex?.decisions.at(-1)?.text}”</blockquote><p>{result.feedback}</p><div className="score-change"><div><span>{LABELS[result.skill]}</span><small>Practice score updated</small></div><span>{result.oldScore}<ArrowRight size={17}/><strong>{result.newScore}</strong><em className={result.delta < 0 ? 'negative' : ''}>{result.delta > 0 ? '+' : ''}{result.delta}</em></span></div></article><article className="detector-card"><div className="detector-title"><span className="mini-label">WHAT THE DETECTOR NOTICED</span><Search size={18}/></div><span className={`risk-label ${result.detection.label === 'High risk' ? 'high' : ''}`}>{result.detection.label === 'High risk' ? <AlertTriangle size={16}/> : <CircleHelp size={16}/>} {result.detection.label}</span>{result.detection.reasons.length ? <ul className="signals">{result.detection.reasons.map(reason => <li key={reason.signal}><span>{reason.signal}</span><q>{reason.evidence}</q></li>)}</ul> : <p>No strong signals matched this demonstration baseline. That is not a guarantee that a message is safe.</p>}<p className="detector-disclaimer">Rule-based demonstration baseline · uncertain, not a verdict. Your practice score comes from your choice, separately from this result.</p></article></div>
        <div className="coaching-card"><span className="coaching-icon"><Sparkles size={21}/></span><div><div className="coaching-heading"><h3>{state.coaching.status === 'live' ? 'A note from your AI coach' : 'Your coaching note'}</h3><span>{state.coaching.status === 'live' ? 'LIVE NEMOTRON' : state.coaching.status === 'running' ? 'PERSONALIZING…' : 'STANDARD GUIDANCE'}</span></div><p>{state.coaching.status === 'live' ? state.coaching.feedback : state.coaching.status === 'running' ? 'Reviewing your saved result and the next exercise. You can continue while your coach works.' : 'Try this next time: pause, choose a contact method you already trust, and verify before acting.'}</p>{state.coaching.status === 'unavailable' && <p className="small-muted">Live AI coaching is unavailable; your assessment is saved. <button className="inline-button" onClick={() => act(store.coach)} disabled={busy}>Retry coaching</button></p>}</div></div>
        <div className="adapted-card"><div><span className="mini-label"><Sparkles size={14}/> ADAPTED TO YOUR PRACTICE</span><h2>Up next: {next.title}</h2><p>{next.rationale}</p>{state.coaching.status === 'live' && state.coaching.cue && <p className="cue">{cues[state.coaching.cue]}</p>}</div><button className="primary" disabled={busy || !operational} onClick={() => start()}>Try next adapted exercise <ArrowRight size={18}/></button></div>
      </section>}
      {state.history.length > 0 && screen === 'home' && <details className="history"><summary>Recent practice <span>{state.history.length} saved</span><ChevronDown size={16}/></summary><div>{[...state.history].reverse().slice(0,5).map(h => <div className="history-row" key={h.exerciseId}><span>{h.title}<small>{LABELS[h.skill]}</small></span><span>{h.outcome === 'protective' ? 'Protective choice' : h.outcome === 'risky' ? 'Room to practice' : 'Verification needed'}</span><strong>{h.delta > 0 ? '+' : ''}{h.delta}</strong></div>)}</div></details>}
      <footer><span><ShieldCheck size={16}/> Small habits. Stronger instincts.</span><div><span className={`connection-label ${mode === 'spacetime' ? 'connected' : ''}`}><span className="status-dot"/>{mode === 'spacetime' ? 'Progress saved to SpacetimeDB' : mode === 'connecting' ? 'Connecting to SpacetimeDB' : 'Server disconnected'}</span><button onClick={() => setResetOpen(true)} disabled={busy || !operational}><RotateCcw size={13}/> Reset practice</button></div></footer>
      <details className="developer-trace"><summary><Terminal size={14}/> Demo execution trace <ChevronDown size={14}/></summary><p>Application steps are deterministic. “Nemotron” entries are actual returned model tool calls executed by the backend. No credentials are shown.</p><ol>{state.trace.map((entry, i) => <li key={i}><span className={`trace-source ${entry.status === 'error' ? 'trace-error' : ''}`}>{entry.source}</span><code>{entry.tool}</code><span>{entry.detail}</span></li>)}</ol>{state.trace.length === 0 && <p>Start an exercise to see its execution steps.</p>}</details>
    </main>
    {showHow && <div className="modal-backdrop" onClick={() => setShowHow(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="how-title" onClick={e => e.stopPropagation()}><button className="modal-close" aria-label="Close explanation" onClick={() => setShowHow(false)} autoFocus><X size={20}/></button><span className="mini-label">LEARN BY DOING</span><h2 id="how-title">One conversation.<br/>One stronger habit.</h2><ol className="how-list"><li><MessageCircle/><div><h3>Try a fictional conversation</h3><p>Choose how you’d respond. No actual messages or payments are sent.</p></div></li><li><Search/><div><h3>See the signals</h3><p>Get feedback on your decision and see the detector’s uncertain assessment.</p></div></li><li><Sparkles/><div><h3>Practice what you need next</h3><p>Your lowest practice score chooses the next focus. Success adds complexity; difficulty keeps the next round gentle.</p></div></li></ol><button className="primary" onClick={() => setShowHow(false)}>Got it <Check size={17}/></button></div></div>}
    {resetOpen && <div className="modal-backdrop"><div className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><h2 id="reset-title">Start fresh?</h2><p>This clears this learner’s practice history and returns all three scores to 50.</p><div className="modal-actions"><button className="secondary" autoFocus onClick={() => setResetOpen(false)}>Keep my progress</button><button className="primary" onClick={() => act(async () => { await store.reset(); setResetOpen(false); setHome(true); })}>Reset practice</button></div></div></div>}
  </div>;
}
