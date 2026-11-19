/** Privacy-friendly analytics stored in D1: no IPs, no cookies, no full user agents. */
import type { AnalyticsSummary } from '../../shared/types'

const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|monitor|curl|wget|python-requests|httpclient|go-http|okhttp|axios|node-fetch|scrapy/i

export function isBot(request: Request): boolean {
  const ua = request.headers.get('User-Agent') ?? ''
  if (!ua) return true
  if (BOT_UA.test(ua)) return true
  // Link prefetch/prerender should not count as a visit.
  const purpose = request.headers.get('Sec-Purpose') ?? request.headers.get('Purpose') ?? ''
  return /prefetch|prerender/i.test(purpose)
}

export function deviceClass(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'tablet'
  if (/Mobi|iPhone|iPod|Android|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'mobile'
  return 'desktop'
}

/** Reduce a referrer URL to a bare hostname; internal/empty referrers count as direct. */
export function referrerHost(referrer: unknown, ownHosts: string[]): string | null {
  if (typeof referrer !== 'string' || !referrer) return null
  try {
    const u = new URL(referrer)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    const host = u.hostname.replace(/^www\./, '').toLowerCase().slice(0, 100)
    return ownHosts.includes(host) ? null : host
  } catch {
    return null
  }
}

function country(request: Request): string | null {
  const c = (request as Request & { cf?: IncomingRequestCfProperties }).cf?.country
  return typeof c === 'string' && /^[A-Z]{2}$/.test(c) ? c : null
}

export async function recordEvent(
  db: D1Database,
  request: Request,
  event: { type: 'view' | 'click'; linkId?: number; referrer?: string | null },
): Promise<void> {
  await db
    .prepare('INSERT INTO analytics_events (type, link_id, referrer, country, device) VALUES (?, ?, ?, ?, ?)')
    .bind(event.type, event.linkId ?? null, event.referrer ?? null, country(request), deviceClass(request.headers.get('User-Agent') ?? ''))
    .run()
}

const ALLOWED_RANGES = [7, 30, 90]
export const clampRange = (days: number) => (ALLOWED_RANGES.includes(days) ? days : 30)

function utcDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export async function getSummary(db: D1Database, days: number, now = new Date()): Promise<AnalyticsSummary> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)))
  const since = `${utcDate(start)} 00:00:00`

  const [daily, allTime, links, referrers, countries, devices] = await db.batch([
    db
      .prepare(
        `SELECT substr(created_at, 1, 10) AS date,
                SUM(CASE WHEN type = 'view' THEN 1 ELSE 0 END) AS views,
                SUM(CASE WHEN type = 'click' THEN 1 ELSE 0 END) AS clicks
         FROM analytics_events WHERE created_at >= ? GROUP BY date ORDER BY date`,
      )
      .bind(since),
    db.prepare(
      `SELECT SUM(CASE WHEN type = 'view' THEN 1 ELSE 0 END) AS views,
              SUM(CASE WHEN type = 'click' THEN 1 ELSE 0 END) AS clicks
       FROM analytics_events`,
    ),
    db
      .prepare(
        `SELECT l.id, l.title, l.url, l.is_active,
                SUM(CASE WHEN e.created_at >= ? THEN 1 ELSE 0 END) AS clicks,
                COUNT(e.id) AS all_time
         FROM links l LEFT JOIN analytics_events e ON e.link_id = l.id AND e.type = 'click'
         GROUP BY l.id ORDER BY clicks DESC, all_time DESC, l.sort_order`,
      )
      .bind(since),
    db
      .prepare(
        `SELECT COALESCE(referrer, 'Direct / unknown') AS name, COUNT(*) AS count FROM analytics_events
         WHERE type = 'view' AND created_at >= ? GROUP BY name ORDER BY count DESC LIMIT 8`,
      )
      .bind(since),
    db
      .prepare(
        `SELECT COALESCE(country, 'Unknown') AS name, COUNT(*) AS count FROM analytics_events
         WHERE type = 'view' AND created_at >= ? GROUP BY name ORDER BY count DESC LIMIT 8`,
      )
      .bind(since),
    db
      .prepare(
        `SELECT COALESCE(device, 'unknown') AS name, COUNT(*) AS count FROM analytics_events
         WHERE type = 'view' AND created_at >= ? GROUP BY name ORDER BY count DESC`,
      )
      .bind(since),
  ])

  const byDay = new Map((daily.results as { date: string; views: number; clicks: number }[]).map((r) => [r.date, r]))
  const series: AnalyticsSummary['daily'] = []
  for (let i = 0; i < days; i++) {
    const date = utcDate(new Date(start.getTime() + i * 86_400_000))
    const r = byDay.get(date)
    series.push({ date, views: r?.views ?? 0, clicks: r?.clicks ?? 0 })
  }
  const views = series.reduce((s, d) => s + d.views, 0)
  const clicks = series.reduce((s, d) => s + d.clicks, 0)
  const at = (allTime.results[0] ?? {}) as { views: number | null; clicks: number | null }
  const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  return {
    rangeDays: days,
    totals: { views, clicks, ctr: views ? clicks / views : 0, allTimeViews: at.views ?? 0, allTimeClicks: at.clicks ?? 0 },
    daily: series,
    links: (links.results as { id: number; title: string; url: string; is_active: number; clicks: number; all_time: number }[]).map(
      (l) => ({ id: l.id, title: l.title, url: l.url, isActive: l.is_active === 1, clicks: l.clicks ?? 0, allTimeClicks: l.all_time }),
    ),
    referrers: referrers.results as { name: string; count: number }[],
    countries: countries.results as { name: string; count: number }[],
    devices: (devices.results as { name: string; count: number }[]).map((d) => ({ ...d, name: capitalise(d.name) })),
  }
}
