---
name: promptiff-canvas
description: Compare user prompts against an AI document and return a local comparison link. Use for explicit comparisons or before delivering a document when the user has enabled automatic Promptiff checks in the current task or project rules.
---

# Promptiff canvas

Use the current conversation's user prompts verbatim and the user's chosen AI artifact. Do not substitute your summary for the original prompts. Preserve turn order; an artifact's `turnId` is the last user turn available when it was produced. Do not include later requirements as if the artifact had already seen them.

The installed skill contains a standalone CLI and canvas in `runtime/`. Run commands relative to this skill's absolute directory. If working from the source repository instead of an installed copy, use the repository's `cli/promptiff.mjs` (the installer creates `runtime/`). Requires Node 22.13 or later; the basic CLI needs no npm dependencies.

## Capture

When the user has enabled automatic document checks, apply this workflow to each new or revised document in that scope, not to progress updates or casual replies. Installing the skill alone does not enable a universal hook or grant access to all sessions. Across tasks, follow an explicit project rule if present; do not modify global Agent configuration to create one.

Before delivery, save the actual document and include its exact text in a fresh session JSON. `capture` only sees messages already recorded: the pending final response and files merely linked in a reply are not automatically included. Append the saved document as the selected artifact, or prepare a scoped JSON directly. Never compare the summary in place of the delivered document. Use a new snapshot for each revision; remove unrelated turns only by preparing an explicitly scoped session, without rewriting retained prompts.

For Codex with `CODEX_THREAD_ID`, run:

```sh
node runtime/cli/promptiff.mjs capture --current --out /absolute/private/path/session.json
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

First run the headless check using the chosen engine (default lexical):

```sh
node runtime/cli/promptiff.mjs compare --session /absolute/private/path/session.json --out /absolute/private/path/report.json --engine lexical
```

It checks the last artifact in array order by default; `--artifact <id>` selects another. It includes only turns at or before that artifact's `turnId`, uses the canvas's exact sentence preparation, and returns output-to-prompt candidates and reverse prompt coverage as JSON. Read low matches in both directions and verify changed negation, numbers and entities. This is not a pass/fail compliance detector. Model errors fail the command; do not silently call a lexical result semantic. For local/remote modes pass the same engine options here and to `serve`.

```sh
node runtime/cli/promptiff.mjs serve --session /absolute/private/path/session.json --engine lexical
```

Keep the process running and return its complete loopback URL, including the token fragment. If the host has an available browser-panel tool, open the URL there; otherwise give a clickable browser link. Do not invent a sidebar API. Stop the owned process when requested. Add multiple `--session` arguments only for user-selected historical conversations.

Open and verify the new artifact before returning its link alongside the document and compute mode. Serve a snapshot containing just the selected artifact if a specific older artifact was compared, so the canvas opens the same result. A running server holds an immutable in-memory snapshot: writing another JSON does not update it. Start a new owned process for a new version, keeping version links distinct. State failures instead of returning an old link as the latest check. Loopback links work on the machine hosting the Agent only; for a remote OpenClaw host, explain this limitation and use only an already authorized access path. No hosted cross-device reports or automatic background watcher are provided. Opening a semantic canvas recalculates vectors and can incur an additional remote API call.

The default is character-bigram matching, clearly labeled as lexical. For semantic comparisons, respect the user's chosen compute mode:

- **Local:** create an isolated Python environment, install `runtime/cli/requirements.txt`, then pass `--engine local --python /absolute/venv/bin/python`. The first run downloads the pinned multilingual model from Hugging Face; article text is processed on local CPU. Wait for a successful calculation before claiming semantic results.
- **Remote:** requires the user's choice to upload the selected prompt/artifact text. Configure `PROMPTIFF_API_URL` (complete HTTPS embeddings endpoint), `PROMPTIFF_API_KEY`, and `PROMPTIFF_MODEL` in the process environment, then pass `--engine remote --allow-remote`. Do not put keys in the session JSON, browser, command arguments or Git. This is a bring-your-own-API integration, not an available Promptiff paid plan.

Similarity is not entailment or a percentage of intent fulfilled. Read both directions: output sentences lacking prompt matches and prompt sentences lacking output matches. Check negation, numeric constraints and changed entities directly. Multiple selected turns are compared together without silently resolving contradictions between them.
