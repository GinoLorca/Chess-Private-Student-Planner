/**
 * GET /api/uscf?id=12345678            → the member's current ratings
 * GET /api/uscf?id=12345678&events=1   → the same, plus their tournament history
 *
 * Reply: { id, name, regular, quick, blitz, expires, fetchedAt, events? }
 * with each rating a number or null (unrated / not shown). An event is
 * { date, eventId, name, section, points, games, before, after }.
 * Cached at the edge, so a lesson's worth of opens costs one lookup.
 *
 * Where the numbers come from, in order:
 * 1. The US Chess ratings API (ratings-api.uschess.org), the JSON service
 *    behind ratings.uschess.org: the member, their rated sections (event,
 *    date, rating before and after) and each section's standings (score).
 *    Unofficial and unsupported by US Chess, but public and plain JSON.
 * 2. The old MSA member pages (uschess.org/msa), scraped, as a fallback.
 *    They sit behind Cloudflare's bot check, so they rarely answer a server.
 * Each is tried directly first, then through the scraping service when one
 * is configured (USCF_FETCH_URL, see DEPLOY.md), then (MSA only) a free
 * rendering reader.
 *
 * Plain JavaScript on purpose: Vercel runs it as-is, with nothing to compile.
 */

const API = 'https://ratings-api.uschess.org/api/v1'
const MSA_HOSTS = ['https://www.uschess.org/msa', 'http://www.uschess.org/msa']
/** A free rendering reader that loads a page in a real browser and hands the HTML back. */
const READER = 'https://r.jina.ai/'
/**
 * A scraping service that gets past bot checks, as a URL template with
 * {url} where the page address goes, set on Vercel as USCF_FETCH_URL.
 */
const SERVICE = process.env.USCF_FETCH_URL || ''
const DIRECT_TIMEOUT_MS = 8000
/** Scraping services take a while, rendering most of all. */
const SERVICE_TIMEOUT_MS = 30000
/** Vercel's limit is 60 s (config below); stop starting new routes with this much time left. */
const BUDGET_MS = 50000
const HEADERS = {
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
}
/** How many recent events get their crosstable read for the score. */
const EVENTS_WITH_SCORES = 6

/** HTML to plain text, with tag boundaries kept as spaces so numbers don't run into labels. */
function textOf(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/\s+/g, ' ')
}

/** The number after a label such as "Regular Rating", or null when unrated / absent. */
function ratingAfter(text, label) {
  const re = new RegExp(`${label}\\s*(?:Rating)?[^0-9A-Za-z]{0,20}(Unrated|\\d{3,4})`, 'i')
  const m = re.exec(text)
  if (!m) return null
  return /unrated/i.test(m[1]) ? null : Number(m[1])
}

/** Pull what the member page says. Exported for tests. */
export function parseMemberPage(html, id) {
  const text = textOf(html)
  if (!text.includes(String(id))) return null
  const name = new RegExp(`${id}\\s*:\\s*([A-Z][A-Z .,'-]{2,60}?)(?=\\s{2,}|\\s(?:Regular|Quick|Blitz|Expir|Rating|Last|State|Gender|Member)|$)`, 'i').exec(text)
  const expires = /Expir\w*\.?\s*(?:Dt\.?|Date)?\s*:?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i.exec(text)
  return {
    id: String(id),
    name: name ? name[1].trim() : null,
    regular: ratingAfter(text, 'Regular'),
    quick: ratingAfter(text, 'Quick'),
    blitz: ratingAfter(text, 'Blitz'),
    expires: expires ? expires[1] : null,
  }
}

/** Each <tr> of a page as plain text, in order. */
function rowsOf(html) {
  const rows = []
  const re = /<tr[\s\S]*?<\/tr>/gi
  let m
  while ((m = re.exec(html))) rows.push({ html: m[0], text: textOf(m[0]).trim() })
  return rows
}

/**
 * The tournament history page (MbrDtlTnmtHst.php): one row per event with
 * the end date, the event id and name, the section, and the regular rating
 * before and after ("1105 => 1136"). Exported for tests.
 */
export function parseHistoryPage(html) {
  const events = []
  for (const row of rowsOf(html)) {
    const date = /^(\d{4}-\d{2}-\d{2})\b/.exec(row.text)
    const eventId = /\b(\d{12})\b/.exec(row.text)
    if (!date || !eventId) continue
    const link = /XtblMain\.php\?([0-9.]+(?:-\d+)?)/i.exec(row.html)
    // Name: what follows the id up to the section ("3: U1200") or a rating pair.
    const after = row.text.slice(row.text.indexOf(eventId[1]) + 12)
    const section = /(\d{1,2})\s*:\s*([A-Za-z0-9][^=]*?)(?=\s+(?:\d{3,4}|Unrated)\s*=>|\s+\d{3,4}\s+\d{3,4}|$)/.exec(after)
    let name = after
    if (section) name = after.slice(0, section.index)
    else {
      const cut = /\s(?:\d{3,4}|Unrated)\s*=>/.exec(after)
      if (cut) name = after.slice(0, cut.index)
    }
    name = name.replace(/^[\s:.-]+|[\s:.-]+$/g, '').replace(/\s+/g, ' ')
    const ratings = /(\d{3,4}|Unrated)\s*=>\s*(\d{3,4}|Unrated)/.exec(after)
    events.push({
      date: date[1],
      eventId: eventId[1],
      crosstable: link ? link[1] : null,
      name: name || 'Event',
      section: section ? `${section[1]}: ${section[2].trim()}` : null,
      before: ratings && /^\d/.test(ratings[1]) ? Number(ratings[1]) : null,
      after: ratings && /^\d/.test(ratings[2]) ? Number(ratings[2]) : null,
      points: null,
      games: null,
    })
  }
  return events
}

/**
 * The player's score in an event's crosstable: their row is the one carrying
 * their member id (or name); the total points is the first "3.5"-style
 * number on it, and the games are the W/L/D/B/H/U/X result cells. Exported
 * for tests.
 */
export function parseCrosstableScore(html, id, name) {
  const wanted = String(id)
  const rows = rowsOf(html)
  let row = rows.find((r) => r.text.includes(wanted))
  if (!row && name) row = rows.find((r) => r.text.toUpperCase().includes(String(name).toUpperCase()))
  if (!row) return null
  const pts = /\b(\d{1,2}\.[05])\b/.exec(row.text)
  const results = row.text.match(/\b[WLDBHUXF]\s*\d{1,3}\b|\b[BHUX]\b/g) || []
  return { points: pts ? Number(pts[1]) : null, games: results.length || null }
}

/** Cloudflare's interstitial rather than the page itself. */
function isChallenge(status, text) {
  return status === 403 || status === 503 || /just a moment|enable javascript and cookies|cf-chl|challenge-platform/i.test(text)
}

/** Milliseconds left before the function should stop starting new routes. */
let deadline = 0
const timeLeft = () => deadline - Date.now()

async function fetchText(url, extraHeaders = {}, timeoutMs = DIRECT_TIMEOUT_MS) {
  const ms = Math.max(1000, Math.min(timeoutMs, timeLeft() + 8000))
  let res
  try {
    res = await fetch(url, {
      headers: { ...HEADERS, ...extraHeaders },
      redirect: 'follow',
      signal: AbortSignal.timeout(ms),
    })
  } catch (e) {
    const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError'
    throw new Error(timedOut ? `no answer within ${Math.round(ms / 1000)} s` : `could not connect (${e?.cause?.code ?? e?.message ?? e})`)
  }
  const text = await res.text()
  if (!res.ok || isChallenge(res.status, text)) {
    const challenged = isChallenge(res.status, text)
    const err = new Error(challenged ? `bot check (${res.status})` : `replied ${res.status}`)
    err.snippet = textOf(text).slice(0, 120)
    err.challenged = challenged
    err.status = res.status
    throw err
  }
  return text
}

/** The service's address for a page; JSON needs no rendering, which is also cheaper. */
function serviceUrl(url, render) {
  let template = SERVICE
  if (!render) template = template.replace(/render_js=true/i, 'render_js=false').replace(/([?&])render=true/i, '$1render=false')
  return template.replace('{url}', encodeURIComponent(url))
}

/** JSON from a reply, including one a rendering service wrapped in <pre>. */
function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    const inner = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(text)?.[1] ?? textOf(text)
    try {
      return JSON.parse(inner.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'))
    } catch {
      const err = new Error(`reply was not JSON ("${textOf(text).slice(0, 80)}")`)
      err.snippet = textOf(text).slice(0, 120)
      throw err
    }
  }
}

/**
 * A ratings API path as JSON: directly, then through the scraping service.
 * A 404 is an answer ("no such member / event"), not a route failure.
 */
async function apiJson(path, trail) {
  const url = `${API}${path}`
  try {
    return parseJson(await fetchText(url, { accept: 'application/json' }))
  } catch (e) {
    if (e?.status === 404) throw e
    trail.push(`ratings API: ${e.message}`)
  }
  if (SERVICE && timeLeft() > 5000) {
    try {
      return parseJson(await fetchText(serviceUrl(url, false), { accept: 'application/json' }, SERVICE_TIMEOUT_MS))
    } catch (e) {
      if (e?.status === 404) throw e
      trail.push(`ratings API via scraping service: ${e.message}`)
    }
  }
  throw new Error('ratings API unreachable')
}

/** The page through the rendering reader, as raw HTML, so the same parsers apply. */
async function fetchViaReader(url) {
  return fetchText(`${READER}${url}`, { 'x-return-format': 'html', 'x-no-cache': 'true', accept: 'text/html,*/*' }, 20000)
}

/**
 * An MSA page from the first route that answers: the site directly over
 * https, then http, then the scraping service, then the reader.
 */
async function fetchMsa(path, attempts) {
  let lastError = null
  for (const host of MSA_HOSTS) {
    const url = `${host}/${path}`
    try {
      const text = await fetchText(url)
      attempts.push({ url, ok: true, snippet: textOf(text).slice(0, 120) })
      return text
    } catch (e) {
      attempts.push({ url, ok: false, error: e.message, snippet: e?.snippet, challenged: !!e?.challenged })
      lastError = e
    }
  }
  const url = `${MSA_HOSTS[0]}/${path}`
  const routes = [
    SERVICE ? { label: 'scraping service', run: () => fetchText(serviceUrl(url, true), {}, SERVICE_TIMEOUT_MS) } : null,
    { label: 'reader', run: () => fetchViaReader(url) },
  ].filter(Boolean)
  for (const route of routes) {
    if (timeLeft() < 5000) break
    try {
      const text = await route.run()
      attempts.push({ url: `${route.label} → ${url}`, ok: true, snippet: textOf(text).slice(0, 120) })
      return text
    } catch (e) {
      attempts.push({ url: `${route.label} → ${url}`, ok: false, error: e.message, snippet: e?.snippet, challenged: !!e?.challenged })
      lastError = e
    }
  }
  throw lastError ?? new Error('USCF unreachable')
}

// ---------------------------------------------------------------------------
// The ratings API
// ---------------------------------------------------------------------------

/** "JOSEPH" → "Joseph"; names already in mixed case stay as they are. */
function nameCase(part) {
  const p = String(part ?? '').trim()
  return p && p === p.toUpperCase() ? p.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase()) : p
}

/** Newest first: by end date, then event id (which starts with the date). */
function newestFirst(sections) {
  return [...(sections ?? [])].sort((a, b) => {
    const d = String(b.endDate ?? b.event?.endDate ?? '').localeCompare(String(a.endDate ?? a.event?.endDate ?? ''))
    return d || String(b.event?.id ?? '').localeCompare(String(a.event?.id ?? ''))
  })
}

const SYSTEMS = { R: 'regular', Q: 'quick', B: 'blitz' }

/**
 * The member's ratings from the API. The member record carries the last
 * monthly list; a section rated since then moves the number, so the newest
 * section's rating after, per system, is the live rating. Exported for tests.
 */
export function ratingsFromApi(member, sections, id) {
  const out = { regular: null, quick: null, blitz: null }
  for (const r of member?.ratings ?? []) {
    const key = SYSTEMS[r?.ratingSystem]
    if (key && r.rating) out[key] = r.rating
  }
  const seen = new Set()
  for (const s of newestFirst(sections)) {
    for (const rec of s.ratingRecords ?? []) {
      const key = SYSTEMS[rec?.ratingSource]
      if (!key || seen.has(key) || !rec.postRating) continue
      out[key] = rec.postRating
      seen.add(key)
    }
  }
  const name = [nameCase(member?.firstName), nameCase(member?.lastName)].filter(Boolean).join(' ')
  return {
    id: String(member?.id ?? id),
    name: name || null,
    ...out,
    expires: member?.expirationDate ? String(member.expirationDate).slice(0, 10) : null,
  }
}

/** One event row per rated section, newest first. Exported for tests. */
export function eventsFromApi(sections) {
  return newestFirst(sections).map((s) => {
    const records = s.ratingRecords ?? []
    const rec = records.find((r) => r.ratingSource === 'R') ?? records.find((r) => SYSTEMS[r.ratingSource]) ?? records[0]
    return {
      date: String(s.endDate ?? s.event?.endDate ?? '').slice(0, 10),
      eventId: String(s.event?.id ?? ''),
      name: s.event?.name || 'Event',
      section: s.sectionName ? `${s.sectionNumber}: ${s.sectionName}` : s.sectionNumber ? `Section ${s.sectionNumber}` : null,
      before: rec?.preRating ?? null,
      after: rec?.postRating ?? null,
      points: null,
      games: null,
      sectionNumber: s.sectionNumber,
    }
  })
}

/** Rounds that count toward "points / games": everything but not-paired and unreported. */
const NOT_A_ROUND = new Set(['Unpaired', 'NotReported'])

/** The member's score in a section's standings. Exported for tests. */
export function scoreFromStandings(items, id) {
  const row = (items ?? []).find((r) => String(r.memberId) === String(id))
  if (!row) return null
  const rounds = (row.roundOutcomes ?? []).filter((o) => o?.outcome && !NOT_A_ROUND.has(o.outcome)).length
  return { points: typeof row.score === 'number' ? row.score : null, games: rounds || null }
}

async function sectionsFromApi(id, size, trail) {
  const page = await apiJson(`/members/${id}/sections?Offset=0&Size=${size}`, trail)
  return page?.items ?? []
}

async function lookupRatingsApi(id, trail) {
  const [member, sections] = await Promise.all([
    apiJson(`/members/${id}`, trail),
    sectionsFromApi(id, 10, []).catch(() => []),
  ])
  if (!member || typeof member !== 'object' || (!member.id && !member.lastName)) throw new Error('ratings API: no member in the reply')
  return ratingsFromApi(member, sections, id)
}

async function lookupEventsApi(id) {
  const events = eventsFromApi(await sectionsFromApi(id, 50, []))
  await Promise.all(
    events.slice(0, EVENTS_WITH_SCORES).map(async (ev) => {
      if (!ev.eventId || !ev.sectionNumber || timeLeft() < 5000) return
      try {
        for (let offset = 0; offset < 1500; offset += 500) {
          const page = await apiJson(`/rated-events/${ev.eventId}/sections/${ev.sectionNumber}/standings?Offset=${offset}&Size=500`, [])
          const score = scoreFromStandings(page?.items, id)
          if (score) {
            ev.points = score.points
            ev.games = score.games
            break
          }
          if (!page?.hasNextPage) break
        }
      } catch {
        // The event stays listed without a score.
      }
    }),
  )
  return events.map(({ sectionNumber: _n, ...ev }) => ev)
}

// ---------------------------------------------------------------------------
// The old MSA pages (fallback)
// ---------------------------------------------------------------------------

async function lookupRatingsMsa(id, trail) {
  const attempts = []
  for (const path of [`MbrDtlMain.php?${id}`, `thin3.php?${id}`]) {
    if (timeLeft() < 5000) break
    let text
    try {
      text = await fetchMsa(path, attempts)
    } catch {
      continue
    }
    const parsed = parseMemberPage(text, id)
    if (parsed) return parsed
    attempts[attempts.length - 1].error = 'page fetched, but no member data on it'
  }
  // The first thing each route said, so one line shows what went wrong.
  const routes = new Map()
  for (const a of attempts) {
    const label = a.url.includes('→') ? `MSA via ${a.url.split(' → ')[0]}` : 'MSA pages'
    if (!routes.has(label)) routes.set(label, a.ok ? a.error ?? 'fetched' : a.error)
  }
  for (const [label, error] of routes) trail.push(`${label}: ${error}`)
  throw new Error('MSA pages unreadable')
}

async function lookupEventsMsa(id, name) {
  const events = parseHistoryPage(await fetchMsa(`MbrDtlTnmtHst.php?${id}`, []))
  const recent = events.slice(0, EVENTS_WITH_SCORES)
  await Promise.all(
    recent.map(async (ev) => {
      if (!ev.crosstable || timeLeft() < 5000) return
      try {
        const score = parseCrosstableScore(await fetchMsa(`XtblMain.php?${ev.crosstable}`, []), id, name)
        if (score) {
          ev.points = score.points
          ev.games = score.games
        }
      } catch {
        // The event stays listed without a score.
      }
    }),
  )
  return events.map(({ crosstable: _c, ...ev }) => ev)
}

// ---------------------------------------------------------------------------

/**
 * The member's ratings, from the API or else the MSA pages. When both fail,
 * the error is one line naming what each route said.
 */
async function lookupRatings(id) {
  const trail = []
  try {
    return { rating: await lookupRatingsApi(id, trail), source: 'api' }
  } catch (e) {
    if (e?.status === 404) throw Object.assign(new Error(`US Chess has no member with ID ${id}. Check the number on the folder.`), { status: 404 })
    if (!trail.length) trail.push(e.message)
  }
  try {
    return { rating: await lookupRatingsMsa(id, trail), source: 'msa' }
  } catch {
    // Reported below with the rest of the trail.
  }
  throw new Error(`Couldn't read the USCF ratings. ${trail.join('; ')}.`)
}

function json(status, body, cache) {
  const headers = { 'content-type': 'application/json; charset=utf-8' }
  if (cache) headers['cache-control'] = cache
  return new Response(JSON.stringify(body), { status, headers })
}

/** Room for the slower routes (a scraping service, the history's several calls). */
export const config = { maxDuration: 60 }

/** @param {Request} req */
export async function GET(req) {
  deadline = Date.now() + BUDGET_MS
  const url = new URL(req.url)
  const id = (url.searchParams.get('id') ?? '').trim()
  if (!/^\d{5,10}$/.test(id)) return json(400, { error: 'id must be a USCF member number (digits only)' })
  const withEvents = url.searchParams.get('events') === '1'
  try {
    const { rating, source } = await lookupRatings(id)
    const body = { ...rating, fetchedAt: new Date().toISOString() }
    if (withEvents) {
      try {
        body.events = source === 'api' ? await lookupEventsApi(id) : await lookupEventsMsa(id, rating.name)
      } catch (e) {
        body.events = []
        body.eventsError = e instanceof Error ? e.message : String(e)
      }
    }
    return json(200, body, withEvents ? 's-maxage=21600, stale-while-revalidate=86400' : 's-maxage=3600, stale-while-revalidate=86400')
  } catch (e) {
    return json(e?.status === 404 ? 404 : 502, { error: e instanceof Error ? e.message : String(e) })
  }
}
