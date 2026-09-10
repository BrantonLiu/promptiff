import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFeedback, isSameOriginRequest, readFeedbackJson } from '../../lib/supabase-feedback-validation.ts';
import { isPublicSupabaseKey } from '../../lib/server-env.ts';

const valid = {
  sessionId: '01992440-5ff3-7c0a-b691-e15a4f3e36c0',
  visitedModes: ['review', 'diff', 'lexical', 'semantic'],
  activeMs: 600001,
  rating: 4,
  preferredMode: 'semantic',
  comment: '  有帮助  ',
};

test('normalizes optional comment and ignores untrusted identity fields', () => {
  const result = validateFeedback({ ...valid, user_id: 'forged', comment: undefined });
  assert.ok(result);
  assert.equal(result.comment, '');
  assert.equal('user_id' in result, false);
  assert.equal(validateFeedback(valid)?.comment, '有帮助');
});

test('requires strictly more than ten minutes and every distinct mode', () => {
  for (const activeMs of [600000, 599999, -1, Infinity, NaN, 600001.5, '600001']) {
    assert.equal(validateFeedback({ ...valid, activeMs }), null);
  }
  assert.equal(validateFeedback({ ...valid, visitedModes: ['review', 'diff', 'lexical', 'lexical'] }), null);
  assert.equal(validateFeedback({ ...valid, visitedModes: [...valid.visitedModes, 'semantic'] }), null);
});

test('rejects malformed ids, scores, mode and oversized comments', () => {
  for (const patch of [{ sessionId: 'not-a-uuid' }, { rating: 0 }, { rating: 6 }, { rating: 2.5 }, { preferredMode: 'other' }, { comment: 'x'.repeat(2001) }]) {
    assert.equal(validateFeedback({ ...valid, ...patch }), null);
  }
});

test('requires same origin and rejects cross-site fetch metadata', () => {
  const request = (headers) => new Request('https://example.com/api/feedback', { method: 'POST', headers });
  assert.equal(isSameOriginRequest(request({ origin: 'https://example.com' }), ''), true);
  assert.equal(isSameOriginRequest(request({ origin: 'https://evil.example' }), ''), false);
  assert.equal(isSameOriginRequest(request({ origin: 'null' }), ''), false);
  assert.equal(isSameOriginRequest(request({}), ''), false);
  assert.equal(isSameOriginRequest(request({ origin: 'https://example.com', 'sec-fetch-site': 'cross-site' }), ''), false);
});

test('enforces body size without trusting content-length', async () => {
  const request = new Request('https://example.com', { method: 'POST', body: 'x'.repeat(16400) });
  await assert.rejects(readFeedbackJson(request), /BODY_TOO_LARGE/);
  const good = new Request('https://example.com', { method: 'POST', body: JSON.stringify(valid) });
  assert.deepEqual(await readFeedbackJson(good), valid);
});

test('config refuses to expose service role or secret API keys', () => {
  const token = (role) => `header.${btoa(JSON.stringify({ role }))}.signature`;
  assert.equal(isPublicSupabaseKey(token('anon')), true);
  assert.equal(isPublicSupabaseKey(token('service_role')), false);
  assert.equal(isPublicSupabaseKey('sb_secret_private'), false);
  assert.equal(isPublicSupabaseKey('sb_publishable_public'), true);
  assert.equal(isPublicSupabaseKey(''), false);
});
