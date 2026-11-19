import { BarChart3, MousePointerClick, Percent, RefreshCw, Table2, Eye } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AnalyticsSummary } from '../../shared/types'
import { adminApi } from '../lib/api'
import { PageTitle } from './ProfileEditor'
import { Button, Card, cx } from './ui'

const RANGES = [7, 30, 90] as const
const nf = new Intl.NumberFormat()
const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0)}%`

export function Analytics() {
  const [days, setDays] = useState<number>(30)
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let cancelled = false
    adminApi
      .analytics(days)
      .then((d) => {
        if (cancelled) return
        setData(d)
        setError(null)
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load analytics'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [days, reloads])

  function refetch(nextDays = days) {
    setLoading(true)
    if (nextDays === days) setReloads((n) => n + 1)
    else setDays(nextDays)
  }

  return (
    <div className="viz space-y-6">
      <PageTitle
        title="Analytics"
        description="Real visits and clicks recorded by your Worker. Bots are filtered out; no IP addresses are stored."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-900" role="group" aria-label="Date range">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={days === r}
                  onClick={() => refetch(r)}
                  className={cx(
                    'rounded-md px-3 py-1 text-[13px] font-medium transition',
                    days === r ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white',
                  )}
                >
                  {r}d
                </button>
              ))}
            </div>
            <Button size="icon" variant="ghost" aria-label="Refresh" onClick={() => refetch()} disabled={loading}>
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        }
      />

      {error ? (
        <Card>
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      ) : !data ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
          ))}
        </div>
      ) : (
        <div className={cx('space-y-6 transition-opacity', loading && 'opacity-60')}>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile icon={<Eye size={15} />} label="Profile views" value={nf.format(data.totals.views)} sub={`${nf.format(data.totals.allTimeViews)} all time`} />
            <StatTile icon={<MousePointerClick size={15} />} label="Link clicks" value={nf.format(data.totals.clicks)} sub={`${nf.format(data.totals.allTimeClicks)} all time`} />
            <StatTile icon={<Percent size={15} />} label="Click-through rate" value={data.totals.views ? pct(data.totals.ctr) : '—'} sub="Clicks ÷ views" />
          </div>

          <TrafficCard data={data} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Most popular links" description={`Clicks in the last ${data.rangeDays} days`}>
              <RankedBars
                empty="No links yet."
                rows={data.links
                  .slice()
                  .sort((a, b) => b.clicks - a.clicks || b.allTimeClicks - a.allTimeClicks)
                  .map((l) => ({
                    key: String(l.id),
                    label: l.title,
                    sublabel: l.isActive ? undefined : 'hidden',
                    value: l.clicks,
                    note: `${nf.format(l.allTimeClicks)} all time`,
                  }))}
                total={data.totals.clicks}
              />
            </Card>
            <div className="grid gap-6">
              <Card title="Top referrers">
                <RankedBars empty="No referrer data yet." rows={data.referrers.map((r) => ({ key: r.name, label: r.name, value: r.count }))} total={data.totals.views} />
              </Card>
              <div className="grid gap-6 sm:grid-cols-2">
                <Card title="Countries">
                  <RankedBars compact empty="No data yet." rows={data.countries.map((r) => ({ key: r.name, label: countryName(r.name), value: r.count }))} total={data.totals.views} />
                </Card>
                <Card title="Devices">
                  <RankedBars compact empty="No data yet." rows={data.devices.map((r) => ({ key: r.name, label: r.name, value: r.count }))} total={data.totals.views} />
                </Card>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatTile({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/60">
      <p className="flex items-center gap-2 text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
        {icon}
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{sub}</p>
    </div>
  )
}

/* ---------------- Traffic over time ---------------- */

function TrafficCard({ data }: { data: AnalyticsSummary }) {
  const [asTable, setAsTable] = useState(false)
  return (
    <Card
      title="Traffic"
      description={`Daily views and clicks (UTC), last ${data.rangeDays} days`}
      actions={
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-4 text-xs text-zinc-600 sm:flex dark:text-zinc-400" aria-hidden="true">
            <LegendKey color="var(--series-views)" label="Views" />
            <LegendKey color="var(--series-clicks)" label="Clicks" />
          </div>
          <Button size="sm" variant="ghost" icon={asTable ? <BarChart3 size={14} /> : <Table2 size={14} />} onClick={() => setAsTable((v) => !v)}>
            {asTable ? 'Chart' : 'Table'}
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex items-center gap-4 text-xs text-zinc-600 sm:hidden dark:text-zinc-400">
        <LegendKey color="var(--series-views)" label="Views" />
        <LegendKey color="var(--series-clicks)" label="Clicks" />
      </div>
      {asTable ? <DailyTable daily={data.daily} /> : <LineChart daily={data.daily} />}
    </Card>
  )
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-0.5 w-3.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

function niceMax(v: number) {
  if (v <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= v) return m * pow
  return 10 * pow
}

const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' })

function LineChart({ daily }: { daily: AnalyticsSummary['daily'] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const height = 240
  const pad = { top: 12, right: 12, bottom: 26, left: 36 }
  const w = Math.max(0, width - pad.left - pad.right)
  const h = height - pad.top - pad.bottom
  const max = niceMax(Math.max(1, ...daily.map((d) => Math.max(d.views, d.clicks))))
  const n = daily.length
  const x = (i: number) => (n <= 1 ? w / 2 : (i / (n - 1)) * w)
  const y = (v: number) => h - (v / max) * h
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max]
  const labelEvery = Math.ceil(n / Math.max(2, Math.floor(w / 70)))

  const path = (key: 'views' | 'clicks') => daily.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join('')
  const area = `${path('views')}L${x(n - 1)},${h}L${x(0)},${h}Z`

  const pick = useMemo(
    () => (clientX: number, rect: DOMRect) => {
      const rel = clientX - rect.left - pad.left
      return Math.max(0, Math.min(n - 1, Math.round((rel / Math.max(1, w)) * (n - 1))))
    },
    [n, w, pad.left],
  )

  const empty = daily.every((d) => d.views === 0 && d.clicks === 0)
  const hd = hover !== null ? daily[hover] : null

  return (
    <div ref={ref} className="relative">
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Daily profile views and link clicks"
          tabIndex={0}
          className="block touch-pan-y outline-none"
          onPointerMove={(e) => setHover(pick(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerLeave={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setHover((v) => Math.min(n - 1, (v ?? -1) + 1))
            if (e.key === 'ArrowLeft') setHover((v) => Math.max(0, (v ?? n) - 1))
          }}
          onBlur={() => setHover(null)}
        >
          <defs>
            <linearGradient id="viewsFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--series-views)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--series-views)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g transform={`translate(${pad.left},${pad.top})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={w} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeDasharray={t === 0 ? undefined : '2 4'} />
                <text x={-8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--axis)" className="tabular-nums">
                  {nf.format(Math.round(t))}
                </text>
              </g>
            ))}
            {daily.map((d, i) =>
              // Anchor ticks on the most recent day and step backwards, so labels never collide.
              (n - 1 - i) % labelEvery === 0 ? (
                <text key={d.date} x={x(i)} y={h + 18} textAnchor={i === n - 1 ? 'end' : x(i) < 24 ? 'start' : 'middle'} fontSize={11} fill="var(--axis)">
                  {fmtDate(d.date)}
                </text>
              ) : null,
            )}
            {!empty ? (
              <>
                <path d={area} fill="url(#viewsFill)" />
                <path d={path('views')} fill="none" stroke="var(--series-views)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                <path d={path('clicks')} fill="none" stroke="var(--series-clicks)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              </>
            ) : null}
            {hd && hover !== null ? (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={0} y2={h} stroke="var(--axis)" strokeOpacity={0.5} />
                {(['views', 'clicks'] as const).map((k) => (
                  <circle key={k} cx={x(hover)} cy={y(hd[k])} r={4} fill={`var(--series-${k})`} stroke="currentColor" className="text-white dark:text-zinc-900" strokeWidth={2} />
                ))}
              </g>
            ) : null}
          </g>
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {empty ? (
        <p className="pointer-events-none absolute inset-0 grid place-items-center pb-6 text-sm text-zinc-500">
          No visits in this period yet.
        </p>
      ) : null}
      {hd && hover !== null ? (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-32 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          style={{
            left: Math.min(Math.max(pad.left + x(hover) + 12, 0), width - 150),
            ...(pad.left + x(hover) + 160 > width ? { left: pad.left + x(hover) - 150 } : null),
          }}
        >
          <p className="mb-1.5 font-medium text-zinc-500">{fmtDate(hd.date, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
          {(['views', 'clicks'] as const).map((k) => (
            <p key={k} className="flex items-center gap-2">
              <span className="h-0.5 w-3 rounded-full" style={{ background: `var(--series-${k})` }} />
              <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{nf.format(hd[k])}</span>
              <span className="text-zinc-500 capitalize">{k}</span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function DailyTable({ daily }: { daily: AnalyticsSummary['daily'] }) {
  return (
    <div className="max-h-72 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white text-left text-xs text-zinc-500 dark:bg-zinc-900">
          <tr>
            <th className="py-2 font-medium">Date</th>
            <th className="py-2 text-right font-medium">Views</th>
            <th className="py-2 text-right font-medium">Clicks</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {daily
            .slice()
            .reverse()
            .map((d) => (
              <tr key={d.date}>
                <td className="py-1.5">{fmtDate(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                <td className="py-1.5 text-right tabular-nums">{nf.format(d.views)}</td>
                <td className="py-1.5 text-right tabular-nums">{nf.format(d.clicks)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------------- Ranked bar lists ---------------- */

interface Row {
  key: string
  label: string
  sublabel?: string
  value: number
  note?: string
}

function RankedBars({ rows, total, empty, compact }: { rows: Row[]; total: number; empty: string; compact?: boolean }) {
  if (!rows.length || rows.every((r) => r.value === 0 && !r.note))
    return <p className="py-6 text-center text-sm text-zinc-500">{empty}</p>
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ol className={compact ? 'space-y-2.5' : 'space-y-3.5'}>
      {rows.map((r) => (
        <li key={r.key} title={r.note ? `${r.label}: ${nf.format(r.value)} (${r.note})` : `${r.label}: ${nf.format(r.value)}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {r.label}
              {r.sublabel ? <span className="ml-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-500 dark:bg-zinc-800">{r.sublabel}</span> : null}
            </span>
            <span className="shrink-0 tabular-nums">
              <span className="font-semibold">{nf.format(r.value)}</span>
              {total > 0 && !compact ? <span className="ml-1.5 text-xs text-zinc-500">{pct(r.value / total)}</span> : null}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-(--series-views) transition-[width] duration-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          {r.note && !compact ? <p className="mt-1 text-[11px] text-zinc-500">{r.note}</p> : null}
        </li>
      ))}
    </ol>
  )
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' })
  } catch {
    return null
  }
})()
function countryName(code: string) {
  if (code === 'Unknown' || code.length !== 2) return code
  try {
    return regionNames?.of(code) ?? code
  } catch {
    return code
  }
}
