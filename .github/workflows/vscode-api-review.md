---
description: Monthly review of new VS Code API features, with suggested enhancements for the extension
on:
  schedule:
    - cron: "23 6 2 * *" # 06:23 UTC on the 2nd of each month
  workflow_dispatch:
permissions:
  contents: read
  issues: read
engine:
  id: copilot
  copilot-sdk: true
network:
  allowed:
    - defaults
    - code.visualstudio.com
    - github
tools:
  github:
    toolsets: [repos, issues]
  web-fetch:
  cache-memory: true
  bash: ["cat", "grep", "ls", "head", "find", "wc"]
safe-outputs:
  create-issue:
    title-prefix: "[vscode-api] "
    labels: [enhancement, vscode-api-review]
    close-older-issues: true
    expires: 60
    max: 1
timeout-minutes: 30
---

# Monthly VS Code API review

You are an expert VS Code extension developer reviewing this repository: **${{ github.repository }}**,
a VS Code extension (published as "Autodesk Platform Services") that surfaces APS services as tree
views, commands, webview panels, and language model tools.

Your job is to find **new VS Code API features** released since the last review and propose
**concrete, worthwhile enhancements** to this extension that would use them.

## Step 1: Load previous state

Read `/tmp/gh-aw/cache-memory/` for a file named `last-review.json` containing
`{ "lastVersionReviewed": "1.xx", "suggested": ["..."] }`. If it is missing, treat this as the first
run and review only the **last 3 stable releases**.

## Step 2: Find new VS Code releases and API changes

1. Use the GitHub `list_releases` tool on `microsoft/vscode` to determine the latest stable release.
   Exclude prereleases and group patch releases by minor version. Paginate as needed to find every
   minor release since `lastVersionReviewed`. On a first run, select the last 3 distinct stable
   minor releases.
2. For each stable minor release newer than `lastVersionReviewed`, use the GitHub `get_file_contents`
   tool to read `release-notes/v1_<minor>.md` from `microsoft/vscode-docs` (default branch).
   These are the source files for `https://code.visualstudio.com/updates/v1_<minor>`. Read the
   **Extension authoring** section and any sections on chat, language model tools, MCP,
   authentication, webviews, tree views, and the Command Palette/Quick Pick that affect extensions.
   If a required release note is unavailable, report the review as incomplete rather than advancing
   the saved version.
3. Cross-check against the proposed/finalized API surface in `vscode.d.ts` from the
   `microsoft/vscode` repository (`src/vscode-dts/vscode.d.ts` at the release tag) when the release
   notes are vague.
4. Ignore proposed (unstable) APIs unless they are clearly about to finalize; list those separately
   as "watch list" items.

## Step 3: Understand this extension

Before proposing anything, read:

- `CLAUDE.md` for architecture and layering rules (services/models must not import `vscode`;
  commands, providers, and tools are thin wrappers).
- `package.json` for `engines.vscode`, `contributes.*`, and activation events.
- The relevant parts of `src/commands`, `src/providers`, `src/tools`, `src/webviews`, and
  `src/auth-provider.ts`.
- `openspec/specs/` for the capabilities affected by each idea.

Also check open issues (use the GitHub tools) to avoid duplicating existing requests.

## Step 4: Evaluate and prioritize

For each new API, decide whether it fits this extension. Propose an enhancement only if it has a
clear user-facing benefit for APS developers. Skip anything that:

- would require raising `engines.vscode` without a strong payoff (note the version bump needed),
- breaks the layering rules in `CLAUDE.md`,
- is already implemented or already tracked in an open issue,
- appeared in the `suggested` list from a previous run.

Cap the proposals at **5**, ranked by value versus effort.

## Step 5: Report

Create **one issue** using the safe output. Use `###` for section headers and `<details>` for long
per-API notes. Structure:

1. **Summary**: the VS Code versions reviewed, and how many ideas are proposed.
2. **Proposed enhancements** (ranked). For each: the API and the VS Code version that introduced
   it, what to change in this extension (name the files or capabilities involved), the user benefit,
   effort (S/M/L), any `engines.vscode` bump needed, and the affected OpenSpec capability.
3. **Watch list**: proposed APIs worth tracking.
4. **Reviewed and skipped**: a short list of notable new APIs and why they don't apply.

Per this repository's conventions, note in each proposal that a behavior change should start as an
OpenSpec change, and that `package.json` contributions must stay in sync with command registrations.

If there is nothing worthwhile, call the `noop` safe output with a short explanation instead of
creating an issue.

## Step 6: Save state

Write `/tmp/gh-aw/cache-memory/last-review.json` with the newest version reviewed and the titles of
the enhancements you proposed.
