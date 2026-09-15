import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cosine, MAX_SENTENCES, MAX_TEXT } from '../public/canvas/core.mjs';
export function validateTexts(texts) {
  if (
    !Array.isArray(texts) ||
    !texts.length ||
    texts.length > MAX_SENTENCES ||
    texts.some(
      (t) => typeof t !== 'string' || !t.trim() || Array.from(t).length > 100,
    ) ||
    texts.reduce((n, t) => n + t.length, 0) > MAX_TEXT
  )
    throw new Error(
      '需要 1–600 个非空句子，每句最多 100 字符，总计最多 60,000 字符。',
    );
}
export function validateVectors(vectors, count) {
  if (!Array.isArray(vectors) || vectors.length !== count)
    throw new Error('API 返回的向量数量不匹配。');
  const dims = vectors[0]?.length;
  if (!dims || dims > 8192) throw new Error('API 返回的向量维度无效。');
  for (const v of vectors) {
    if (v.length !== dims) throw new Error('API 返回的向量维度不一致。');
    cosine(v, v);
  }
  return vectors;
}
export function remoteConfig(env, allowRemote) {
  if (!allowRemote)
    throw new Error(
      '远程模式需要 --allow-remote，明确允许发送所选 prompt 与产出。',
    );
  if (!env.PROMPTIFF_API_URL || !env.PROMPTIFF_API_KEY || !env.PROMPTIFF_MODEL)
    throw new Error('请配置 PROMPTIFF_API_URL、PROMPTIFF_API_KEY、PROMPTIFF_MODEL。');
  const url = new URL(env.PROMPTIFF_API_URL);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      '远程 API 必须是无用户名、密码或查询参数的 HTTPS embeddings 地址。',
    );
  return { url: url.href, key: env.PROMPTIFF_API_KEY, model: env.PROMPTIFF_MODEL };
}
export async function embeddings(
  texts,
  { engine, python = 'python3', remote },
) {
  validateTexts(texts);
  if (engine === 'remote') {
    const response = await fetch(remote.url, {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${remote.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: remote.model,
        input: texts,
        encoding_format: 'float',
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok)
      throw new Error(
        `远程 API 返回 HTTP ${response.status}；请检查配置与额度。`,
      );
    const data = await response.json();
    if (!Array.isArray(data.data) || data.data.length !== texts.length)
      throw new Error('远程 API 返回格式不正确。');
    const ordered = [...data.data].sort((a, b) => a.index - b.index);
    if (ordered.some((row, i) => row.index !== i))
      throw new Error('远程 API 返回了缺失或重复的向量 index。');
    return validateVectors(
      ordered.map((row) => row.embedding),
      texts.length,
    );
  }
  if (engine !== 'local') throw new Error('字面模式无需调用语义模型。');
  return new Promise((resolve, reject) => {
    const child = spawn(
      python,
      [fileURLToPath(new URL('./embeddings.py', import.meta.url))],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let output = '',
      error = '',
      settled = false;
    const finish = (failure, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (failure) reject(failure);
      else resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(new Error('本地模型超时（5 分钟），请确认模型已下载后重试。'));
    }, 300000);
    child.stdout.on('data', (chunk) => {
      output += chunk;
      if (output.length > 50000000) {
        child.kill();
        finish(new Error('模型输出超过限制。'));
      }
    });
    child.stderr.on('data', (chunk) => {
      error = (error + chunk).slice(-3000);
    });
    child.on('error', () =>
      finish(
        new Error('无法启动 Python；请使用 --python 指向已安装依赖的环境。'),
      ),
    );
    child.on('close', (code) => {
      if (code !== 0) {
        finish(
          new Error(
            '本地模型未完成计算。请检查 Python 依赖、模型缓存和句子长度。',
          ),
        );
        if (error)
          process.stderr.write(
            '本地模型运行失败；可直接运行 cli/embeddings.py 诊断。\n',
          );
        return;
      }
      try {
        finish(null, validateVectors(JSON.parse(output), texts.length));
      } catch {
        finish(new Error('本地模型返回了无效向量。'));
      }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(texts));
  });
}
