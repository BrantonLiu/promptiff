import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  sentences,
  compare,
  validateSession,
  diff,
  wordDiff,
  words,
} from '../public/canvas/core.mjs';
import { parseCodex, findCurrentSession } from '../cli/session.mjs';
import { embeddings, remoteConfig, validateVectors } from '../cli/engine.mjs';
import { startServer, installSkill } from '../cli/promptiff.mjs';
const session = {
  version: 1,
  title: 'Test',
  turns: [{ id: 't1', text: 'Only local.' }],
  artifacts: [{ id: 'a1', turnId: 't1', text: 'Only local.' }],
};
test('split preserves Unicode, punctuation, English sentences and whitespace', () => {
  for (const text of [
    'Hello world. A second sentence.',
    '你好！\n\n别上传。',
    '😀'.repeat(201),
    '  hi\n',
    'v1.2 supports JSON. Done.',
  ]) {
    const parts = sentences(text);
    assert.equal(parts.join(''), text);
    assert.ok(parts.every((s) => Array.from(s).length <= 100));
  }
  assert.equal(sentences('One sentence. Another sentence.').length, 2);
});
test('semantic matching uses supplied vectors and exposes reverse omissions', () => {
  const source = [{ text: 'Keep it private.' }, { text: 'Allow export.' }];
  const r = compare(source, ['Process on device.'], {
    'Keep it private.': [1, 0],
    'Allow export.': [0, 1],
    'Process on device.': [1, 0],
  });
  assert.equal(r.semantic, true);
  assert.equal(r.rows[0].candidates[0].score, 1);
  assert.equal(r.coverage[1].score, 0);
  assert.equal(compare(source, ['Process on device.']).semantic, false);
  assert.throws(() => compare(source, ['Process on device.'], {}));
});
test('diff can reconstruct both source and target including emoji', () => {
  for (const [a, b] of [
    ['不要上传。', '可以上传。'],
    ['😀abc', 'ab🚀'],
    ['', 'x'],
    ['abc', ''],
  ]) {
    const ops = diff(a, b);
    assert.equal(
      ops
        .filter((o) => o.type !== 'insert')
        .map((o) => o.text)
        .join(''),
      a,
    );
    assert.equal(
      ops
        .filter((o) => o.type !== 'delete')
        .map((o) => o.text)
        .join(''),
      b,
    );
  }
});
test('session validation rejects dangling artifacts, duplicate IDs and oversized data', () => {
  assert.equal(validateSession(session).artifacts[0].format, 'text');
  assert.throws(() =>
    validateSession({
      ...session,
      turns: [...session.turns, ...session.turns],
    }),
  );
  assert.throws(() =>
    validateSession({
      ...session,
      artifacts: [{ id: 'a', turnId: 'missing', text: 'x' }],
    }),
  );
  assert.throws(() =>
    validateSession({
      ...session,
      turns: [{ id: 't1', text: 'x'.repeat(60001) }],
    }),
  );
});
test('Codex capture ignores tool/system messages and duplicate events', () => {
  const msg = (role, text, phase) => ({
    type: 'response_item',
    payload: {
      type: 'message',
      role,
      phase,
      content: [{ type: 'input_text', text }],
    },
  });
  const records = [
    msg('system', 'SECRET'),
    msg('user', '<environment_context>injected</environment_context>'),
    msg('user', 'Only local.'),
    {
      type: 'event_msg',
      payload: { type: 'user_message', message: 'Only local.' },
    },
    msg('assistant', 'Working on it', 'commentary'),
    msg('assistant', 'Only local.', 'final_answer'),
    {
      type: 'event_msg',
      payload: { type: 'agent_message', message: 'Only local.' },
    },
  ];
  const result = parseCodex(records.map(JSON.stringify).join('\n'));
  assert.equal(result.turns.length, 1);
  assert.equal(result.artifacts.length, 1);
  assert.equal(result.turns[0].text, 'Only local.');
  assert.ok(!JSON.stringify(result).includes('SECRET'));
});
test('current-session lookup does not fall back to another task', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'promptiff-lookup-'));
  try {
    await writeFile(join(dir, 'rollout-12345678.jsonl'), '{}');
    assert.equal(
      await findCurrentSession(dir, '12345678'),
      join(dir, 'rollout-12345678.jsonl'),
    );
    await assert.rejects(() => findCurrentSession(dir, '87654321'));
    await assert.rejects(() => findCurrentSession(dir, undefined));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('remote mode requires opt-in and valid credentials; malformed vectors fail', () => {
  const env = {
    PROMPTIFF_API_URL: 'https://example.com/v1/embeddings',
    PROMPTIFF_API_KEY: 'secret',
    PROMPTIFF_MODEL: 'test',
  };
  assert.throws(() => remoteConfig(env, false));
  assert.throws(() =>
    remoteConfig({ ...env, PROMPTIFF_API_URL: 'http://example.com' }, true),
  );
  assert.equal(remoteConfig(env, true).model, 'test');
  for (const value of [[[0, 0]], [[1, NaN]], [[1, 2], [1]], []])
    assert.throws(() => validateVectors(value, 1));
});
test('loopback server protects session and model endpoints; serves inert canvas', async () => {
  const { server, url } = await startServer({ sessions: [session] });
  const base = new URL(url);
  const token = new URLSearchParams(base.hash.slice(1)).get('token');
  try {
    assert.equal((await fetch(base.origin)).status, 200);
    for (const file of [
      'canvas.mjs',
      'core.mjs',
      'document.mjs',
      'colors.mjs',
      'demo.mjs',
      'demo-vectors.mjs',
    ]) {
      const asset = await fetch(`${base.origin}/${file}`);
      assert.equal(asset.status, 200, file);
      assert.match(asset.headers.get('content-type'), /javascript/);
      assert.equal(
        (await fetch(`${base.origin}/canvas/${file}`)).status,
        200,
        `canvas/${file}`,
      );
    }
    assert.equal((await fetch(`${base.origin}/api/session`)).status, 401);
    const res = await fetch(`${base.origin}/api/session`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    assert.equal(data.sessions[0].title, 'Test');
    assert.ok(!JSON.stringify(data).includes(token));
    assert.equal(
      (
        await fetch(`${base.origin}/api/session`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Origin: 'https://evil.test',
          },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${base.origin}/api/embeddings`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      ).status,
      409,
    );
    assert.equal((await fetch(`${base.origin}/unknown`)).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test('skill installer bundles runtime and refuses overwriting an existing skill', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'promptiff-install-'));
  try {
    const dest = await installSkill(dir);
    assert.match(
      await readFile(join(dest, 'SKILL.md'), 'utf8'),
      /promptiff-canvas/,
    );
    assert.match(
      await readFile(join(dest, 'runtime/public/canvas/core.mjs'), 'utf8'),
      /validateSession/,
    );
    assert.match(
      await readFile(join(dest, 'runtime/public/canvas/document.mjs'), 'utf8'),
      /renderDocument/,
    );
    assert.match(
      await readFile(
        join(dest, 'runtime/public/canvas/demo-vectors.mjs'),
        'utf8',
      ),
      /demoVectors/,
    );
    await assert.rejects(() => installSkill(dir), /目标已存在/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('remote embeddings sends only selected texts and restores vector index order', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://example.com/v1/embeddings');
      assert.equal(options.headers.Authorization, 'Bearer private');
      assert.deepEqual(JSON.parse(options.body), {
        model: 'fixture',
        input: ['first', 'second'],
        encoding_format: 'float',
      });
      return Response.json({
        data: [
          { index: 1, embedding: [0, 1] },
          { index: 0, embedding: [1, 0] },
        ],
      });
    };
    const vectors = await embeddings(['first', 'second'], {
      engine: 'remote',
      remote: {
        url: 'https://example.com/v1/embeddings',
        key: 'private',
        model: 'fixture',
      },
    });
    assert.deepEqual(vectors, [
      [1, 0],
      [0, 1],
    ]);
    globalThis.fetch = async () =>
      Response.json({
        data: [
          { index: 0, embedding: [1, 0] },
          { index: 0, embedding: [0, 1] },
        ],
      });
    await assert.rejects(
      () =>
        embeddings(['first', 'second'], {
          engine: 'remote',
          remote: {
            url: 'https://example.com',
            key: 'private',
            model: 'fixture',
          },
        }),
      /index/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test('word diff preserves whole-word changes and reconstructs multilingual input', () => {
  assert.deepEqual(wordDiff('cats', 'cars'), [
    { type: 'delete', text: 'cats' },
    { type: 'insert', text: 'cars' },
  ]);
  for (const [a, b] of [
    ['本地保存。', '云端保存。'],
    ['keep **local**  files\n😀', 'keep **remote** files\n🚀'],
    ['', 'new'],
    ['gone', ''],
    ['same', 'same'],
  ]) {
    assert.equal(words(a).join(''), a);
    assert.equal(words(b).join(''), b);
    const ops = wordDiff(a, b);
    assert.equal(
      ops
        .filter((op) => op.type !== 'insert')
        .map((op) => op.text)
        .join(''),
      a,
    );
    assert.equal(
      ops
        .filter((op) => op.type !== 'delete')
        .map((op) => op.text)
        .join(''),
      b,
    );
  }
});
