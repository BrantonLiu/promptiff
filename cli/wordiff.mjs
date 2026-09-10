#!/usr/bin/env node
import { createServer } from 'node:http';
import { realpathSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import {
  readFile,
  writeFile,
  mkdir,
  cp,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadSession, parseCodex, findCurrentSession } from './session.mjs';
import { embeddings, remoteConfig } from './engine.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const help = `Wordiff — Agent 比对画布 (Node >=22.13)

  node cli/wordiff.mjs install [--target ~/.agents/skills]
  node cli/wordiff.mjs capture --current --out session.json
  node cli/wordiff.mjs capture --codex-session /path/rollout.jsonl --out session.json
  node cli/wordiff.mjs serve --session session.json [--session other.json]
       [--engine lexical|local|remote] [--python /path/python] [--port 0]
       [--allow-remote]

默认 lexical：无需依赖、不发送文本。local 需先安装 cli/requirements.txt。
remote 需 WORDIFF_API_URL（完整 HTTPS embeddings URL）、WORDIFF_API_KEY、WORDIFF_MODEL。
服务仅绑定 127.0.0.1。Ctrl-C 关闭；浏览器导入不写磁盘。\n`;
export async function installSkill(target) {
  const destination = join(resolve(target), 'wordiff-canvas');
  try {
    await stat(destination);
    throw new Error(`目标已存在，未覆盖：${destination}`);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  await mkdir(dirname(destination), { recursive: true });
  const staging = `${destination}.tmp-${randomBytes(5).toString('hex')}`;
  try {
    await cp(join(root, 'skills/wordiff-canvas'), staging, { recursive: true });
    await mkdir(join(staging, 'runtime/public'), { recursive: true });
    await cp(join(root, 'cli'), join(staging, 'runtime/cli'), {
      recursive: true,
    });
    await cp(
      join(root, 'public/canvas'),
      join(staging, 'runtime/public/canvas'),
      { recursive: true },
    );
    await rename(staging, destination);
  } catch (e) {
    await rm(staging, { recursive: true, force: true });
    throw e;
  }
  return destination;
}
export function startServer({
  sessions,
  engine = 'lexical',
  python,
  remote,
  port = 0,
}) {
  const token = randomBytes(32).toString('hex');
  const staticFiles = new Map([
    ['/', 'index.html'],
    ['/canvas/index.html', 'index.html'],
    ['/canvas.mjs', 'canvas.mjs'],
    ['/core.mjs', 'core.mjs'],
    ['/canvas.css', 'canvas.css'],
    ['/canvas/canvas.mjs', 'canvas.mjs'],
    ['/canvas/core.mjs', 'core.mjs'],
    ['/canvas/canvas.css', 'canvas.css'],
    ...['document.mjs', 'demo.mjs', 'demo-vectors.mjs'].flatMap((name) => [
      [`/${name}`, name],
      [`/canvas/${name}`, name],
    ]),
  ]);
  let busy = false;
  const server = createServer(async (req, res) => {
    const address = server.address();
    const host = `127.0.0.1:${address.port}`;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'",
    );
    function json(code, value) {
      res.writeHead(code, {
        'Content-Type': 'application/json; charset=utf-8',
      });
      res.end(JSON.stringify(value));
    }
    if (
      req.headers.host !== host ||
      (req.headers.origin && req.headers.origin !== `http://${host}`)
    ) {
      json(403, { error: '只接受本地画布请求。' });
      return;
    }
    const url = new URL(req.url, `http://${host}`);
    try {
      if (url.pathname.startsWith('/api/')) {
        if (req.headers.authorization !== `Bearer ${token}`) {
          json(401, { error: '需要当前本地会话令牌。' });
          return;
        }
        if (url.pathname === '/api/session' && req.method === 'GET') {
          json(200, {
            sessions,
            capabilities: {
              engine,
              endpoint: remote ? new URL(remote.url).host : undefined,
            },
          });
          return;
        }
        if (url.pathname === '/api/embeddings' && req.method === 'POST') {
          if (engine === 'lexical') {
            json(409, {
              error: '请使用 --engine local 或 remote 重新启动服务。',
            });
            return;
          }
          if (busy) {
            json(429, { error: '上一次计算尚未结束，请稍后再试。' });
            return;
          }
          busy = true;
          try {
            if (!req.headers['content-type']?.startsWith('application/json')) {
              json(415, { error: '需要 application/json。' });
              return;
            }
            let size = 0;
            const chunks = [];
            for await (const chunk of req) {
              size += chunk.length;
              if (size > 500000) {
                json(413, { error: '请求体过大。' });
                return;
              }
              chunks.push(chunk);
            }
            let payload;
            try {
              payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            } catch {
              json(400, { error: '无效 JSON。' });
              return;
            }
            const vectors = await embeddings(payload.texts, {
              engine,
              python,
              remote,
            });
            json(200, { vectors });
          } catch (e) {
            json(422, { error: e.message });
          } finally {
            busy = false;
          }
          return;
        }
        json(404, { error: '接口不存在。' });
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        json(405, { error: '不支持的方法。' });
        return;
      }
      const name = staticFiles.get(url.pathname);
      if (!name) {
        json(404, { error: '页面不存在。' });
        return;
      }
      const body = await readFile(join(root, 'public/canvas', name));
      res.writeHead(200, {
        'Content-Type': name.endsWith('.html')
          ? 'text/html; charset=utf-8'
          : name.endsWith('.css')
            ? 'text/css; charset=utf-8'
            : 'text/javascript; charset=utf-8',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      if (!res.headersSent) json(500, { error: '本地服务读取失败。' });
      else res.end();
    }
  });
  server.requestTimeout = 310000;
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () =>
      resolve({
        server,
        url: `http://127.0.0.1:${server.address().port}/#token=${token}`,
        token,
      }),
    );
  });
}
async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      target: { type: 'string' },
      session: { type: 'string', multiple: true },
      'codex-session': { type: 'string' },
      current: { type: 'boolean' },
      out: { type: 'string' },
      engine: { type: 'string' },
      python: { type: 'string' },
      port: { type: 'string' },
      'allow-remote': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const command = positionals[0];
  if (values.help || !command) {
    process.stdout.write(help);
    return;
  }
  if (command === 'install') {
    const path = await installSkill(
      values.target || join(homedir(), '.agents/skills'),
    );
    process.stdout.write(
      `Skill 已安装：${path}\n可直接读取其中 SKILL.md 开始使用。\n`,
    );
    return;
  }
  if (command === 'capture') {
    if (
      !values.out ||
      (!values.current && !values['codex-session']) ||
      (values.current && values['codex-session'])
    )
      throw new Error(
        'capture 需要 --out 和 --current / --codex-session 二选一。',
      );
    const path =
      values['codex-session'] ||
      (await findCurrentSession(
        join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'sessions'),
        process.env.CODEX_THREAD_ID,
      ));
    const session = parseCodex(await readFile(path, 'utf8'));
    await writeFile(resolve(values.out), JSON.stringify(session, null, 2), {
      flag: 'wx',
      mode: 0o600,
    });
    process.stdout.write(
      `已保存 ${session.turns.length} 轮 prompt、${session.artifacts.length} 个产出：${resolve(values.out)}\n请检查原文范围；不完整或压缩后的上下文不能自动恢复。\n`,
    );
    return;
  }
  if (command !== 'serve') throw new Error(`未知命令：${command}`);
  if (!values.session?.length)
    throw new Error('serve 需要至少一个 --session 文件。');
  const engine = values.engine || 'lexical';
  if (!['lexical', 'local', 'remote'].includes(engine))
    throw new Error('engine 仅支持 lexical、local、remote。');
  const port = Number(values.port || 0);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('端口必须为 0–65535 的整数。');
  if (values.session.length > 20) throw new Error('一次最多加载 20 个会话。');
  const sessions = await Promise.all(values.session.map(loadSession));
  const remote =
    engine === 'remote'
      ? remoteConfig(process.env, values['allow-remote'])
      : undefined;
  const { server, url } = await startServer({
    sessions,
    engine,
    python: values.python,
    remote,
    port,
  });
  process.stdout.write(
    `Wordiff 画布已就绪：${url}\n计算：${engine}${remote ? `（发送所选文本至 ${new URL(remote.url).host}）` : '（文本保留本地）'}\n保持此进程运行。Ctrl-C 关闭。\n`,
  );
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => server.close(() => process.exit(0)));
}
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    process.stderr.write(`Wordiff: ${error.message}\n`);
    process.exitCode = 1;
  });
