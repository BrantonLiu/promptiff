import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('CLI invoked through a symlink runs help and captures a selected session', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wordiff-cli-entry-'));
  try {
    const cli = join(dir, 'wordiff.mjs');
    await symlink(fileURLToPath(new URL('../cli/wordiff.mjs', import.meta.url)), cli);
    assert.match(execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' }), /capture --current/);
    const input = join(dir, 'rollout.jsonl');
    const output = join(dir, 'session.json');
    await writeFile(input, [
      { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Keep data local.' }] } },
      { type: 'response_item', payload: { type: 'message', role: 'assistant', phase: 'final_answer', content: [{ type: 'output_text', text: 'Data stays local.' }] } },
    ].map(JSON.stringify).join('\n') + '\n');
    execFileSync(process.execPath, [cli, 'capture', '--codex-session', input, '--out', output]);
    const data = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(data.turns[0].text, 'Keep data local.');
    assert.equal(data.artifacts[0].text, 'Data stays local.');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
