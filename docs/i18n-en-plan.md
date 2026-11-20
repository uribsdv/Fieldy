# Fieldy: full English translation plan

Goal: the whole app reads as a tight, professional English product, so it can be shown to others.
Status: plan only. No code changed. Based on `origin/main` at `b9b6666`.

## Decisions (made with Uri)

1. Scope is everything: interface, long-form content (Tao, meditations, mood tips, quotes, Loki lines) and AI output.
2. American English. Sentence case for titles.
3. Tone: plain and short on work screens. Warm and quiet in the garden and personal content.
4. The name Loki stays Loki. Text the user types (site names, people, notes) is never translated.
5. Tao: new original English written from the meaning of the classical text. Never copy, quote or adapt a copyrighted English version, and do not translate the Hebrew edition that is in the app.
6. AI output (briefing, Ask Fieldy, drafts, coach, new tasks written by AI) is in English when the interface is English. Existing saved items are not translated.
7. No external JSON for now. `sw.js` has no cache, so a separate language file would not be available offline. Expect index.html to grow about 10% (about 1.15 MB).

## Findings from the first audit

- TRANSLATIONS has 318 keys (an earlier count of 261 missed lines holding several keys). The 16 keys that looked undefined are all defined, on shared lines (2562, 2569, 2575, 2686, 2697, 2756).
- About 1,100 lines contain Hebrew. About 2,000 strings sit outside the dictionary: interface about 350 lines, content libraries 346 lines (978 strings), AI prompts about 92 lines, compared values 8 lines, code comments 20 lines.
- State keys (statuses, buckets, moods, owners) are already English identifiers, so translating display text does not break saved data.
- Seed quotes are matched by their text. Translating them would add 17 duplicates to saved data and then to the server. Fix: a stable id per quote and a one-time migration.
- The WhatsApp analysis prompt is built once at startup, so changing language does not affect it.
- The briefing and Ask Fieldy prompts contradict themselves ("answer in Hebrew" and "write in English").
- The server does not know the language. `worker.js` and `sw.js` send notifications in Hebrew.
- `tests/lokitest.cjs` compares Loki's lines word for word against main. Add parallel English tables with the same structure and leave the Hebrew untouched.
- Done (branch `claude/tao-recut`): the Tao is cut into its 81 chapters. TAO_CHAPTERS and TAO_CHAPTERS_EN both use index i for chapter i + 1 (TAO_CHAPTERS has 81 entries; the English holds chapters 1-21 so far). The old 80 entries cut across chapter boundaries; the new cuts follow the printed edition's numbered chapter pages, and every kept line is unchanged and in order. Each chapter's title is its own heading (its first line). The edition prints classical chapters 42 and 43 in swapped order (its 42 is classical 43, "כמו תינוק"); the app keeps the edition's order, so the English for indexes 41 and 42 must follow it. The count comes from the array (TAO_CHAPTER_COUNT); no hard-coded 80 is left.
- Done (same branch): the edition's appendices, its editor's commentary inside the chapters (43 lines) and the publisher's web address are removed, and the old copies in `app.js` and `index-1.html` are deleted. The chapter text itself is still the edition's Hebrew translation, so the recommendation to consider new Hebrew later stands. Not legal advice.

## Glossary (for approval)

| Hebrew | English | Note |
|---|---|---|
| אתר | site | |
| קבלן | contractor | |
| מחוז | province | |
| אזור | area | company term, larger than "region" |
| משימה | task | |
| ממתין | pending | one term everywhere. Use "Waiting on" only for the field that names who |
| עכשיו / היום / אחר כך | Now / Today / Later | |
| ליקוידציה | liquidation | petty cash reports |
| קופה קטנה | petty cash | |
| SPIS, REMO | unchanged | |
| Monday (מערכת) | monday.com | never just "Monday" |
| גן הנחל | River garden | |
| גן השורשים | Roots garden | |
| מצב רוח | mood | the set of 23 moods already translated is the reference |
| לוקי | Loki | |
| פרס / איסוף | find / found | avoids "reward" and game language |
| Tao terms | Tao, the Way, sage | |

## Style guide

- American spelling (organize, color).
- Sentence case for all titles and buttons. No trailing period on buttons and labels.
- Days of the week: singular name for a day (Monday). Plural only for patterns ("on Mondays you tend to...").
- Dates: Nov 9. Time: 2:30 pm. Numbers under ten spelled out in running prose, digits in UI.
- Direct, short, no filler. Do not translate word for word: if a Hebrew phrase sounds poetic, find the English that sounds natural, not literary.
- Poetic or contemplative text: quiet, concrete, short lines. No archaic words.

## Stages

1. Audit and glossary: done by this document. Uri approves the glossary.
2. Interface extraction (Sonnet): move about 350 lines of hard-coded Hebrew into TRANSLATIONS, fix the contradicting prompts, add a display-name setting (default Uri). Add a coverage test that fails on a missing key or unjustified Hebrew in the interface.
3. Long-form content (Opus, rounds of about 10 items): Tao in 81 re-cut chapters, then meditations, mood tips, quotes with stable ids and migration, Loki lines as parallel English tables. Uri approves the first round before continuing.
4. AI output: prompts take uiLang, with one language instruction each.
5. Server: `worker.js` and `sw.js` notification language. Uri redeploys with wrangler. Final phone test by Uri.

Each stage is its own branch from the previous, reviewed by Uri, merged only when he says so.
