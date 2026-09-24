# Walkthrough: a comparison that changed the privacy requirement

This walkthrough uses the repository's [deliberately constructed sample](../examples/session.json), not a user's private conversation or a real delivery record. It shows how to review an Agent's draft against the instructions available when that draft was produced.

## 1. Run the sample

With Node.js 22.13 or later, from the repository root:

```sh
node cli/promptiff.mjs compare --session examples/session.json --artifact a1 --out /tmp/promptiff-a1.json
node cli/promptiff.mjs compare --session examples/session.json --artifact a2 --out /tmp/promptiff-a2.json
node cli/promptiff.mjs serve --session examples/session.json
```

Open the complete local URL printed by `serve`. In the canvas, switch between the first and second draft and inspect matches in both directions. The default comparison uses literal matching and sends no text to a model. Use another output path if `/tmp` is unavailable on your machine.

## 2. Read what the drafts actually say

The first instruction says that, when local compute is sufficient, data and computation should stay local; a remote API is an option when local compute is insufficient. Draft `a1` instead proposes uploading **all** sessions to a platform, requiring login to view results, keeping session history, and emailing weekly reports. That changes the requested data boundary. A similar-looking paragraph about “calculation and storage” is not evidence that the requirement was met.

The second draft, `a2`, restores a local workflow. It also adds a team activity leaderboard and automatic weekly email reports, although neither was requested. These are additions worth challenging before delivery, especially because they would affect other people's usage data.

Promptiff's reverse view helps locate source requests with weak matches; the forward view helps locate output text without clear source support. The low literal scores are **review leads**, not automatic verdicts. Read the matched text yourself to check negation, conditions, numbers, and who a statement applies to.

The sample contains two rounds of instructions. Draft `a1` is checked against the instructions that existed before it; draft `a2` is checked against both rounds. Later requirements are not treated as omissions in an earlier draft.

## 3. Try a real task

Paste your own original prompt and selected output into the [browser canvas](https://promptiff.zliu2934.workers.dev/canvas), or give your Agent the [setup prompt in the README](../README.md#copy-this-prompt-to-your-agent). The website canvas keeps pasted text in page memory. The local CLI runs on your machine; remote embeddings require an explicit choice and upload permission.

Promptiff helps you find passages to inspect. It does not certify that an output is correct or complete.
