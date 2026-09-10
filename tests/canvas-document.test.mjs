import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareDocument, inlineTokens } from '../public/canvas/document.mjs';
import { sentences, compare } from '../public/canvas/core.mjs';
import { demo } from '../public/canvas/demo.mjs';
import { demoVectors, demoModel } from '../public/canvas/demo-vectors.mjs';

test('Markdown keeps document structure and compares body sentences without heading syntax', () => {
  const doc = prepareDocument(
    '# 标题\n\n保留**粗体**。第二句。\n\n## 小标题\n\n- 一个要求。\n- 第二个要求。\n\n> 引用要求。\n\n```md\n# literal heading\n```',
  );
  assert.deepEqual(
    doc.blocks.map((b) => b.type),
    ['heading', 'paragraph', 'heading', 'list', 'quote', 'code'],
  );
  assert.deepEqual(
    doc.units.map((u) => u.text),
    [
      '保留粗体。',
      '第二句。',
      '一个要求。',
      '第二个要求。',
      '引用要求。',
      '# literal heading',
    ],
  );
  assert.equal(doc.blocks[0].units.length, 0);
  assert.deepEqual(
    doc.units.map((u) => u.index),
    [0, 1, 2, 3, 4, 5],
  );
});
test('blank lines, tables and code fences do not create phantom scored sentences', () => {
  const doc = prepareDocument(
    '### 标题\n\n\n| 内容 | 状态 |\n| --- | --- |\n| 支持本地。 | 已保留 |\n\n~~~html\n<script>alert(1)</script>\n~~~',
  );
  assert.equal(doc.blocks[1].type, 'table');
  assert.deepEqual(
    doc.units.map((u) => u.text),
    ['支持本地。', '已保留', '<script>alert(1)</script>'],
  );
  assert.ok(doc.blocks[1].header.every((cell) => cell.units.length === 0));
  const inline = inlineTokens(
    '[link](javascript:alert(1)) ![image](https://example.org/private.png)',
  );
  assert.ok(
    inline.every((token) => !['a', 'img', 'script'].includes(token.tag)),
  );
});
test('sentence offsets reconstruct inline text, including emoji and hard wraps', () => {
  const doc = prepareDocument('**第一句😀。第二句。**\n下一行 `code`。');
  const block = doc.blocks[0];
  assert.equal(
    block.units.map((unit) => block.plain.slice(unit.start, unit.end)).join(''),
    block.plain,
  );
  assert.equal(
    block.tokens.filter((token) => token.tag === 'strong').length,
    1,
  );
  assert.equal(
    prepareDocument('# literal\n**source**', 'text').units[0].text,
    '# literal',
  );
});
test('bundled demo semantics are reproducible, cover both artifacts and recompute per selection', () => {
  const source = demo.turns.flatMap((turn) =>
    sentences(turn.text)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((text) => ({ text, turnId: turn.id })),
  );
  const targets = demo.artifacts.map((artifact) =>
    prepareDocument(artifact.text, artifact.format).units.map((u) => u.text),
  );
  const texts = [...new Set([...source.map((s) => s.text), ...targets.flat()])];
  assert.equal(
    createHash('sha256').update(JSON.stringify(texts)).digest('hex'),
    demoModel.textHash,
  );
  assert.ok(texts.every((text) => demoVectors[text]?.length === 384));
  const all = compare(source, targets[1], demoVectors);
  const firstTurn = compare(
    source.filter((s) => s.turnId === 't1'),
    targets[1],
    demoVectors,
  );
  assert.equal(all.semantic, true);
  assert.ok(all.rows.some((row) => row.candidates[0].score > 0.85));
  assert.ok(all.rows.some((row) => row.candidates[0].score < 0.5));
  assert.notDeepEqual(all.coverage, firstTurn.coverage);
  assert.ok(
    all.rows.some(
      (row, i) =>
        row.candidates[0].score !== firstTurn.rows[i].candidates[0].score,
    ),
  );
});
