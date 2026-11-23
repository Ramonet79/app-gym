// Almacenamiento local-first + sincronización con Supabase.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const KEY = 'gymapp.v1';
const blank = () => ({
  profile: null, sessions: {}, sets: {}, settings: {}, notes: [], metrics: {}, checkins: {},
  active: null, queue: [], lastSync: null, lastUserId: null, prefs: { voice: true, sound: true },
});
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return Object.assign(blank(), JSON.parse(raw)); } catch (e) { /* almacenamiento no disponible */ }
  return blank();
}
export const S = load();
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { console.warn('No se pudo guardar', e); } }
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

// ───── cola de sincronización ─────
const TABLE = { profile: 'gym_profiles', session: 'gym_sessions', set: 'gym_set_logs', setting: 'gym_exercise_settings', metric: 'gym_body_metrics', note: 'gym_coach_notes', checkin: 'gym_checkins' };
export function enqueue(kind, key, op = 'upsert') {
  S.queue = S.queue.filter(q => !(q.kind === kind && q.key === key));
  S.queue.push({ kind, key, op });
  save();
  scheduleSync();
}

// ───── mapeos local ⇄ BD ─────
const toDb = {
  profile: p => ({ user_id: user.id, name: p.name, birth_year: p.birthYear, height_cm: p.heightCm, weight_kg: p.weightKg, start_date: p.startDate, back_notes: p.backNotes || null, prefs: S.prefs, updated_at: new Date().toISOString() }),
  session: s => ({ id: s.id, user_id: user.id, date: s.date, type: s.type, template: s.template || null, phase: s.phase || null, mode: s.mode || null, status: s.status, pain_before: s.painBefore ?? null, pain_after: s.painAfter ?? null, rpe: s.rpe ?? null, started_at: s.startedAt || null, finished_at: s.finishedAt || null, duration_min: s.durationMin ?? null, notes: s.notes || null, summary: s.summary || {}, updated_at: new Date().toISOString() }),
  set: x => ({ id: x.id, user_id: user.id, session_id: x.sessionId, exercise_id: x.exId, set_no: x.setNo, is_warmup: !!x.warmup, weight_kg: x.kg ?? null, reps: x.reps ?? null, seconds: x.secs ?? null, target_reps: x.targetReps ?? null, target_seconds: x.targetSecs ?? null, done_at: x.doneAt, updated_at: new Date().toISOString() }),
  setting: (st, id) => ({ user_id: user.id, exercise_id: id, weight_kg: st.kg ?? null, reps: st.reps ?? null, hold_s: st.hold ?? null, level: st.level || 0, back_flags: st.backFlags || 0, hard_streak: st.hardStreak || 0, machine_note: st.note || null, disabled: !!st.disabled, swap_to: st.swapTo || null, calibrated: !!st.calibrated, updated_at: st.updatedAt || new Date().toISOString(), updated_by: 'app' }),
  metric: m => ({ id: m.id, user_id: user.id, date: m.date, weight_kg: m.kg ?? null, waist_cm: m.waist ?? null, updated_at: new Date().toISOString() }),
  note: n => ({ id: n.id, user_id: user.id, title: n.title, body: n.body, kind: n.kind, active: n.active, read_at: n.readAt || null }),
  checkin: c => ({ id: c.id, user_id: user.id, date: c.date, kind: c.kind, answers: c.answers || {}, readiness: c.readiness ?? null, updated_at: new Date().toISOString() }),
};
const fromDb = {
  session: r => ({ id: r.id, date: r.date, type: r.type, template: r.template, phase: r.phase, mode: r.mode, status: r.status, painBefore: r.pain_before, painAfter: r.pain_after, rpe: r.rpe, startedAt: r.started_at, finishedAt: r.finished_at, durationMin: r.duration_min != null ? +r.duration_min : null, notes: r.notes, summary: r.summary || {} }),
  set: r => ({ id: r.id, sessionId: r.session_id, exId: r.exercise_id, setNo: r.set_no, warmup: r.is_warmup, kg: r.weight_kg != null ? +r.weight_kg : null, reps: r.reps, secs: r.seconds, targetReps: r.target_reps, targetSecs: r.target_seconds, doneAt: r.done_at }),
  setting: r => ({ kg: r.weight_kg != null ? +r.weight_kg : null, reps: r.reps, hold: r.hold_s, level: r.level, backFlags: r.back_flags, hardStreak: r.hard_streak, note: r.machine_note || '', disabled: r.disabled, swapTo: r.swap_to, calibrated: r.calibrated, updatedAt: r.updated_at, updatedBy: r.updated_by }),
  metric: r => ({ id: r.id, date: r.date, kg: r.weight_kg != null ? +r.weight_kg : null, waist: r.waist_cm != null ? +r.waist_cm : null }),
  note: r => ({ id: r.id, title: r.title, body: r.body, kind: r.kind, active: r.active, readAt: r.read_at, createdAt: r.created_at }),
  checkin: r => ({ id: r.id, date: r.date, kind: r.kind, answers: r.answers || {}, readiness: r.readiness }),
  profile: r => ({ name: r.name, birthYear: r.birth_year, heightCm: r.height_cm != null ? +r.height_cm : null, weightKg: r.weight_kg != null ? +r.weight_kg : null, startDate: r.start_date, backNotes: r.back_notes }),
};

// ───── Supabase ─────
let sb = null;
export let user = null;
export const cloud = { status: 'local', error: null, recovery: false, ready: false };
const listeners = new Set();
export const onCloud = fn => listeners.add(fn);
const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });

export function initCloud() {
  if (!window.supabase) { cloud.status = 'local'; return; }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'gymapp-auth' },
  });
  sb.auth.onAuthStateChange((ev, session) => {
    user = session?.user || null;
    cloud.ready = true;
    if (ev === 'PASSWORD_RECOVERY') cloud.recovery = true;
    if (!user) cloud.status = 'local';
    if (user && (ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION')) {
      if (S.lastUserId !== user.id) { enqueueAll(); S.lastUserId = user.id; save(); }
      setTimeout(sync, 50);
    }
    emit();
  });
  addEventListener('online', () => sync());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
}

function enqueueAll() {
  if (S.profile) enqueue('profile', 'me');
  for (const id in S.sessions) enqueue('session', id);
  for (const id in S.sets) enqueue('set', id);
  for (const id in S.settings) enqueue('setting', id);
  for (const id in S.metrics) enqueue('metric', id);
  for (const id in S.checkins || {}) enqueue('checkin', id);
}

let syncTimer = null, syncing = false;
function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(sync, 1200); }

export async function sync() {
  if (!sb || !user || syncing) return;
  if (!navigator.onLine) { cloud.status = 'offline'; emit(); return; }
  syncing = true; cloud.status = 'syncing'; emit();
  try {
    await push();
    await pull();
    cloud.status = S.queue.length ? 'pending' : 'ok'; cloud.error = null;
    S.lastSync = new Date().toISOString(); save();
  } catch (e) {
    console.warn('sync', e);
    cloud.status = navigator.onLine ? 'error' : 'offline'; cloud.error = e.message || String(e);
  } finally { syncing = false; emit(); }
}

async function push() {
  const order = ['profile', 'session', 'set', 'setting', 'metric', 'note', 'checkin'];
  const batch = [...S.queue];
  for (const kind of order) {
    const items = batch.filter(q => q.kind === kind);
    if (!items.length) continue;
    const ups = [], dels = [];
    for (const q of items) {
      if (q.op === 'delete') { dels.push(q.key); continue; }
      const src = kind === 'profile' ? S.profile : kind === 'session' ? S.sessions[q.key] : kind === 'set' ? S.sets[q.key] : kind === 'setting' ? S.settings[q.key] : kind === 'metric' ? S.metrics[q.key] : kind === 'checkin' ? S.checkins[q.key] : S.notes.find(n => n.id === q.key);
      if (src) ups.push(toDb[kind](src, q.key));
    }
    if (ups.length) {
      const opts = kind === 'setting' ? { onConflict: 'user_id,exercise_id' } : kind === 'profile' ? { onConflict: 'user_id' } : {};
      for (let i = 0; i < ups.length; i += 500) {
        const { error } = await sb.from(TABLE[kind]).upsert(ups.slice(i, i + 500), opts);
        if (error) throw error;
      }
    }
    if (dels.length) {
      const col = kind === 'setting' ? 'exercise_id' : 'id';
      const { error } = await sb.from(TABLE[kind]).delete().in(col, dels);
      if (error) throw error;
    }
    const done = new Set(items);
    S.queue = S.queue.filter(q => !done.has(q));
    save();
  }
}

async function pull() {
  const pending = new Set(S.queue.map(q => q.kind + ':' + q.key));
  const since = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  const [prof, ses, sets, stg, notes, mets, chk] = await Promise.all([
    sb.from('gym_profiles').select('*').maybeSingle(),
    sb.from('gym_sessions').select('*').gte('date', since).limit(2000),
    sb.from('gym_set_logs').select('*').gte('done_at', since).limit(20000),
    sb.from('gym_exercise_settings').select('*'),
    sb.from('gym_coach_notes').select('*').eq('active', true).order('created_at', { ascending: false }).limit(20),
    sb.from('gym_body_metrics').select('*').order('date').limit(1000),
    sb.from('gym_checkins').select('*').order('date').limit(500),
  ]);
  for (const r of [prof, ses, sets, stg, notes, mets]) if (r.error) throw r.error;
  S.checkins = S.checkins || {};
  if (!chk.error) for (const r of chk.data) if (!pending.has('checkin:' + r.id)) S.checkins[r.id] = fromDb.checkin(r);
  if (prof.data && !pending.has('profile:me')) {
    const p = fromDb.profile(prof.data);
    S.profile = { ...(S.profile || {}), ...Object.fromEntries(Object.entries(p).filter(([, v]) => v != null)) };
    if (prof.data.prefs && typeof prof.data.prefs === 'object') S.prefs = { ...S.prefs, ...prof.data.prefs };
  }
  for (const r of ses.data) if (!pending.has('session:' + r.id) && S.active?.sessionId !== r.id) S.sessions[r.id] = { ...(S.sessions[r.id] || {}), ...fromDb.session(r) };
  for (const r of sets.data) if (!pending.has('set:' + r.id)) S.sets[r.id] = fromDb.set(r);
  for (const r of stg.data) {
    if (pending.has('setting:' + r.exercise_id)) continue;
    const loc = S.settings[r.exercise_id];
    if (!loc || !loc.updatedAt || new Date(r.updated_at) >= new Date(loc.updatedAt)) S.settings[r.exercise_id] = { ...(loc || {}), ...fromDb.setting(r) };
  }
  S.notes = notes.data.map(fromDb.note);
  for (const r of mets.data) if (!pending.has('metric:' + r.id)) S.metrics[r.id] = fromDb.metric(r);
  save();
}

// ───── auth ─────
const redirect = () => location.origin + location.pathname;
export async function signIn(email, password) { const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; }
export async function signUp(email, password) {
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirect() } });
  if (error) throw error;
  return data.session ? 'in' : 'confirm';
}
export async function signOut() { await sb.auth.signOut(); user = null; cloud.status = 'local'; emit(); }
export async function resetPassword(email) { const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirect() }); if (error) throw error; }
export async function updatePassword(pw) { const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw error; cloud.recovery = false; emit(); }
export const hasCloud = () => !!sb;
