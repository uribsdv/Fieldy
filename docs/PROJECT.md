# Fieldy: project guide for every session and agent

Read this first. Owner: Uri (Area Manager, Innovative Agro Industry, Philippines; speaks Hebrew). Manager of the project: Claude (the main session). Repo: uribsdv/Fieldy. Live: https://uribsdv.github.io/Fieldy/ (GitHub Actions deploys on every push to `main`).

## What it is
A single-file HTML/JS PWA (`index.html`, about 1.15 MB), with a Cloudflare worker and D1 backend. Field operations management plus personal-development tools (Tao, meditations, moods, Ease tab, Loki the companion).

## Hard rules
1. Never merge to `main` and never push to `main` unless Uri wrote "מזג" (merge) for that branch. Agents work only on their own branch and report.
2. Before a merge: backup branch `backup/pre-<x>-merge-<date>`, `git merge --no-ff`, verify the tree equals the branch, run tests, push, wait about 90 s, check Actions. A failed deploy with "Found 0 artifacts" is a GitHub-side glitch: re-run the failed run.
3. Copyright: never copy, quote, adapt or closely paraphrase text from books (Tao translations such as Mitchell's, Alan Watts's books, or any other). Write new original wording. Watts content is labeled "Inspired by Alan Watts" and is never presented as a quotation. Loki never claims to be Watts.
4. Hebrew text must stay word for word unless the task says otherwise. Do not translate user-typed data (site names, people, notes).
5. Do not touch areas outside your task. Do not edit another branch.
6. Give Uri complete, copy-paste-ready Hebrew messages. Reports to Uri are in Hebrew, short, and show the new text in full so he can approve without opening the app.
7. Gemini art sheets: do not cut or package until Uri says "סיימנו". World/Marble work is paused.

## Tests
Run with `node tests/<name>.cjs`. Always run: `watts-tab`, `i18n-coverage`, `lokitest`, `smoke`. Known flaky or old failures, not ours: `loki-errands` (timing, rerun), `world-guests` (113/115 sometimes), `lifetest`. Tests generate preview PNGs: revert them with `git checkout`.

## English translation (American English, sentence case)
- Plain and short on work screens, warm and quiet in garden and personal content. Loki stays Loki.
- Glossary: site, contractor, province, area, task, pending, Now/Today/Later, liquidation, petty cash, monday.com, River garden, Roots garden, find/found, Tao, the Way, sage.
- Mechanism: `TRANSLATIONS` and `tr()` for the interface; parallel English lists for content (`TAO_CHAPTERS_EN`, `MOOD_LIB_EN`, ...), falling back to Hebrew when English is missing. `tests/i18n-coverage.cjs` guards structure.
- Tao: 81 chapters. `TAO_CHAPTERS` index i is chapter i+1 (as numbered in the Hebrew edition). Note: in that edition chapter 42 is "like a baby" and 43 is "yin and yang" (the reverse of the classical order); English follows the edition's order.
- Details and decisions: `docs/i18n-en-plan.md`.

## Status (updated by the manager)
- main: English interface, Ease tab (first version), Tao 1-20 in English, 24 moods, calm whispers, Tao in 81 chapters without the editor's notes.
- Open branches: see the table in the latest report to Uri.
- Next: Tao 21-81 in English (rounds of 10), toolboxes, quotes (stable ids plus migration), Loki lines, guests and game text, SPIS guides, then AI prompts follow the interface language, then server notifications.

## Roles
- Manager (main session): plans, opens agents, reviews and verifies their work (trial merge, tests, overlap checks), merges only on Uri's word.
- Task agents: one task, one branch, one report. They push the branch and stop.
