import assert from 'node:assert/strict';
import test from 'node:test';
import { EngagementClock, ENGAGEMENT_MODES, ENGAGEMENT_STORAGE_KEY, isSurveyEligible, newEngagementState, readEngagement } from '../lib/engagement.ts';

const UUID = '82eb6d54-c3b4-47cb-86f0-312323703235';
function makeClock() { return new EngagementClock(newEngagementState(UUID)); }
function advance(clock, from, seconds) {
  for (let i = 1; i <= seconds; i++) clock.sample(from + i * 1000, from + i * 1000, true);
}

test('requires every actual foreground mode and strictly more than ten minutes', () => {
  const clock = makeClock();
  ENGAGEMENT_MODES.forEach(mode => clock.sample(0, 0, true, mode));
  advance(clock, 0, 600);
  assert.equal(clock.state.activeMs, 600_000);
  assert.equal(isSurveyEligible(clock.state), false);
  advance(clock, 600_000, 1);
  assert.equal(clock.snapshot().eligible, true);
  clock.state.visitedModes = ['review', 'diff', 'lexical'];
  assert.equal(isSurveyEligible(clock.state), false);
});

test('hidden/blurred/frozen intervals never count and hidden mode visits do not qualify', () => {
  const clock = makeClock();
  clock.sample(0, 0, true, 'review');
  advance(clock, 0, 3);
  clock.sample(3500, 3500, false, 'diff');
  clock.sample(120_000, 120_000, false, 'lexical');
  clock.sample(200_000, 200_000, true, 'semantic');
  advance(clock, 200_000, 2);
  assert.equal(clock.state.activeMs, 5000);
  assert.deepEqual(clock.state.visitedModes, ['review', 'semantic']);
});

test('sleep gaps are discarded whether performance time advances or freezes', () => {
  const clock = makeClock();
  clock.sample(0, 0, true, 'review');
  clock.sample(1000, 1000, true);
  clock.sample(700_000, 700_000, true);
  assert.equal(clock.state.activeMs, 1000);
  clock.sample(701_000, 1_400_000, true);
  assert.equal(clock.state.activeMs, 1000);
  clock.sample(702_000, 1_401_000, true);
  assert.equal(clock.state.activeMs, 2000);
});

test('backwards clock and long blocked event loop gaps do not add engagement', () => {
  const clock = makeClock();
  clock.sample(0, 10_000, true, 'review');
  clock.sample(1000, 9000, true);
  clock.sample(5000, 13_000, true);
  assert.equal(clock.state.activeMs, 0);
});

test('reload restores only accumulated active duration and no intervening time', () => {
  const clock = makeClock();
  clock.sample(0, 0, true, 'review');
  advance(clock, 0, 5);
  const storage = { getItem: () => JSON.stringify(clock.state), setItem: () => {} };
  const restored = new EngagementClock(readEngagement(storage, UUID));
  restored.sample(0, 1_000_000, true, 'diff');
  restored.sample(1000, 1_001_000, true);
  assert.equal(restored.state.activeMs, 6000);
  assert.deepEqual(restored.state.visitedModes, ['review', 'diff']);
});

test('same-time samples and remount baseline cannot double count', () => {
  const clock = makeClock();
  clock.sample(0, 0, true, 'review');
  clock.sample(0, 0, true, 'diff');
  clock.sample(1000, 1000, true);
  clock.sample(1000, 1000, false);
  clock.sample(1000, 1000, true, 'semantic');
  clock.sample(2000, 2000, true);
  assert.equal(clock.state.activeMs, 2000);
});

test('dismissal and submission survive reload and prevent repeat survey', () => {
  for (const status of ['dismissed', 'submitted']) {
    const clock = makeClock();
    clock.state.activeMs = 601_000;
    clock.state.visitedModes = [...ENGAGEMENT_MODES];
    clock.finish(status);
    const storage = { getItem: (key) => key === ENGAGEMENT_STORAGE_KEY ? JSON.stringify(clock.state) : null, setItem: () => {} };
    const restored = readEngagement(storage, UUID);
    assert.equal(restored.surveyStatus, status);
    assert.equal(isSurveyEligible(restored), false);
  }
});

test('corrupt, invalid, or unavailable storage starts clean', () => {
  for (const saved of ['{', 'null', JSON.stringify({ ...newEngagementState(UUID), activeMs: -1 }),
    JSON.stringify({ ...newEngagementState(UUID), visitedModes: ['fake'] }),
    JSON.stringify({ ...newEngagementState(UUID), visitedModes: ['diff', 'diff'] })]) {
    assert.deepEqual(readEngagement({ getItem: () => saved, setItem: () => {} }, UUID), newEngagementState(UUID));
  }
  assert.deepEqual(readEngagement({ getItem: () => { throw Error('blocked'); }, setItem: () => {} }, UUID), newEngagementState(UUID));
  assert.deepEqual(readEngagement(undefined, UUID), newEngagementState(UUID));
});

test('eligible survey cannot open while no longer foreground', () => {
  const clock = makeClock();
  clock.state.activeMs = 601_000;
  clock.state.visitedModes = [...ENGAGEMENT_MODES];
  clock.sample(0, 0, false);
  assert.equal(clock.snapshot().eligible, false);
  clock.sample(1000, 1000, true);
  assert.equal(clock.snapshot().eligible, true);
});

test('browser lifecycle pauses tracking, restores session, and shares one heartbeat across mounts', async t => {
  const { createBrowserEngagement } = await import('../lib/engagement.ts');
  let now = 0;
  let focused = true;
  let heartbeat;
  let intervalCount = 0;
  const values = new Map();
  const windowMock = new EventTarget();
  windowMock.sessionStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const documentMock = new EventTarget();
  documentMock.visibilityState = 'visible';
  documentMock.hasFocus = () => focused;
  const replacements = { window: windowMock, document: documentMock, performance: { now: () => now },
    setInterval: callback => { heartbeat = callback; intervalCount++; return 1; }, clearInterval: () => { heartbeat = undefined; } };
  const originals = Object.fromEntries(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const originalDateNow = Date.now;
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  Date.now = () => now;
  t.after(() => {
    Date.now = originalDateNow;
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const tick = milliseconds => { now += milliseconds; heartbeat?.(); };
  const controller = createBrowserEngagement();
  const first = controller.mount('review');
  const second = controller.mount('diff');
  assert.equal(intervalCount, 1);
  tick(1000);
  assert.equal(controller.getSnapshot().activeMs, 1000);
  focused = false;
  windowMock.dispatchEvent(new Event('blur'));
  tick(30_000);
  second.setMode('semantic');
  assert.deepEqual(controller.getSnapshot().visitedModes, ['review', 'diff']);
  focused = true;
  windowMock.dispatchEvent(new Event('focus'));
  tick(1000);
  documentMock.visibilityState = 'hidden';
  documentMock.dispatchEvent(new Event('visibilitychange'));
  tick(120_000);
  documentMock.visibilityState = 'visible';
  documentMock.dispatchEvent(new Event('visibilitychange'));
  tick(1000);
  documentMock.dispatchEvent(new Event('freeze'));
  tick(10_000);
  documentMock.dispatchEvent(new Event('resume'));
  tick(1000);
  windowMock.dispatchEvent(new Event('pagehide'));
  tick(10_000);
  windowMock.dispatchEvent(new Event('pageshow'));
  tick(1000);
  assert.equal(controller.getSnapshot().activeMs, 5000);
  first.dispose();
  assert.ok(heartbeat);
  second.dispose();
  assert.equal(heartbeat, undefined);
  now += 5_000_000;
  const reloaded = createBrowserEngagement();
  const mounted = reloaded.mount('lexical');
  assert.equal(reloaded.getSnapshot().activeMs, 5000);
  assert.deepEqual(new Set(reloaded.getSnapshot().visitedModes), new Set(ENGAGEMENT_MODES));
  tick(1000);
  assert.equal(reloaded.getSnapshot().activeMs, 6000);
  mounted.dispose();
});
