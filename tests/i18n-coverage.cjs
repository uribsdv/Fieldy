#!/usr/bin/env node
/*
 * Fieldy — i18n coverage
 * ----------------------
 * Static check of index.html, no browser needed. Fails when:
 *   1. a key used in code (tr('k'), trv('k', …), trList('k'), data-i18n="k")
 *      is not defined in TRANSLATIONS, or a dynamic prefix (tr('day_' + n))
 *      matches no key at all;
 *   2. a TRANSLATIONS entry has no English, or English identical to the
 *      Hebrew (allowed only when the Hebrew holds no Hebrew letters, e.g. REMO);
 *   3. Hebrew is left inside a string, template or regex in the scripts, or in
 *      the static HTML outside an element that carries data-i18n — unless it
 *      sits in a region marked as an exception:
 *        // i18n-exempt-start: <reason>   …   // i18n-exempt-end
 *      or on a line ending with   // i18n-exempt: <reason>
 *      The exceptions are the long-form content libraries (stage 3), the AI
 *      prompts (stage 4), and values that are compared or sent to the server.
 *
 * Run:   node tests/i18n-coverage.cjs
 * Exit code 0 = all checks passed, 1 = at least one failed.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'index.html')
const src = fs.readFileSync(FILE, 'utf8')
const HEB = /[֐-׿]/

// Hebrew that may stay in the interface on purpose, with the reason.
const ALLOWED = {
  'עברית': 'the language picker names Hebrew in Hebrew, as every language picker does',
}

let failures = 0
function fail(msg) { failures++; console.log('  ✕ ' + msg) }

// ── TRANSLATIONS ────────────────────────────────────────────────────────────
const tStart = src.indexOf('const TRANSLATIONS = {')
if(tStart < 0) { console.log('✕ TRANSLATIONS not found'); process.exit(1) }
const tBodyStart = src.indexOf('{', tStart)
const tEnd = src.indexOf('\n}\n', tBodyStart)
// eslint-disable-next-line no-new-func
const TRANSLATIONS = new Function('return ' + src.slice(tBodyStart, tEnd + 2))()
const keys = Object.keys(TRANSLATIONS)
console.log('TRANSLATIONS: ' + keys.length + ' keys')

console.log('\n1. keys used in code are defined')
const code = src.slice(0, tStart) + src.slice(tEnd + 2)
const used = new Set(), prefixes = new Set()
for(const m of code.matchAll(/\b(?:tr|trv|trList)\(\s*'([a-z][a-z0-9_]*)'\s*([,)+])/g)) {
  if(m[2] === '+') prefixes.add(m[1]); else used.add(m[1])
}
for(const m of code.matchAll(/data-i18n(?:-[a-z]+)?="([a-z][a-z0-9_]*)"/g)) used.add(m[1])
// Keys that reach tr() through a table rather than a literal call.
for(const m of code.matchAll(/(?:label:'|\["?[a-z]+"?,\s*'|"label":")((?:theme|sites_chip|root|voice_lang)_[a-z_]+)['"]/g)) used.add(m[1])
let missing = 0
for(const k of used) if(!(k in TRANSLATIONS)) { fail('used but not defined: ' + k); missing++ }
for(const p of prefixes) if(!keys.some(k => k.startsWith(p))) { fail('dynamic prefix matches no key: ' + p + '…'); missing++ }
if(!missing) console.log('  ✓ ' + used.size + ' keys and ' + prefixes.size + ' dynamic prefixes, all defined')

console.log('\n2. every key has its own English')
let bad = 0
for(const k of keys) {
  const e = TRANSLATIONS[k]
  if(!e || typeof e.he !== 'string') { fail(k + ': no Hebrew'); bad++; continue }
  if(typeof e.en !== 'string' || !e.en.trim()) { fail(k + ': no English'); bad++; continue }
  if(e.en === e.he && HEB.test(e.he)) { fail(k + ': English is the same as the Hebrew'); bad++ }
  else if(HEB.test(e.en)) { fail(k + ': English holds Hebrew letters'); bad++ }
}
if(!bad) console.log('  ✓ all ' + keys.length + ' keys')

// ── Hebrew left in the code ─────────────────────────────────────────────────
console.log('\n3. no Hebrew left in interface strings')

// Line numbers that are exempt (marked regions and marked lines).
const lines = src.split('\n')
const exempt = new Uint8Array(lines.length + 2)
let open = -1
lines.forEach((l, i) => {
  if(/\/\/ i18n-exempt-start\b/.test(l)) { if(open >= 0) fail('line ' + (i + 1) + ': i18n-exempt-start inside another region'); open = i }
  if(open >= 0) exempt[i + 1] = 1
  if(/\/\/ i18n-exempt-end\b/.test(l)) { if(open < 0) fail('line ' + (i + 1) + ': i18n-exempt-end without a start'); open = -1 }
  if(/\/\/ i18n-exempt: \S/.test(l)) exempt[i + 1] = 1
})
if(open >= 0) fail('line ' + (open + 1) + ': i18n-exempt-start never ends')

// A small lexer: enough to tell strings, templates, regexes and comments apart
// in this file. Yields tokens with their start offset.
function lex(text, base) {
  const out = []
  let i = 0, prev = ''
  const n = text.length
  const REGEX_BEFORE = '(,=:[!&|?{};+-*%<>~^'
  while(i < n) {
    const c = text[i]
    if(c === '"' || c === "'") {
      let j = i + 1
      while(j < n && text[j] !== c && text[j] !== '\n') { if(text[j] === '\\') j++; j++ }
      out.push({kind: 'str', at: base + i, text: text.slice(i, j + 1)}); i = j + 1; prev = 'a'; continue
    }
    if(c === '`') {
      let j = i + 1, depth = 0
      while(j < n) {
        if(text[j] === '\\') { j += 2; continue }
        if(depth === 0 && text[j] === '`') break
        if(text.startsWith('${', j)) { depth++; j += 2; continue }
        if(depth > 0 && text[j] === '}') depth--
        else if(depth > 0 && text[j] === '`') {   // a template nested inside ${…}
          let k = j + 1
          while(k < n && text[k] !== '`') { if(text[k] === '\\') k++; k++ }
          j = k
        }
        j++
      }
      out.push({kind: 'tpl', at: base + i, text: text.slice(i, j + 1)}); i = j + 1; prev = 'a'; continue
    }
    if(text.startsWith('//', i)) { let j = text.indexOf('\n', i); if(j < 0) j = n; i = j; continue }
    if(text.startsWith('/*', i)) { let j = text.indexOf('*/', i + 2); j = j < 0 ? n : j + 2; i = j; continue }
    if(c === '/' && (prev === '' || REGEX_BEFORE.includes(prev) || /\b(return|typeof|case)\s*$/.test(text.slice(Math.max(0, i - 12), i)))) {
      let j = i + 1, cls = false
      while(j < n && text[j] !== '\n') {
        if(text[j] === '\\') { j += 2; continue }
        if(text[j] === '[') cls = true
        else if(text[j] === ']') cls = false
        else if(text[j] === '/' && !cls) break
        j++
      }
      j++
      while(j < n && /[a-z]/.test(text[j])) j++
      out.push({kind: 'regex', at: base + i, text: text.slice(i, j)}); i = j; prev = 'a'; continue
    }
    if(!/\s/.test(c)) prev = /[\w$]/.test(c) ? 'a' : c
    i++
  }
  return out
}
const lineOf = (() => {
  const starts = [0]
  for(let i = 0; i < src.length; i++) if(src[i] === '\n') starts.push(i + 1)
  return off => { let lo = 0, hi = starts.length - 1; while(lo < hi) { const mid = (lo + hi + 1) >> 1; if(starts[mid] <= off) lo = mid; else hi = mid - 1 } return lo + 1 }
})()

const leftovers = []
// Scripts
for(const m of src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
  const body = m[1], base = m.index + m[0].indexOf('>') + 1
  for(const t of lex(body, base)) {
    if(!HEB.test(t.text)) continue
    if(t.at >= tStart && t.at < tEnd) continue
    const first = lineOf(t.at), last = lineOf(t.at + t.text.length - 1)
    let ok = true
    for(let ln = first; ln <= last; ln++) if(!exempt[ln]) {
      // For a long template, only the lines that themselves carry Hebrew matter.
      const own = lines[ln - 1]
      if(HEB.test(own) && !Object.keys(ALLOWED).some(a => own.includes(a) && !HEB.test(own.split(a).join('')))) { ok = false; break }
    }
    if(!ok) leftovers.push(first)
  }
}
// Static HTML (outside scripts and styles): Hebrew only inside an element with data-i18n.
const html = src.replace(/<script[\s\S]*?<\/script>/g, m => m.replace(/[^\n]/g, ' ')).replace(/<style[\s\S]*?<\/style>/g, m => m.replace(/[^\n]/g, ' '))
for(const m of html.matchAll(/<([a-z0-9]+)([^>]*)>([^<]*[֐-׿][^<]*)</g)) {
  const ln = lineOf(m.index)
  if(/data-i18n/.test(m[2]) || exempt[ln]) continue
  leftovers.push(ln)
}
const uniq = [...new Set(leftovers)].sort((a, b) => a - b)
for(const ln of uniq) fail('line ' + ln + ': Hebrew outside TRANSLATIONS: ' + lines[ln - 1].trim().slice(0, 110))
if(!uniq.length) console.log('  ✓ none outside TRANSLATIONS and the marked exceptions')

// ── English content libraries (stage 3) ─────────────────────────────────────
console.log('\n4. English content libraries are filled in and parallel to the Hebrew')
function grabLiteral(name) {
  const at = src.indexOf('const ' + name + ' = ')
  if(at < 0) return undefined
  const open = src.indexOf(name.endsWith('_LIB_EN') ? '{' : '[', at)
  const toks = lex(src.slice(open), open)   // skip strings so brackets inside them don't count
  let depth = 0, i = open, end = -1, ti = 0
  while(i < src.length) {
    while(ti < toks.length && toks[ti].at < i) ti++
    if(ti < toks.length && toks[ti].at === i) { i += toks[ti].text.length; continue }
    const c = src[i]
    if(c === '[' || c === '{') depth++
    else if(c === ']' || c === '}') { depth--; if(!depth) { end = i; break } }
    i++
  }
  // eslint-disable-next-line no-new-func
  return new Function('return ' + src.slice(open, end + 1))()
}
let bad4 = 0
const TAO = grabLiteral('TAO_CHAPTERS'), TAO_EN = grabLiteral('TAO_CHAPTERS_EN')
if(!Array.isArray(TAO_EN)) { fail('TAO_CHAPTERS_EN not found'); bad4++ }
else {
  if(TAO_EN.length > TAO.length) { fail('TAO_CHAPTERS_EN has more entries than TAO_CHAPTERS'); bad4++ }
  TAO_EN.forEach((t, i) => {
    if(typeof t !== 'string' || !t.trim()) { fail('TAO_CHAPTERS_EN[' + i + '] is empty'); bad4++ }
    else if(t === TAO[i]) { fail('TAO_CHAPTERS_EN[' + i + '] is the same as the Hebrew'); bad4++ }
    else if(HEB.test(t)) { fail('TAO_CHAPTERS_EN[' + i + '] holds Hebrew letters'); bad4++ }
  })
  const TT_EN = grabLiteral('TAO_TITLES_EN')
  if(Array.isArray(TT_EN) && TT_EN.some(t => !t || HEB.test(t))) { fail('TAO_TITLES_EN has an empty or Hebrew title'); bad4++ }
}
const MOOD_EN = grabLiteral('MOOD_LIB_EN')
if(MOOD_EN) {
  // the Hebrew lines of each mood, read from its own entry in MOOD_LIB (first definition of the key)
  for(const k of Object.keys(MOOD_EN)) {
    const m = new RegExp('\\n\\s*' + k + ':\\s*\\{').exec(src)
    const he = m && grabLiteralAt(m.index + m[0].length - 1)
    const en = MOOD_EN[k]
    if(!he) { fail('MOOD_LIB_EN.' + k + ': no such mood in MOOD_LIB'); bad4++; continue }
    if(!en.actions || en.actions.length !== he.actions.length) { fail('MOOD_LIB_EN.' + k + ': ' + (en.actions || []).length + ' lines, the Hebrew has ' + he.actions.length); bad4++ }
    ;[en.ifthen].concat(en.actions || []).forEach((t, i) => { if(typeof t !== 'string' || !t.trim() || HEB.test(t)) { fail('MOOD_LIB_EN.' + k + ' line ' + i + ' is empty or holds Hebrew'); bad4++ } })
  }
}
function grabLiteralAt(open) {
  const toks = lex(src.slice(open, open + 20000), open)
  let depth = 0, i = open, ti = 0
  while(i < src.length) {
    while(ti < toks.length && toks[ti].at < i) ti++
    if(ti < toks.length && toks[ti].at === i) { i += toks[ti].text.length; continue }
    const c = src[i]
    if(c === '{' || c === '[') depth++
    else if(c === '}' || c === ']') { depth--; if(!depth) break }
    i++
  }
  // eslint-disable-next-line no-new-func
  try { return new Function('return ' + src.slice(open, i + 1))() } catch(e) { return null }
}
if(!bad4) console.log('  ✓ ' + (TAO_EN ? TAO_EN.length : 0) + ' Tao chapters, ' + Object.keys(MOOD_EN || {}).length + ' moods')

console.log('\n' + (failures ? '✕ ' + failures + ' problem(s)' : '✓ i18n coverage passed'))
process.exit(failures ? 1 : 0)
