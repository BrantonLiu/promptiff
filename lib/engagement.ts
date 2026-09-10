/** Foreground-only, per-tab survey eligibility. No wall-clock time is persisted. */
export const ENGAGEMENT_MODES = ['review', 'diff', 'lexical', 'semantic'] as const;
export type EngagementMode = (typeof ENGAGEMENT_MODES)[number];
export const SURVEY_THRESHOLD_MS = 600_000;
export const HEARTBEAT_MS = 1_000;
export const MAX_HEARTBEAT_GAP_MS = 2_500;
export const ENGAGEMENT_STORAGE_KEY = 'wordiff:engagement:v1';
export type EngagementState = {
  version: 1;
  sessionId: string;
  visitedModes: EngagementMode[];
  activeMs: number;
  surveyStatus: 'pending' | 'dismissed' | 'submitted';
};
export type EngagementSnapshot = EngagementState & { foreground: boolean; eligible: boolean };
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
const isMode = (value: unknown): value is EngagementMode => ENGAGEMENT_MODES.includes(value as EngagementMode);
const isUUID = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function newEngagementState(sessionId: string): EngagementState {
  return { version: 1, sessionId, visitedModes: [], activeMs: 0, surveyStatus: 'pending' };
}
export function readEngagement(storage: StorageLike | undefined, sessionId: string): EngagementState {
  try {
    const value = JSON.parse(storage?.getItem(ENGAGEMENT_STORAGE_KEY) || 'null');
    if (value?.version !== 1 || !isUUID(value.sessionId) || !Array.isArray(value.visitedModes) ||
      !value.visitedModes.every(isMode) || new Set(value.visitedModes).size !== value.visitedModes.length ||
      !Number.isSafeInteger(value.activeMs) || value.activeMs < 0 ||
      !['pending', 'dismissed', 'submitted'].includes(value.surveyStatus)) return newEngagementState(sessionId);
    return { version: 1, sessionId: value.sessionId, visitedModes: value.visitedModes,
      activeMs: value.activeMs, surveyStatus: value.surveyStatus };
  } catch { return newEngagementState(sessionId); }
}
export function isSurveyEligible(state: EngagementState): boolean {
  return state.surveyStatus === 'pending' && state.activeMs > SURVEY_THRESHOLD_MS &&
    ENGAGEMENT_MODES.every(mode => state.visitedModes.includes(mode));
}

/** Pure clock model: each short interval must have been foreground at both samples. */
export class EngagementClock {
  state: EngagementState;
  foreground = false;
  private previous: { monotonic: number; wall: number } | null = null;
  constructor(state: EngagementState) { this.state = state; }
  sample(monotonic: number, wall: number, foreground: boolean, mode?: EngagementMode) {
    if (this.previous && this.foreground && foreground) {
      const elapsed = monotonic - this.previous.monotonic;
      const wallElapsed = wall - this.previous.wall;
      // performance.now can pause during system sleep on some browsers. Check both clocks.
      if (elapsed >= 0 && elapsed <= MAX_HEARTBEAT_GAP_MS && wallElapsed >= 0 &&
        wallElapsed <= MAX_HEARTBEAT_GAP_MS && Math.abs(elapsed - wallElapsed) < 1_000) {
        this.state = { ...this.state, activeMs: this.state.activeMs + Math.floor(elapsed) };
      }
    }
    this.foreground = foreground;
    this.previous = foreground ? { monotonic, wall } : null;
    if (foreground && mode && isMode(mode) && !this.state.visitedModes.includes(mode)) {
      this.state = { ...this.state, visitedModes: [...this.state.visitedModes, mode] };
    }
  }
  finish(status: 'dismissed' | 'submitted') { this.state = { ...this.state, surveyStatus: status }; }
  snapshot(): EngagementSnapshot { return { ...this.state, foreground: this.foreground, eligible: isSurveyEligible(this.state) && this.foreground }; }
}

export const EMPTY_ENGAGEMENT: EngagementSnapshot = {
  ...newEngagementState(''), foreground: false, eligible: false,
};

/** One controller per JS document prevents concurrent mounts from double counting. */
export function createBrowserEngagement() {
  let storage: StorageLike | undefined;
  try { storage = window.sessionStorage; } catch { /* Private/blocked storage: memory only. */ }
  const clock = new EngagementClock(readEngagement(storage, crypto.randomUUID()));
  const listeners = new Set<() => void>();
  const mounts = new Map<symbol, EngagementMode>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let lifecyclePaused = false;
  let snapshot = clock.snapshot();
  const publish = () => {
    snapshot = clock.snapshot();
    try { storage?.setItem(ENGAGEMENT_STORAGE_KEY, JSON.stringify(clock.state)); } catch { /* Retain memory progress. */ }
    listeners.forEach(listener => listener());
  };
  const sample = () => {
    const mode = [...mounts.values()].at(-1);
    clock.sample(performance.now(), Date.now(), Boolean(mode) && !lifecyclePaused &&
      document.visibilityState === 'visible' && document.hasFocus(), mode);
    publish();
  };
  const pause = () => { lifecyclePaused = true; sample(); };
  const resume = () => { lifecyclePaused = false; sample(); };
  const start = () => {
    lifecyclePaused = false;
    window.addEventListener('focus', sample);
    window.addEventListener('blur', sample);
    document.addEventListener('visibilitychange', sample);
    document.addEventListener('freeze', pause);
    document.addEventListener('resume', resume);
    window.addEventListener('pagehide', pause);
    window.addEventListener('pageshow', resume);
    timer = setInterval(sample, HEARTBEAT_MS);
  };
  const stop = () => {
    if (timer) clearInterval(timer);
    window.removeEventListener('focus', sample);
    window.removeEventListener('blur', sample);
    document.removeEventListener('visibilitychange', sample);
    document.removeEventListener('freeze', pause);
    document.removeEventListener('resume', resume);
    window.removeEventListener('pagehide', pause);
    window.removeEventListener('pageshow', resume);
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    mount(mode: EngagementMode) {
      const id = Symbol('engagement-mount');
      mounts.set(id, mode);
      if (mounts.size === 1) start();
      sample();
      return {
        setMode(next: EngagementMode) { mounts.set(id, next); sample(); },
        dispose() {
          // Flush only the current short foreground interval, then reset the baseline.
          sample();
          mounts.delete(id);
          sample();
          if (!mounts.size) stop();
        },
      };
    },
    finish(status: 'dismissed' | 'submitted') { clock.finish(status); publish(); },
  };
}
