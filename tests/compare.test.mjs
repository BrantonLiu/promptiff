import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareSession } from '../cli/compare.mjs';
import { parseCodex } from '../cli/session.mjs';
import { compare, sentences } from '../public/canvas/core.mjs';
import { prepareDocument } from '../public/canvas/document.mjs';

const sample = {
  version: 1, title: 'Document delivery',
  turns: [{ id: 't1', text: '数据保存在本地。支持导出 CSV。' }, { id: 't2', text: '增加版本记录。' }],
  artifacts: [
    { id: 'a1', turnId: 't1', format: 'markdown', text: '# 方案\n\n数据保存在本地。' },
    { id: 'a2', turnId: 't2', format: 'markdown', text: '# 修订\n\n数据保存在本地。支持导出 CSV。增加版本记录。' },
  ],
};

test('headless check excludes future requirements and matches canvas sentence preparation', async () => {
  const result = await compareSession(sample, { artifactId: 'a1' });
  assert.deepEqual(result.turnIds, ['t1']);
  const source = sentences(sample.turns[0].text).map(text => ({ text: text.trim(), turnId: 't1', label: 't1' }));
  const target = prepareDocument(sample.artifacts[0].text, 'markdown').units.map(unit => unit.text);
  const expected = compare(source, target);
  assert.deepEqual(result.rows, expected.rows);
  assert.deepEqual(result.coverage, expected.coverage);
  assert.equal(result.coverage[0].score, 1);
  assert.ok(result.coverage[1].score < 0.5);
  const revised = await compareSession(sample);
  assert.equal(revised.artifact.id, 'a2');
  assert.ok(revised.coverage.every(row => row.score === 1));
  await assert.rejects(compareSession(sample, { artifactId: 'missing' }));
});

test('CLI writes a private report, refuses overwrite and remote mode without authorization', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'promptiff-report-'));
  try {
    const session = join(dir, 'session.json'), report = join(dir, 'report.json');
    await writeFile(session, JSON.stringify(sample));
    const cli = new URL('../cli/promptiff.mjs', import.meta.url).pathname;
    const args = [cli, 'compare', '--session', session, '--out', report];
    execFileSync(process.execPath, args);
    const saved = await readFile(report, 'utf8');
    assert.equal(JSON.parse(saved).artifact.id, 'a2');
    assert.equal((await stat(report)).mode & 0o777, 0o600);
    assert.throws(() => execFileSync(process.execPath, args, { stdio: 'pipe' }));
    assert.equal(await readFile(report, 'utf8'), saved);
    assert.throws(() => execFileSync(process.execPath, [cli, 'compare', '--session', session, '--engine', 'remote'], { stdio: 'pipe' }), /allow-remote/);
    assert.throws(() => execFileSync(process.execPath, [cli, 'compare', '--session', session, '--engine', 'local', '--python', join(dir, 'missing-python')], { stdio: 'pipe' }), /Python/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('capture excludes internal continuation instructions from user prompts', () => {
  const message = (role, text) => ({ type: 'response_item', payload: { type: 'message', role, content: [{ type: role === 'user' ? 'input_text' : 'output_text', text }] } });
  const result = parseCodex([
    message('user', '请给我一份计划。'),
    message('user', '<codex_internal_context source="goal">Internal continuation</codex_internal_context>'),
    message('assistant', '这是一份计划。'),
  ].map(JSON.stringify).join('\n'));
  assert.equal(result.turns.length, 1);
  assert.equal(result.turns[0].text, '请给我一份计划。');
});

test('remote headless check sends only eligible text and uses returned semantic vectors', async (t) => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    sent = JSON.parse(options.body).input;
    return new Response(JSON.stringify({ data: sent.map((text, index) => ({ index, embedding: text.includes('CSV') ? [0, 1] : [1, 0] })).reverse() }));
  });
  const result = await compareSession(sample, {
    artifactId: 'a1', engine: 'remote',
    remote: { url: 'https://embeddings.example.test/v1/embeddings', key: 'test-only', model: 'mock' },
  });
  assert.equal(result.semantic, true);
  assert.ok(!sent.some(text => text.includes('版本记录')));
  assert.equal(result.coverage[0].score, 1);
  assert.equal(result.coverage[1].score, 0);
});
