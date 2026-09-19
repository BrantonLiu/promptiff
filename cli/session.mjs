import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateSession } from '../public/canvas/core.mjs';

export function parseCodex(text) {
  const lines = text.trim().split('\n');
  const records = lines.flatMap((line, index) => {
    try {
      return [JSON.parse(line)];
    } catch {
      if (index === lines.length - 1) return [];
      throw new Error(`会话日志第 ${index + 1} 行不是有效 JSON。`);
    }
  });
  // Prefer response_item; event_msg duplicates these in many Codex versions.
  const messages = records.filter(
    (r) =>
      r.type === 'response_item' &&
      r.payload?.type === 'message' &&
      ['user', 'assistant'].includes(r.payload.role),
  );
  const turns = [],
    artifacts = [];
  function add(role, content, phase) {
    if (typeof content !== 'string' || !content.trim()) return;
    // Environment/skill injections are not user prompts. Do not export them.
    if (
      role === 'user' &&
      /^\s*(?:<environment_context>|<permissions instructions>|<INSTRUCTIONS>|# AGENTS\.md instructions|<recommended_plugins>|<codex_internal_context\b)/.test(
        content,
      )
    )
      return;
    if (role === 'user') {
      const id = `t${turns.length + 1}`;
      turns.push({
        id,
        label: `${turns.length + 1} · 用户 prompt`,
        text: content,
      });
    } else if (turns.length && (!phase || phase === 'final_answer'))
      artifacts.push({
        id: `a${artifacts.length + 1}`,
        title: `第 ${turns.length} 轮 · AI 产出 ${artifacts.length + 1}`,
        text: content,
        format: 'markdown',
        turnId: turns.at(-1).id,
      });
  }
  if (messages.length)
    for (const { payload } of messages)
      add(
        payload.role,
        (payload.content || [])
          .filter((c) => ['input_text', 'output_text', 'text'].includes(c.type))
          .map((c) => c.text || '')
          .join('\n'),
        payload.phase,
      );
  else
    for (const { type, payload } of records) {
      if (type !== 'event_msg') continue;
      if (payload?.type === 'user_message') add('user', payload.message);
      if (payload?.type === 'agent_message')
        add('assistant', payload.message, payload.phase);
    }
  return validateSession({
    version: 1,
    title: 'Codex · 当前会话',
    turns,
    artifacts,
  });
}
export async function findCurrentSession(root, threadId) {
  if (!threadId || !/^[a-zA-Z0-9-]{8,80}$/.test(threadId))
    throw new Error(
      '缺少 CODEX_THREAD_ID；请指定 --codex-session 日志路径，或让 Agent 导出 session.json。',
    );
  const matches = [];
  async function walk(dir, depth = 0) {
    if (depth > 4) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (e) {
      if (e.code === 'ENOENT') return;
      throw e;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path, depth + 1);
      else if (entry.isFile() && entry.name.endsWith(`-${threadId}.jsonl`))
        matches.push(path);
    }
  }
  await walk(root);
  if (matches.length !== 1)
    throw new Error(
      `当前任务找到 ${matches.length} 个匹配日志；请显式指定 --codex-session。不会改用最近的其他会话。`,
    );
  return matches[0];
}
export async function loadSession(path) {
  return validateSession(JSON.parse(await readFile(path, 'utf8')));
}
