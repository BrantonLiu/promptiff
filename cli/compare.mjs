import { compare, sentences, validateSession, MAX_SENTENCES } from '../public/canvas/core.mjs';
import { prepareDocument } from '../public/canvas/document.mjs';
import { embeddings } from './engine.mjs';

// Use the same sentence units and matching as the canvas, before opening a browser.
export async function compareSession(value, { artifactId, engine = 'lexical', python, remote } = {}) {
  const session = validateSession(value);
  if (!['lexical', 'local', 'remote'].includes(engine)) throw new Error('无效的计算方式。');
  const artifact = artifactId
    ? session.artifacts.find((item) => item.id === artifactId)
    : session.artifacts.at(-1);
  if (!artifact) throw new Error('找不到指定的产出物。');
  const turns = session.turns.slice(0, session.turns.findIndex((turn) => turn.id === artifact.turnId) + 1);
  const source = turns.flatMap((turn) => sentences(turn.text)
    .map((text) => text.trim()).filter(Boolean)
    .map((text) => ({ text, turnId: turn.id, label: turn.label })));
  const target = prepareDocument(artifact.text, artifact.format).units.map((unit) => unit.text);
  if (!source.length || !target.length) throw new Error('Prompt 与产出物须包含可比对的正文。');
  if (source.length + target.length > MAX_SENTENCES) throw new Error('本次比对最多 600 个句子，请减少轮次或缩短产出物。');
  let vectors = null;
  if (engine !== 'lexical') {
    const texts = [...new Set([...source.map((item) => item.text), ...target])];
    const values = await embeddings(texts, { engine, python, remote });
    vectors = Object.fromEntries(texts.map((text, index) => [text, values[index]]));
  }
  return {
    version: 1,
    title: session.title,
    artifact: { id: artifact.id, title: artifact.title, turnId: artifact.turnId },
    turnIds: turns.map((turn) => turn.id),
    engine,
    source,
    ...compare(source, target, vectors),
    note: '匹配分数用于定位待核对内容，不代表要求满足率；请复核否定、数字、主体及多轮要求的冲突。',
  };
}
