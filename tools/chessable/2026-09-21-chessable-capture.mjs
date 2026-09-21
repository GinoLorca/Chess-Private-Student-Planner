#!/usr/bin/env node
/**
 * Chessable capture: open a variation with your own Chessable session, step
 * forward one move at a time, record the FEN after every move, follow "Next"
 * to the following variations, and write the grouped lines
 * ("<start FEN> 5...Red8 6.f3 Be6 ...") that the planner uses.
 *
 *   node tools/chessable/2026-09-21-chessable-capture.mjs login
 *   node tools/chessable/2026-09-21-chessable-capture.mjs <variation url> [--count N | --chapter | --all] [--out base] [--pgn]
 *   node tools/chessable/2026-09-21-chessable-capture.mjs probe <variation url>
 *
 * Full usage: --help.  Walk-through: 2026-09-21-chessable-capture-README.md
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { FEN_RE, groupTokens, moveBetween, positionKey, renderGroups } from './2026-09-21-fens-to-line.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const LOGIN_URL = 'https://www.chessable.com/login/'
const MOCK_PAGE = path.join(ROOT, 'tools', 'chessable', 'fixtures', '2026-09-21-chessable-mock.html')
const MAX_PLIES = 400
const STEP_SETTLE_MS = 200

const HELP = `usage:
  chessable-capture login [--headless]
      Open a browser at the Chessable login page, sign in (CHESSABLE_EMAIL /
      CHESSABLE_PASSWORD from .env.local are typed in for you when set; 2FA or
      a captcha you finish by hand), then save the session to .chessable/state.json.

  chessable-capture <url> [options]
      Capture the variation at <url>, then keep following the "Next" button:
        --count N        this many variations (default 1)
        --chapter        every variation until the breadcrumb chapter changes
        --all            every variation until there is no "Next" button
        --out <base>     write <base>.txt, <base>.fens.txt (default captures/<date>-<slug>)
        --pgn            also write <base>.pgn (pastes into the planner's Quick add)
        --no-titles      leave the "# title" lines out of the output
        --headed         show the browser (default is headless once logged in)
        --wait <ms>      how long a move may take to show up (default 2500)
        --slow <ms>      slow every browser action down (debugging)
        --no-rewind      trust that the page opens at the start of the line

  chessable-capture mock [options]
      Run against the offline test page in tools/chessable/fixtures (no account needed).

  chessable-capture probe <url> [--headed]
      Print what the script finds on the page (FEN box, move buttons, "Next"),
      for picking selector overrides when the site layout changes.

environment (.env.local):
  CHESSABLE_EMAIL, CHESSABLE_PASSWORD   used by "login" and to re-login when a session expires
  CHESSABLE_STATE                       session file (default .chessable/state.json)
  CHESSABLE_CHROME                      path to a Chrome/Chromium binary to use
  CHESSABLE_FEN_SELECTOR, CHESSABLE_NEXT_MOVE_SELECTOR, CHESSABLE_FIRST_MOVE_SELECTOR,
  CHESSABLE_NEXT_VARIATION_SELECTOR     CSS overrides when auto-detection fails (see probe)
`

loadEnvFiles()
const ENV = {
  email: process.env.CHESSABLE_EMAIL || '',
  password: process.env.CHESSABLE_PASSWORD || '',
  state: process.env.CHESSABLE_STATE || path.join(ROOT, '.chessable', 'state.json'),
  chrome: process.env.CHESSABLE_CHROME || '',
  fenSelector: process.env.CHESSABLE_FEN_SELECTOR || '',
  nextMoveSelector: process.env.CHESSABLE_NEXT_MOVE_SELECTOR || '',
  firstMoveSelector: process.env.CHESSABLE_FIRST_MOVE_SELECTOR || '',
  nextVariationSelector: process.env.CHESSABLE_NEXT_VARIATION_SELECTOR || '',
}

const log = (...parts) => console.error('[chessable]', ...parts)

function loadEnvFiles() {
  if (typeof process.loadEnvFile !== 'function') {
    log('Node 20.12 or newer is needed to read .env.local; using the environment as is')
    return
  }
  for (const name of ['.env.local', '.env']) {
    const file = path.join(ROOT, name)
    if (!existsSync(file)) continue
    try {
      process.loadEnvFile(file)
    } catch (error) {
      log(`could not read ${name}: ${error.message}`)
    }
  }
}

function parseArgs(argv) {
  const opts = {
    command: 'capture',
    url: '',
    count: 1,
    chapter: false,
    all: false,
    out: '',
    pgn: false,
    titles: true,
    headed: null,
    wait: 2500,
    slow: 0,
    rewind: true,
  }
  const rest = [...argv]
  while (rest.length) {
    const arg = rest.shift()
    if (arg === '-h' || arg === '--help') return { ...opts, command: 'help' }
    else if (arg === 'login' || arg === 'probe' || arg === 'capture') opts.command = arg
    else if (/^(https?|file):/i.test(arg)) opts.url = arg
    else if (arg === 'mock') opts.url = pathToFileURL(MOCK_PAGE).href // the offline test page
    else if (arg === '--count') opts.count = Math.max(1, Number(rest.shift()) || 1)
    else if (arg === '--chapter') opts.chapter = true
    else if (arg === '--all') opts.all = true
    else if (arg === '--out') opts.out = rest.shift() || ''
    else if (arg === '--pgn') opts.pgn = true
    else if (arg === '--no-titles') opts.titles = false
    else if (arg === '--headed') opts.headed = true
    else if (arg === '--headless') opts.headed = false
    else if (arg === '--wait') opts.wait = Number(rest.shift()) || opts.wait
    else if (arg === '--slow') opts.slow = Number(rest.shift()) || 0
    else if (arg === '--no-rewind') opts.rewind = false
    else throw new Error(`unknown argument: ${arg}\n\n${HELP}`)
  }
  if (opts.headed === null) opts.headed = opts.command === 'login'
  if (opts.command !== 'login' && !opts.url) throw new Error(`a Chessable variation URL is needed\n\n${HELP}`)
  return opts
}

// ---------------------------------------------------------------- browser

async function launchBrowser(opts) {
  const options = { headless: !opts.headed, slowMo: opts.slow }
  if (ENV.chrome) options.executablePath = ENV.chrome
  try {
    return await chromium.launch(options)
  } catch (error) {
    const dir = process.env.PLAYWRIGHT_BROWSERS_PATH
    const fallback = dir ? path.join(dir, 'chromium') : ''
    if (!options.executablePath && fallback && existsSync(fallback)) {
      log(`Playwright's own Chromium is not installed; using ${fallback}`)
      return chromium.launch({ ...options, executablePath: fallback })
    }
    throw new Error(
      `${error.message.split('\n')[0]}\nRun "npx playwright install chromium" once, or set CHESSABLE_CHROME to a Chrome/Chromium binary.`,
    )
  }
}

async function openContext(browser, opts) {
  const hasState = existsSync(ENV.state)
  const context = await browser.newContext({
    storageState: hasState ? ENV.state : undefined,
    viewport: { width: 1400, height: 1000 },
    userAgent: opts.headed ? undefined : (await defaultUserAgent(browser)).replace(/HeadlessChrome/g, 'Chrome'),
  })
  context.setDefaultTimeout(20000)
  if (hasState) log(`using the saved session in ${path.relative(ROOT, ENV.state)}`)
  return context
}

async function defaultUserAgent(browser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  const ua = await page.evaluate(() => navigator.userAgent)
  await context.close()
  return ua
}

async function saveState(context) {
  mkdirSync(path.dirname(ENV.state), { recursive: true })
  await context.storageState({ path: ENV.state })
  log(`session saved to ${path.relative(ROOT, ENV.state)}`)
}

// ---------------------------------------------------------------- login

async function looksLoggedOut(page) {
  const url = new URL(page.url())
  if (/\/login/i.test(url.pathname)) return true
  return (await page.locator('input[type="password"]:visible').count()) > 0
}

async function ensureLoggedIn(page, opts) {
  if (!(await looksLoggedOut(page))) return
  if (!/\/login/i.test(new URL(page.url()).pathname)) await page.goto(LOGIN_URL)
  const interactive = opts.headed
  if (ENV.email && ENV.password) {
    log(`signing in as ${ENV.email}`)
    const user = page
      .locator(
        'input[type="email"], input[name*="user" i], input[name*="email" i], input[name*="login" i], input#email, input#username',
      )
      .first()
    const pass = page.locator('input[type="password"]').first()
    await user.waitFor()
    await user.fill(ENV.email)
    await pass.fill(ENV.password)
    await pass.press('Enter')
    if (interactive) log('finish any 2FA or captcha in the browser window; waiting up to 5 minutes')
  } else if (interactive) {
    log('sign in in the browser window (2FA or captcha are fine); waiting up to 5 minutes')
  } else {
    throw new Error(
      'Not logged in. Run "npm run chessable:login" once (a browser opens, you sign in, the session is saved), ' +
        'or put CHESSABLE_EMAIL and CHESSABLE_PASSWORD in .env.local.',
    )
  }
  try {
    await page.waitForFunction(
      () => !/\/login/i.test(location.pathname) && !document.querySelector('input[type="password"]'),
      null,
      { timeout: interactive ? 5 * 60 * 1000 : 45 * 1000 },
    )
  } catch {
    throw new Error('The login did not complete (wrong password, a captcha, or 2FA). Try "npm run chessable:login" with the browser visible.')
  }
  await saveState(page.context())
}

// ---------------------------------------------------------------- page reading

const FEN_TAG = 'data-capture-fen'

/** The FEN currently shown: the input (or text) whose value is a FEN, found afresh when needed. */
async function readFen(page) {
  return page.evaluate(
    ({ re, tag, selector }) => {
      const fenRe = new RegExp(re)
      const valueOf = (el) => ('value' in el ? el.value : el.textContent || '').trim()
      const tagged = document.querySelector(`[${tag}]`)
      if (tagged && fenRe.test(valueOf(tagged))) return valueOf(tagged)

      let best = null
      if (selector) {
        best = document.querySelector(selector)
      } else {
        const score = (el) => {
          const label = el.labels?.[0]?.textContent || ''
          const attrs = `${el.id} ${el.name} ${el.className} ${el.placeholder || ''} ${el.getAttribute('aria-label') || ''}`
          const around = `${el.previousElementSibling?.textContent || ''} ${el.parentElement?.textContent || ''}`
          return (/fen/i.test(label) ? 4 : 0) + (/fen/i.test(attrs) ? 3 : 0) + (/fen/i.test(around) ? 1 : 0)
        }
        for (const el of document.querySelectorAll('input, textarea')) {
          if (!fenRe.test(valueOf(el))) continue
          if (!best || score(el) > score(best)) best = el
        }
        if (!best) {
          for (const el of document.querySelectorAll('span, div, code, p, td, pre')) {
            if (el.children.length === 0 && fenRe.test(valueOf(el))) {
              best = el
              break
            }
          }
        }
      }
      if (!best) return null
      document.querySelectorAll(`[${tag}]`).forEach((el) => el.removeAttribute(tag))
      best.setAttribute(tag, '1')
      return valueOf(best) || null
    },
    { re: FEN_RE.source, tag: FEN_TAG, selector: ENV.fenSelector },
  )
}

async function waitForFen(page, timeout) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const fen = await readFen(page)
    if (fen) return fen
    await page.waitForTimeout(250)
  }
  throw new Error('No FEN box found on the page. Run "probe" on this URL and set CHESSABLE_FEN_SELECTOR if the box is somewhere unusual.')
}

async function waitForFenChange(page, previous, timeout) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const fen = await readFen(page)
    if (fen && positionKey(fen) !== positionKey(previous)) return fen
    await page.waitForTimeout(100)
  }
  return null
}

async function readHeader(page) {
  return page.evaluate(() => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
    const title = clean(document.querySelector('h1')?.textContent) || clean(document.title)
    let chapter = ''
    let course = ''
    const chaptersLink = [...document.querySelectorAll('a')].find((a) => /^chapters?$/i.test(clean(a.textContent)))
    if (chaptersLink?.parentElement) {
      const links = [...chaptersLink.parentElement.querySelectorAll('a')].map((a) => clean(a.textContent))
      chapter = links[links.length - 1] || ''
      course = links[0] || ''
    }
    if (!chapter) {
      const crumbs = document.querySelector('[aria-label*="breadcrumb" i], .breadcrumb, .breadcrumbs, nav ol')
      if (crumbs) {
        const items = [...crumbs.querySelectorAll('a, li')].map((el) => clean(el.textContent)).filter(Boolean)
        chapter = items[items.length - 1] || ''
        course = items[0] || ''
      }
    }
    return { title, chapter, course }
  })
}

// ---------------------------------------------------------------- stepping through moves

async function blurInputs(page) {
  await page.evaluate(() => {
    const active = document.activeElement
    if (active && active !== document.body && 'blur' in active) active.blur()
  })
}

const NEXT_TAG = 'data-capture-next'

/** The icon-only "next move" button, chosen by its hints; null when nothing looks right. */
async function findNextMoveButton(page) {
  if (ENV.nextMoveSelector) return page.locator(ENV.nextMoveSelector).first()
  const found = await page.evaluate((tag) => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
    const visible = (el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    }
    const hintsOf = (el) =>
      [
        el.id,
        el.className,
        el.getAttribute('aria-label'),
        el.title,
        ...Object.values(el.dataset || {}),
        ...[...el.querySelectorAll('*')].map((c) => `${c.className?.baseVal ?? c.className} ${c.getAttribute?.('aria-label') || ''} ${c.getAttribute?.('href') || ''}`),
      ]
        .filter(Boolean)
        .join(' ')
    let best = null
    let bestScore = 0
    for (const el of document.querySelectorAll('button, a, [role="button"]')) {
      if (!visible(el) || el.disabled) continue
      const text = clean(el.textContent)
      const glyph = /^[>›❯→▶]+$/.test(text)
      if (text && !glyph) continue
      const hints = hintsOf(el)
      if (/last|fast|end|double|skip|final/i.test(hints)) continue
      let score = 0
      if (/next|forward|right/i.test(hints)) score += 5
      if (glyph) score += 3
      if (/chevron|angle|caret|arrow|step/i.test(hints)) score += 2
      if (/move|ply|nav/i.test(hints)) score += 1
      if (score > bestScore) {
        best = el
        bestScore = score
      }
    }
    document.querySelectorAll(`[${tag}]`).forEach((el) => el.removeAttribute(tag))
    if (!best) return null
    best.setAttribute(tag, '1')
    return `${best.tagName.toLowerCase()}${best.id ? `#${best.id}` : ''}${best.className && typeof best.className === 'string' ? `.${best.className.trim().split(/\s+/).join('.')}` : ''}`
  }, NEXT_TAG)
  return found ? page.locator(`[${NEXT_TAG}]`).first() : null
}

/**
 * Advance one move, trying (a) the override selector, (b) the right-arrow key,
 * (c) the icon-only next button. Every success is checked to be exactly one
 * legal move, so a button that jumps to the end is rejected rather than
 * recorded. Returns { fen, how } or null at the end of the line.
 */
async function advance(page, current, opts, state) {
  const others = ['key', 'button'].filter((how) => how !== state.how)
  const order = ENV.nextMoveSelector ? ['override'] : state.how ? [state.how, ...others] : others
  for (const how of order) {
    if (how === 'key') {
      await blurInputs(page)
      await page.keyboard.press('ArrowRight')
    } else {
      const button = how === 'override' ? page.locator(ENV.nextMoveSelector).first() : await findNextMoveButton(page)
      if (!button) continue
      await button.click()
    }
    const next = await waitForFenChange(page, current, opts.wait)
    if (!next) continue
    if (moveBetween(current, next)) {
      state.how = how
      await page.waitForTimeout(STEP_SETTLE_MS)
      return next
    }
    log(`the "${how}" step jumped more than one move (to ${next}); trying another way`)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    await waitForFen(page, 20000)
    await rewind(page, opts)
  }
  return null
}

/** Back to the first position of the line, unless the page says it's already there. */
async function rewind(page, opts) {
  let current = await waitForFen(page, 20000)
  if (!opts.rewind) return current
  if (ENV.firstMoveSelector) {
    await page.locator(ENV.firstMoveSelector).first().click()
    return (await waitForFenChange(page, current, opts.wait)) || current
  }
  const atStart = await page.evaluate(() => /to move,?\s*initial position/i.test(document.body.innerText || ''))
  if (atStart) return current
  for (let i = 0; i < MAX_PLIES; i++) {
    await blurInputs(page)
    await page.keyboard.press('ArrowLeft')
    const before = await waitForFenChange(page, current, i === 0 ? Math.max(1500, opts.wait) : 1000)
    if (!before) break
    current = before
  }
  return current
}

async function captureVariation(page, opts, state, previousLast = '') {
  await page.waitForLoadState('domcontentloaded')
  await page.locator('h1').first().waitFor({ timeout: 5000 }).catch(() => {})
  const header = await readHeader(page)
  if (previousLast) {
    // A single-page viewer may still show the last position of the previous line for a moment.
    const shown = await waitForFen(page, 20000)
    if (positionKey(shown) === positionKey(previousLast)) await waitForFenChange(page, previousLast, opts.wait)
  }
  const start = await rewind(page, opts)
  const fens = [start]
  while (fens.length <= MAX_PLIES) {
    const next = await advance(page, fens[fens.length - 1], opts, state)
    if (!next) break
    fens.push(next)
  }
  return { ...header, url: page.url(), fens }
}

// ---------------------------------------------------------------- next variation

async function findNextVariation(page) {
  if (ENV.nextVariationSelector) {
    const el = page.locator(ENV.nextVariationSelector).first()
    return (await el.count()) ? el : null
  }
  const candidates = page.locator('a, button, [role="button"]').filter({ hasText: /next/i })
  const n = await candidates.count()
  for (let i = 0; i < n; i++) {
    const el = candidates.nth(i)
    if (!(await el.isVisible())) continue
    const text = (await el.innerText()).replace(/\s+/g, ' ').trim()
    if (/^next\s*(»|>>|›|❯|→)?$/i.test(text)) return el
  }
  return null
}

async function gotoNextVariation(page, previous) {
  const button = await findNextVariation(page)
  if (!button) return false
  if (!(await button.isEnabled()) || (await button.getAttribute('aria-disabled')) === 'true') return false
  const before = { url: page.url(), title: previous.title, fen: previous.fens[previous.fens.length - 1] }
  await button.click()
  let changed = false
  try {
    await page.waitForFunction(
      ({ url, title, fen, tag }) => {
        const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
        if (location.href !== url) return true
        if (clean(document.querySelector('h1')?.textContent) !== title) return true
        const box = document.querySelector(`[${tag}]`)
        const value = box ? ('value' in box ? box.value : box.textContent || '').trim() : ''
        return Boolean(value) && value.split(/\s+/).slice(0, 2).join(' ') !== fen.split(/\s+/).slice(0, 2).join(' ')
      },
      { ...before, tag: FEN_TAG },
      { timeout: 20000 },
    )
    changed = true
  } catch {
    changed = page.url() !== before.url
  }
  if (!changed) return false
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(600)
  return true
}

// ---------------------------------------------------------------- output

function slugOf(text) {
  return (
    (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'chessable'
  )
}

function shown(file) {
  const rel = path.relative(ROOT, file)
  return rel.startsWith('..') ? file : rel
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function outputBase(opts, first) {
  if (opts.out) return path.resolve(ROOT, opts.out.replace(/\.(txt|pgn)$/i, ''))
  const name = opts.count === 1 && !opts.chapter && !opts.all ? first.title : first.chapter || first.course || first.title
  return path.join(ROOT, 'captures', `${today()}-${slugOf(name)}`)
}

function tokensOf(variations) {
  const tokens = []
  for (const v of variations) {
    tokens.push({ type: 'title', text: v.title })
    for (const fen of v.fens) tokens.push({ type: 'fen', fen })
    tokens.push({ type: 'break' })
  }
  return tokens
}

function rawFens(variations) {
  return variations.map((v) => `# ${v.title}\n${v.fens.join('\n')}`).join('\n\n') + '\n'
}

function writeOutputs(base, variations, opts) {
  mkdirSync(path.dirname(base), { recursive: true })
  const groups = groupTokens(tokensOf(variations))
  const lines = renderGroups(groups, { titles: opts.titles })
  writeFileSync(`${base}.txt`, lines + '\n')
  writeFileSync(`${base}.fens.txt`, rawFens(variations))
  if (opts.pgn) writeFileSync(`${base}.pgn`, renderGroups(groups, { pgn: true, titles: opts.titles }) + '\n')
  return { groups, lines }
}

// ---------------------------------------------------------------- probe

async function probe(page) {
  const report = await page.evaluate(
    ({ re }) => {
      const fenRe = new RegExp(re)
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
      const describe = (el) => ({
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        class: typeof el.className === 'string' ? el.className.trim() || undefined : undefined,
        name: el.getAttribute('name') || undefined,
        ariaLabel: el.getAttribute('aria-label') || undefined,
        title: el.title || undefined,
        text: clean(el.textContent).slice(0, 40) || undefined,
        childClasses: [...el.querySelectorAll('*')].map((c) => (typeof c.className === 'string' ? c.className : c.className?.baseVal || '')).filter(Boolean).slice(0, 4),
        href: el.getAttribute('href') || undefined,
      })
      const visible = (el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      }
      const fenBoxes = [...document.querySelectorAll('input, textarea')]
        .filter((el) => fenRe.test((el.value || '').trim()))
        .map((el) => ({ ...describe(el), value: el.value }))
      const clickable = [...document.querySelectorAll('button, a, [role="button"]')].filter(visible)
      const iconButtons = clickable.filter((el) => clean(el.textContent).length <= 2).map(describe)
      const textButtons = clickable.filter((el) => clean(el.textContent).length > 2 && clean(el.textContent).length <= 24).map(describe)
      return { url: location.href, h1: clean(document.querySelector('h1')?.textContent), fenBoxes, iconButtons, textButtons }
    },
    { re: FEN_RE.source },
  )
  const picks = {
    fen: await readFen(page),
    header: await readHeader(page),
    nextMoveButton: null,
    nextVariation: null,
  }
  const nextMove = await findNextMoveButton(page)
  if (nextMove) picks.nextMoveButton = await nextMove.evaluate((el) => el.outerHTML.slice(0, 200))
  const nextVar = await findNextVariation(page)
  if (nextVar) picks.nextVariation = await nextVar.evaluate((el) => el.outerHTML.slice(0, 200))
  console.log(JSON.stringify({ picks, page: report }, null, 2))
}

// ---------------------------------------------------------------- main

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.command === 'help') {
    console.log(HELP)
    return
  }
  const browser = await launchBrowser(opts)
  const context = await openContext(browser, opts)
  const page = await context.newPage()
  try {
    if (opts.command === 'login') {
      await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' })
      if (!(await looksLoggedOut(page))) {
        log('already signed in')
        await saveState(context)
        return
      }
      await ensureLoggedIn(page, opts)
      return
    }

    await page.goto(opts.url, { waitUntil: 'domcontentloaded' })
    if (/^https?:/i.test(opts.url) && (await looksLoggedOut(page))) {
      await ensureLoggedIn(page, opts)
      await page.goto(opts.url, { waitUntil: 'domcontentloaded' })
    }

    if (opts.command === 'probe') {
      await waitForFen(page, 20000).catch((error) => log(error.message))
      await probe(page)
      return
    }

    const variations = []
    const state = { how: null }
    let base = ''
    for (;;) {
      const last = variations[variations.length - 1]
      const v = await captureVariation(page, opts, state, last ? last.fens[last.fens.length - 1] : '')
      const repeat = variations.find((x) => x.url === v.url && x.title === v.title)
      if (repeat) {
        log('"Next" led back to a variation already captured; stopping')
        break
      }
      variations.push(v)
      log(`${variations.length}. ${v.title || v.url} — ${v.fens.length - 1} move${v.fens.length === 2 ? '' : 's'}${state.how ? ` (via ${state.how})` : ''}`)
      base = base || outputBase(opts, v)
      writeOutputs(base, variations, opts)

      const more = opts.all || opts.chapter || variations.length < opts.count
      if (!more || variations.length >= 1000) break
      if (!(await gotoNextVariation(page, v))) {
        log('no "Next" button to follow; stopping')
        break
      }
      if (opts.chapter) {
        const header = await readHeader(page)
        if (v.chapter && header.chapter && header.chapter !== v.chapter) {
          log(`end of chapter "${v.chapter}"`)
          break
        }
      }
    }

    const { groups, lines } = writeOutputs(base, variations, opts)
    for (const [i, g] of groups.entries()) for (const note of g.notes) log(`group ${i + 1}${g.title ? ` (${g.title})` : ''}: ${note}`)
    console.log(lines)
    log(`wrote ${shown(base)}.txt and ${shown(base)}.fens.txt${opts.pgn ? ` and ${shown(base)}.pgn` : ''}`)
  } catch (error) {
    const shot = path.join(ROOT, 'captures', `${today()}-error.png`)
    try {
      mkdirSync(path.dirname(shot), { recursive: true })
      await page.screenshot({ path: shot, fullPage: true })
      log(`screenshot of the page at the error: ${shown(shot)}`)
    } catch {
      /* the page may be gone */
    }
    throw error
  } finally {
    await context.close()
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
