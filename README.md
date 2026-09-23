# Promptiff · Prompt Comparison Canvas for Agents

[![English](https://img.shields.io/badge/README-English-2563eb?style=for-the-badge)](README.md)
[![简体中文](https://img.shields.io/badge/README-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-d1d5db?style=for-the-badge)](README.zh-CN.md)

Read one or more user prompts alongside a selected AI response to spot changes, omissions, and additions. Promptiff supports semantic, word-level, Git, and character-by-character comparisons, plus a standalone source preview. It can display Markdown, plain text, JSON, CSV, HTML source, and code.

This repository contains a standalone local CLI, canvas, and Skill. The hosted website, sign-in, feedback database, and production deployment configuration live in a separate repository.

For the rename and upgrade steps for existing installations, see [Switching to Promptiff](docs/rename-promptiff.md).

## Copy this prompt to your agent

Use the copy button on the block below, then paste it into **Codex, Claude Code, or OpenClaw**. The agent can set up Promptiff and open a comparison for the current task. You need Node.js 22.13 or later on the machine running the agent.

```text
Set up Promptiff for this task and compare my original requests with the AI output I choose. Read https://github.com/BrantonLiu/promptiff/blob/main/docs/agent-canvas.md first.

Use an existing Promptiff checkout or clone https://github.com/BrantonLiu/promptiff.git into a dedicated tools directory. Confirm it contains cli/promptiff.mjs and that Node.js is 22.13 or later. If your environment supports Skills, install the included Skill in its appropriate Skills directory without overwriting an existing installation; otherwise use the CLI directly.

Use only the original user prompts visible in this task and the output I select. Preserve their turn order; exclude system instructions, tool logs, credentials, and unrelated conversations. In Codex, you may use `capture --current` if the current task log is available. In Claude Code or OpenClaw, or if capture is unavailable, create the documented session JSON from visible content without inventing missing text.

Run `compare` with the default lexical engine, inspect possible omissions and additions in both directions, then run `serve` on the same session. Open the full local URL and give it to me with a short summary of what you found. Keep the server running while I review it. If you run on a different machine, explain how I can access that local URL. Use a local semantic model only if I request it; use a remote model only after I explicitly authorize uploading the selected text.
```

For exact commands, the session format, and model options, see the [agent integration guide](docs/agent-canvas.md). Installing the Skill alone does not make every future task run a comparison automatically.

## Try it

Requires Node.js 22.13 or later. The basic features run without installing npm dependencies:

```sh
git clone https://github.com/BrantonLiu/promptiff.git
cd promptiff
node cli/promptiff.mjs serve --session examples/session.json
```

Open the full local URL printed in the terminal. The server listens only on `127.0.0.1`. Leave the process running while you use the canvas, then press Ctrl-C to stop it. In Settings, you can import a session JSON file or paste your own prompts and responses.

## Use it with an agent

```sh
node cli/promptiff.mjs install --target ~/.agents/skills
node cli/promptiff.mjs capture --current --out /absolute/private/path/session.json
node cli/promptiff.mjs compare --session /absolute/private/path/session.json --out /absolute/private/path/report.json
node cli/promptiff.mjs serve --session /absolute/private/path/session.json
```

The installer leaves existing Skills alone. `capture` collects data only from the current Codex task environment; you can also prepare the JSON by hand. The [agent integration guide](docs/agent-canvas.md) includes copyable instructions, the data format, and model configuration. Promptiff currently ships as a Skill and CLI and is not listed in a public plugin marketplace.

To include a comparison with each document delivery, give your agent the “Document delivery convention” from the integration guide. It saves the delivered text, runs `compare` to check matches in both directions, then opens the canvas and includes its local link. Installing the Skill does not enable it automatically for every task. Use the convention in the current task, or add it to project rules to reuse it across tasks. Agents such as OpenClaw can create the same session JSON without Codex logs.

## How comparisons work

- **lexical**: Uses literal matching by default. It downloads no model and sends no text.
- **local**: Runs sentence-embedding comparisons in a local Python environment after you install `cli/requirements.txt`. The first run downloads a pinned model version.
- **remote**: Connects to your own embeddings API. You must explicitly select it, configure environment variables, and pass `--allow-remote`.

The demo includes precomputed sentence embeddings. Until you connect a model, your own text appears as a literal preview and does not receive a demo score. Similarity scores cannot confirm that requirements were met; check changes to negation, numbers, and subjects yourself.

## Development

```sh
npm ci
npm test
npm run lint
```

The canvas uses plain HTML, CSS, and JavaScript. It needs no web framework, build step, or cloud account. See the [development guide](docs/development.md) and [comparison methods](docs/methodology.md).

The code is licensed under the [MIT License](LICENSE). Demo text was assembled from project requirements. Its example rewrite deliberately includes deviations and does not represent a delivery record. Do not put personal sessions, credentials, or materials you are not authorized to share in public test data.

Older commits and branches may still contain the website source from before the project was split. This repository's Git history has not been rewritten.
