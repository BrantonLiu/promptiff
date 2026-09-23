# Promptiff · Prompt Comparison Canvas for Agents

[![English](https://img.shields.io/badge/README-English-2563eb?style=for-the-badge)](README.md)
[![简体中文](https://img.shields.io/badge/README-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-d1d5db?style=for-the-badge)](README.zh-CN.md)

Read one or more user prompts alongside a selected AI response to spot changes, omissions, and additions. Promptiff supports semantic, word-level, Git, and character-by-character comparisons, plus a standalone source preview. It can display Markdown, plain text, JSON, CSV, HTML source, and code.

This repository contains a standalone local CLI, canvas, and Skill. The hosted website, sign-in, feedback database, and production deployment configuration live in a separate repository.

For the rename and upgrade steps for existing installations, see [Switching to Promptiff](docs/rename-promptiff.md).

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
