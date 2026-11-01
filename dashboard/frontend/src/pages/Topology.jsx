import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { PageHeader, Card, Badge } from '../components/ui.jsx'
import { NODES, LINKS, SCENARIOS, getInfo } from '../data/topology.js'

const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const route = (src, dst) => 'M' + [src, 's1', 's2', 's3', dst].map((k) => `${NODES[k].x},${NODES[k].y}`).join(' L')
const DOT = { bulk: '#d4d4d8', ok: '#34d399' }
const keyActivate = (fn) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() } }
const FOCUS = 'cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-emerald-400'

function bottleneckColor(scen) {
  return scen === 'congested' ? '#f87171' : scen === 'controlled' ? '#34d399' : '#fbbf24'
}

export default function Topology() {
  const [scen, setScen] = useState('normal')
  const [sel, setSel] = useState({ type: 'link', id: 's1-s2' })
  const [paused, setPaused] = useState(false)
  const svgRef = useRef(null)
  const [tbl, setTbl] = useState([])
  useEffect(() => {
    fetch('/data/results.json').then((r) => r.json()).then((d) => setTbl(d.table || [])).catch(() => {})
  }, [])
  const g = (w, m, s) => tbl.find((r) => r.window === w && r.metric === m)?.[`${s}_mean`]
  const f = (v, d = 1) => (v == null ? '–' : Number(v).toFixed(d))
  const RECORDED = tbl.length === 0 ? 'Run tools/build_data.py to show recorded values here.' : {
    normal: `Baseline window: ping ${f(g('pre', 'Ping avg (ms)', 'B'))} ms (B runs) and ${f(g('pre', 'Ping avg (ms)', 'C'))} ms (C runs), ${f(g('pre', 'Ping loss (%)', 'B'))}% loss.`,
    congested: `B runs, sustained congestion: ping ${f(g('during_steady', 'Ping avg (ms)', 'B'))} ms, ping loss ${f(g('during_steady', 'Ping loss (%)', 'B'))}%, UDP loss ${f(g('during_steady', 'UDP loss (%)', 'B'))}%.`,
    controlled: `C runs, sustained congestion: ping ${f(g('during_steady', 'Ping avg (ms)', 'C'))} ms, ping loss ${f(g('during_steady', 'Ping loss (%)', 'C'))}%, UDP loss ${f(g('during_steady', 'UDP loss (%)', 'C'))}%.`,
  }[scen]
  const S = SCENARIOS[scen]
  const info = getInfo(sel, scen)

  const chooseScenario = (k) => { svgRef.current?.unpauseAnimations?.(); setPaused(false); setScen(k) }
  const togglePause = () => {
    const s = svgRef.current
    if (!s) return
    paused ? s.unpauseAnimations() : s.pauseAnimations()
    setPaused(!paused)
  }

  return (
    <div className="space-y-6">
      <PageHeader kicker="Network Topology" title="Our network in three states">
        Select any device or link. Packet movement is an illustrative simulation, not live or measured data.
      </PageHeader>

      <div role="group" aria-label="Scenario" className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900/40 p-0.5">
        {Object.entries(SCENARIOS).map(([k, s]) => (
          <button key={k} onClick={() => chooseScenario(k)} aria-pressed={scen === k}
            className={`rounded-md px-3.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
              scen === k ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:text-zinc-100'}`}>
            {s.label}
          </button>
        ))}
      </div>

      <Card className="p-3 sm:p-4">
        <svg ref={svgRef} viewBox="0 0 920 360" className="h-auto w-full" role="group" aria-label="Network topology diagram">
          {LINKS.map((l) => {
            const a = NODES[l.a], b = NODES[l.b], bn = l.kind === 'bottleneck'
            const selected = sel.type === 'link' && sel.id === l.id
            const pick = () => setSel({ type: 'link', id: l.id })
            return (
              <g key={l.id} role="button" tabIndex={0} aria-label={`Link ${l.a} to ${l.b}. Show details`} aria-pressed={selected}
                onClick={pick} onKeyDown={keyActivate(pick)} className={FOCUS}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeLinecap="round"
                  stroke={bn ? bottleneckColor(scen) : selected ? '#a1a1aa' : '#3f3f46'}
                  strokeWidth={(bn ? 5 : 2) + (selected ? 2 : 0)} />
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="18" />
              </g>
            )
          })}

          {!reduceMotion && S.flows.map(([src, dst, n, dur, kind], fi) =>
            Array.from({ length: n }, (_, i) => (
              <circle key={`${scen}-${fi}-${i}`} r="3.5" fill={DOT[kind]} pointerEvents="none">
                <animateMotion dur={`${dur}s`} begin={`${((i * dur) / n).toFixed(2)}s`} repeatCount="indefinite" path={route(src, dst)} />
              </circle>
            )))}

          {Object.entries(NODES).map(([id, n]) => {
            const host = n.kind === 'host', w = host ? 112 : 64
            const selected = sel.type === 'node' && sel.id === id
            const pick = () => setSel({ type: 'node', id })
            return (
              <g key={id} role="button" tabIndex={0} aria-label={`${n.title}. Show details`} aria-pressed={selected}
                onClick={pick} onKeyDown={keyActivate(pick)} className={FOCUS}>
                <rect x={n.x - w / 2} y={n.y - 22} width={w} height="44" rx="9" fill="#18181b"
                  stroke={selected ? '#fafafa' : n.cls === 'latency' ? '#34d399' : '#52525b'} strokeWidth={selected ? 2 : 1.25} />
                <text x={n.x} y={host ? n.y - 2 : n.y + 5} textAnchor="middle" className="fill-zinc-100 text-[13px] font-medium">{id}</text>
                {host && <text x={n.x} y={n.y + 13} textAnchor="middle" className="fill-zinc-500 text-[10px]">{n.sub}</text>}
              </g>
            )
          })}

          <text x="415" y="162" textAnchor="middle" className="fill-zinc-300 text-[11px]">10 Mbps · 5 ms</text>
          <text x="630" y="162" textAnchor="middle" className="fill-zinc-500 text-[11px]">100 Mbps</text>

          {scen === 'congested' && ['350,171', '382,189', '414,171'].map((p, i) => (
            <text key={p} x={p.split(',')[0]} y={p.split(',')[1]} textAnchor="middle" fill="#f87171" className="text-[13px]" pointerEvents="none">
              ✕<animate attributeName="opacity" values="1;0.1;1" dur="1.2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
            </text>
          ))}
          {scen === 'controlled' && (
            <g pointerEvents="none">
              <rect x="235" y="112" width="180" height="24" rx="6" fill="#022c22" stroke="#34d399" strokeOpacity="0.6" />
              <text x="325" y="128" textAnchor="middle" className="fill-emerald-300 text-[11px]">meters: h1, h3 → 3 Mbps</text>
            </g>
          )}
        </svg>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-3">
          <Badge tone="warn">Illustrative simulation</Badge>
          <span className="text-xs text-zinc-500">Load on s1–s2</span>
          <div className="h-1.5 min-w-24 flex-1 rounded bg-zinc-800" role="img" aria-label={`Illustrative load: ${S.loadText}`}>
            <div className={`h-full rounded transition-all duration-500 ${S.tone}`} style={{ width: `${S.load}%` }} />
          </div>
          <span className="text-xs text-zinc-400">{S.loadText}</span>
          {!reduceMotion && (
            <button onClick={togglePause} aria-label={paused ? 'Play animation' : 'Pause animation'}
              className="rounded-md border border-zinc-800 p-1.5 text-zinc-300 outline-none hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-emerald-400/60">
              {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-50">{info.title}</h2>
            <Badge tone={info.badge === 'Bottleneck' ? 'warn' : 'neutral'}>{info.badge}</Badge>
          </div>
          <dl className="mt-3 divide-y divide-zinc-800 text-sm">
            {info.rows.map(([k, v]) => (
              <div key={k} className="grid gap-1 py-1.5 sm:grid-cols-[8rem_1fr]">
                <dt className="text-zinc-500">{k}</dt><dd className="font-mono text-[13px] text-zinc-200">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">{info.what}</p>
          <p className="mt-3 border-t border-zinc-800 pt-3 text-sm leading-relaxed text-zinc-200" aria-live="polite">
            <span className="text-zinc-500">In this state: </span>{info.note}
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-zinc-50">{S.label}</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">{S.blurb}</p>
          <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <div className="mb-1.5"><Badge>recorded results (results/)</Badge></div>
            <p className="text-sm text-zinc-300">{RECORDED}</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
