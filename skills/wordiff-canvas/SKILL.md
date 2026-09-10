---
name: wordiff-canvas
description: Compare user prompts from one or more conversation turns against a chosen AI text artifact in a local Wordiff canvas. Use when the user wants to inspect semantic distance, changed wording, or omitted requirements in Agent outputs.
---

# Wordiff canvas

Use the current conversation's user prompts verbatim and the user's chosen AI artifact. Do not substitute your summary for the original prompts. Preserve turn order; an artifact's `turnId` is the last user turn available when it was produced. Do not include later requirements as if the artifact had already seen them.

The installed skill contains a standalone CLI and canvas in `runtime/`. Run commands relative to this skill's absolute directory. If working from the source repository instead of an installed copy, use the repository's `cli/wordiff.mjs` (the installer creates `runtime/`). Requires Node 22.13 or later; the basic CLI needs no npm dependencies.

## Capture

For Codex with `CODEX_THREAD_ID`, run:

```sh
node runtime/cli/wordiff.mjs capture --current --out /absolute/private/path/session.json
```

This selects a single log matching that ID. It does not fall back to other recent sessions. Inspect the exported prompt/artifact range before presenting it. Codex log formats are an adapter, not a stable public API; if capture fails, use the visible conversation to write the JSON below. For other Agents, use this same JSON contract. Never claim access to invisible or compacted turns. Export only the user-authorized conversation scope; exclude system/developer instructions, tool logs, credentials and unrelated sessions. If exact original text is unavailable, state the gap instead of reconstructing it.

```json
{
  "version": 1,
  "title": "Current conversation",
  "turns": [{"id": "t1", "label": "01 · User prompt", "text": "Original user text"}],
  "artifacts": [{"id": "a1", "title": "Proposal.md", "turnId": "t1", "format": "markdown", "text": "Exact chosen AI output"}]
}
```

Limits: 100 turns, 50 artifacts, 60,000 total characters per session; 600 sentence units per comparison. Text, Markdown, JSON, CSV, HTML source and code are supported. PDF, DOCX and images require explicit text extraction by the Agent first; record that the imported artifact is extracted text. Do not call that a layout comparison.

## Open

```sh
node runtime/cli/wordiff.mjs serve --session /absolute/private/path/session.json --engine lexical
```

Keep the process running and return its complete loopback URL, including the token fragment. If the host has an available browser-panel tool, open the URL there; otherwise give a clickable browser link. Do not invent a sidebar API. Stop the owned process when requested. Add multiple `--session` arguments only for user-selected historical conversations.

The default is character-bigram matching, clearly labeled as lexical. For semantic comparisons, respect the user's chosen compute mode:

- **Local:** create an isolated Python environment, install `runtime/cli/requirements.txt`, then pass `--engine local --python /absolute/venv/bin/python`. The first run downloads the pinned multilingual model from Hugging Face; article text is processed on local CPU. Wait for a successful calculation before claiming semantic results.
- **Remote:** requires the user's choice to upload the selected prompt/artifact text. Configure `WORDIFF_API_URL` (complete HTTPS embeddings endpoint), `WORDIFF_API_KEY`, and `WORDIFF_MODEL` in the process environment, then pass `--engine remote --allow-remote`. Do not put keys in the session JSON, browser, command arguments or Git. This is a bring-your-own-API integration, not an available Wordiff paid plan.

Similarity is not entailment or a percentage of intent fulfilled. Read both directions: output sentences lacking prompt matches and prompt sentences lacking output matches. Check negation, numeric constraints and changed entities directly. Multiple selected turns are compared together without silently resolving contradictions between them.
