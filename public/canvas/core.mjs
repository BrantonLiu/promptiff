// Shared by the browser and the dependency-free local CLI.
export const MAX_TEXT = 60000;
export const MAX_SENTENCES = 600;
export function sentences(text) {
  // Keep every character, including punctuation and whitespace.
  const parts =
    text.match(/[\s\S]+?(?:[。！？!?；;\n]+|[.](?=\s|$)|$)/gu) || [];
  return parts.flatMap((part) => {
    const chars = Array.from(part);
    const result = [];
    for (let i = 0; i < chars.length; i += 100)
      result.push(chars.slice(i, i + 100).join(''));
    return result;
  });
}
export function validateSession(value) {
  if (
    !value ||
    value.version !== 1 ||
    typeof value.title !== 'string' ||
    !Array.isArray(value.turns) ||
    !Array.isArray(value.artifacts)
  )
    throw new Error('需要 version: 1、title、turns 和 artifacts 的会话 JSON。');
  if (
    !value.turns.length ||
    !value.artifacts.length ||
    value.turns.length > 100 ||
    value.artifacts.length > 50
  )
    throw new Error('会话须包含 1–100 轮 prompt 和 1–50 个产出物。');
  const ids = new Set();
  let size = 0;
  const turns = value.turns.map((turn) => {
    if (
      !turn ||
      typeof turn.id !== 'string' ||
      !turn.id ||
      ids.has(turn.id) ||
      typeof turn.text !== 'string' ||
      !turn.text.trim()
    )
      throw new Error('Prompt 必须有唯一 id 和非空 text。');
    ids.add(turn.id);
    size += turn.text.length;
    return {
      id: turn.id,
      text: turn.text,
      label: typeof turn.label === 'string' ? turn.label : turn.id,
    };
  });
  const artifactIds = new Set();
  const artifacts = value.artifacts.map((item) => {
    if (
      !item ||
      typeof item.id !== 'string' ||
      !item.id ||
      artifactIds.has(item.id) ||
      typeof item.text !== 'string' ||
      !item.text.trim() ||
      !ids.has(item.turnId)
    )
      throw new Error('产出物需要唯一 id、非空 text 和有效 turnId。');
    artifactIds.add(item.id);
    size += item.text.length;
    return {
      id: item.id,
      title: typeof item.title === 'string' ? item.title : item.id,
      text: item.text,
      turnId: item.turnId,
      format: ['text', 'markdown', 'json', 'csv', 'code', 'html'].includes(
        item.format,
      )
        ? item.format
        : 'text',
    };
  });
  if (size > MAX_TEXT)
    throw new Error('单个会话最多 60,000 字符，请缩小导出范围。');
  return { version: 1, title: value.title.slice(0, 200), turns, artifacts };
}
function grams(text) {
  const chars = Array.from(text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''));
  return new Set(
    chars.length < 2 ? chars : chars.slice(1).map((c, i) => chars[i] + c),
  );
}
export function lexical(a, b) {
  if (a === b) return 1;
  const x = grams(a),
    y = grams(b);
  if (!x.size || !y.size) return 0;
  return (2 * [...x].filter((item) => y.has(item)).length) / (x.size + y.size);
}
export function cosine(a, b) {
  if (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    !a.length ||
    a.length !== b.length ||
    [...a, ...b].some((n) => !Number.isFinite(n))
  )
    throw new Error('无效的语义向量。');
  const normA = Math.hypot(...a),
    normB = Math.hypot(...b);
  if (!normA || !normB) throw new Error('语义向量不能为零。');
  return Math.max(
    -1,
    Math.min(1, a.reduce((sum, n, i) => sum + n * b[i], 0) / normA / normB),
  );
}
export function compare(source, target, vectors = null) {
  if (!source.length || !target.length)
    throw new Error('请选择至少一轮 prompt 和一个非空产出物。');
  if (source.length + target.length > MAX_SENTENCES)
    throw new Error('本次比对最多 600 个句子，请减少轮次或缩短产出物。');
  const score = vectors ? (a, b) => cosine(vectors[a], vectors[b]) : lexical;
  const matrix = target.map((text) =>
    source.map((ref) => score(text, ref.text)),
  );
  const rows = target.map((text, i) => ({
    text,
    index: i,
    candidates: matrix[i]
      .map((value, index) => ({ index, score: value }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3),
  }));
  const coverage = source.map((ref, i) => ({
    ...ref,
    index: i,
    score: Math.max(...matrix.map((row) => row[i])),
  }));
  return { rows, coverage, semantic: !!vectors };
}
export function diff(a, b) {
  // Bounded sentence-sized character LCS. Full documents are compared by rows.
  const x = Array.from(a),
    y = Array.from(b);
  if (x.length * y.length > 1000000)
    return [
      { type: 'delete', text: a },
      { type: 'insert', text: b },
    ];
  const grid = Array.from(
    { length: x.length + 1 },
    () => new Uint32Array(y.length + 1),
  );
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--)
      grid[i][j] =
        x[i] === y[j]
          ? grid[i + 1][j + 1] + 1
          : Math.max(grid[i + 1][j], grid[i][j + 1]);
  const ops = [];
  function add(type, text) {
    const last = ops.at(-1);
    if (last?.type === type) last.text += text;
    else ops.push({ type, text });
  }
  let i = 0,
    j = 0;
  while (i < x.length || j < y.length) {
    if (i < x.length && j < y.length && x[i] === y[j]) {
      add('equal', x[i]);
      i++;
      j++;
    } else if (
      i < x.length &&
      (j === y.length || grid[i + 1][j] >= grid[i][j + 1])
    )
      add('delete', x[i++]);
    else add('insert', y[j++]);
  }
  return ops;
}
