import { useEffect, useMemo, useState } from 'react'
import { Play, Pause, RotateCcw, Upload } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer } from 'recharts'
import { PageHeader, Card, Badge } from '../components/ui.jsx'

const N_HIGH = 3, N_LOW = 5                         // from app/controller_app.py
const COL = { B: '#f87171', C: '#34d399', grey: '#a1a1aa', dim: '#71717a' }
const WIN = [['pre', 'Baseline'], ['during_early', 'Congestion onset'], ['during_steady', 'Sustained congestion'], ['post', 'Recovery']]
const fmt = (v, d = 1) => (v == null ? '–' : Number(v).toFixed(d))
const at = (arr, t) => { let r = null; for (const p of arr || []) { if (p.t <= t) r = p; else break } return r }
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60'
const BTN = `inline-flex items-center gap-1.5 rounded-md border border-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 ${FOCUS}`

function Missing({ onLoad }) {
  const [err, setErr] = useState('')
  const load = async (e) => {
    try { onLoad(JSON.parse(await e.target.files[0].text())) } catch { setErr('That file is not a valid results.json.') }
  }
  return (
    <div className="space-y-6">
      <PageHeader kicker="Experiments & Results" title="Recorded experiments" />
      <Card className="space-y-3 p-5 text-sm text-zinc-300">
        <p>No data file found. Generate it from your saved results (read-only), then reload:</p>
        <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-[13px]">python3 ~/dcn-project/dashboard/tools/build_data.py</pre>
        <label className={`${BTN} cursor-pointer`}><Upload size={14} />Or import a results.json
          <input type="file" accept=".json" className="sr-only" onChange={load} /></label>
        {err && <p className="text-red-300">{err}</p>}
      </Card>
    </div>
  )
}

function TimeChart({ title, data, lines, duration, cursor, bulk, events = [], scale = 'linear', domain, ticks, unit, refs = [], empty, note }) {
  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-zinc-200">{title}</h3><span className="text-[11px] text-zinc-500">{unit}</span>
      </div>
      {empty ? <p className="py-12 text-center text-sm text-zinc-500">{empty}</p> : (
        <div className="mt-2 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="#27272a" vertical={false} />
              <XAxis type="number" dataKey="t" domain={[0, duration]} allowDataOverflow stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(v) => `${v}s`} />
              <YAxis scale={scale} domain={domain || [0, 'auto']} ticks={ticks} allowDataOverflow width={44} stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 11 }} />
              <Tooltip cursor={{ stroke: '#52525b' }} contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 6, fontSize: 12 }}
                labelFormatter={(t) => `t = ${t} s`} formatter={(v) => fmt(v, 2)} />
              <ReferenceArea x1={bulk[0]} x2={bulk[1]} fill="#a1a1aa" fillOpacity={0.07} />
              {refs.map((r) => <ReferenceLine key={r.y} y={r.y} stroke={r.color} strokeDasharray="4 3" strokeOpacity={0.6} />)}
              {events.map((e, i) => <ReferenceLine key={i} x={e.t} stroke={e.type === 'RESTRICT_APPLIED' ? COL.B : COL.C} strokeDasharray="4 3" />)}
              {lines.map((l) => <Line key={l.key} dataKey={l.key} name={l.name} stroke={l.color} type={l.type || 'monotone'} dot={false} strokeWidth={1.5} isAnimationActive={false} connectNulls />)}
              <ReferenceLine x={cursor} stroke="#fafafa" strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {note && <p className="mt-1 text-[11px] text-zinc-500">{note}</p>}
    </Card>
  )
}

function describe(run, t, c, K) {
  const early = K.bulk_start + K.early_s
  const phase = t < K.bulk_start ? 'pre' : t < early ? 'early' : t < K.bulk_stop ? 'steady' : 'post'
  const label = { pre: 'Baseline', early: 'Congestion onset', steady: 'Sustained congestion', post: 'Recovery' }[phase]
  if (phase === 'pre') return [label, 'Only h2 sends light traffic (ping and 1 Mbps UDP). The bottleneck has headroom, so latency sits at the baseline.']
  if (run.scenario === 'B') {
    return [label, phase === 'post'
      ? 'Bulk traffic has stopped. With no controller, the queue just drains and latency falls back toward the baseline.'
      : 'h1 and h3 send with no control, so they compete with h2 for the 10 Mbps link. Watch the latency and loss charts.']
  }
  if (!c) return [label, 'No controller log rows cover this moment.']
  if (phase === 'post') return c.state === 'RESTRICTED'
    ? [label, `Bulk traffic has stopped. The controller needs ${N_LOW} readings below 50% (lo = ${c.lo} of ${N_LOW}), no pinned host, and the cooldown before it restores.`]
    : [label, 'Normal forwarding has been restored.']
  return c.state === 'NORMAL'
    ? [label, `Bulk traffic is flowing and the controller counts readings above 80% (hi = ${c.hi} of ${N_HIGH}). Nothing is restricted yet, so h2 still shares the queue with bulk traffic.`]
    : [label, 'RESTRICTED: ONOS meters hold h1 and h3 to about 3 Mbps each. h2 is never metered, so the queue drains and its latency falls.']
}

function Compare({ table }) {
  const [win, setWin] = useState('during_steady')
  const rows = table.filter((r) => r.window === win)
  return (
    <section aria-labelledby="cmp" className="space-y-3">
      <h2 id="cmp" className="text-sm font-medium text-zinc-300">Before and after (mean ± sd over runs)</h2>
      <div role="group" aria-label="Time window" className="inline-flex flex-wrap rounded-lg border border-zinc-800 bg-zinc-900/40 p-0.5">
        {WIN.map(([k, l]) => (
          <button key={k} onClick={() => setWin(k)} aria-pressed={win === k}
            className={`rounded-md px-3 py-1.5 text-sm ${FOCUS} ${win === k ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:text-zinc-100'}`}>{l}</button>
        ))}
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="text-xs text-zinc-500"><tr>
            <th className="px-4 py-2 font-normal">Metric</th><th className="px-2 py-2 font-normal">B · no control</th>
            <th className="px-2 py-2 font-normal">C · ONOS control</th><th className="px-4 py-2 font-normal">Comparison</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const mx = Math.max(r.B_mean ?? 0, r.C_mean ?? 0, 1e-9)
              return (
                <tr key={r.metric} className="border-t border-zinc-800">
                  <td className="px-4 py-2 text-zinc-300">{r.metric}</td>
                  <td className="px-2 py-2 font-mono text-[13px] text-zinc-200">{fmt(r.B_mean, 2)} <span className="text-zinc-500">± {fmt(r.B_sd, 2)}</span></td>
                  <td className="px-2 py-2 font-mono text-[13px] text-zinc-200">{fmt(r.C_mean, 2)} <span className="text-zinc-500">± {fmt(r.C_sd, 2)}</span></td>
                  <td className="w-40 px-4 py-2" aria-hidden="true">
                    <div className="h-1.5 rounded-sm" style={{ width: `${((r.B_mean ?? 0) / mx) * 100}%`, background: COL.B, opacity: 0.7 }} />
                    <div className="mt-1 h-1.5 rounded-sm" style={{ width: `${((r.C_mean ?? 0) / mx) * 100}%`, background: COL.C }} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-zinc-500">Bars: red = no control, green = ONOS control, scaled per row. Window boundaries follow experiment.py (bulk traffic 10–40 s; "onset" = first 12 s).</p>
    </section>
  )
}

function Loaded({ data }) {
  const { runs, table, constants: K } = data
  const [runId, setRunId] = useState(null)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(4)
  const run = runs.find((r) => r.id === runId) ?? runs.find((r) => r.id === 'C_run1') ?? runs[0]
  const D = run.duration

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setT((x) => Math.min(D, x + 0.1 * speed)), 100)
    return () => clearInterval(id)
  }, [playing, speed, D])
  useEffect(() => { if (playing && t >= D) setPlaying(false) }, [t, playing, D])

  const thr = useMemo(() => {
    const m = {}
    const put = (arr, key) => arr.forEach((p) => { const k = p.t.toFixed(1); (m[k] ??= { t: Number(k) })[key] = p.mbps })
    put(run.h2, 'h2'); put(run.h1, 'h1'); put(run.h3, 'h3')
    return Object.values(m).sort((a, b) => a.t - b.t)
  }, [run])
  const jitter = useMemo(() => run.h2.filter((p) => p.jitter != null).map((p) => ({ t: p.t, v: p.jitter })), [run])
  const ctrl = run.controller
  const util = useMemo(() => (ctrl ? ctrl.rows.filter((r) => r.t >= 0 && r.t <= D).map((r) => ({ t: r.t, v: r.util })) : []), [ctrl, D])
  const events = (ctrl?.events || []).filter((e) => e.t >= 0 && e.t <= D)
  const c = at(ctrl?.rows, t), th = at(thr, t)
  const [label, text] = describe(run, t, c, K)
  const common = { duration: D, cursor: t, bulk: [K.bulk_start, K.bulk_stop], events }

  const g = (w, m, s) => table.find((r) => r.window === w && r.metric === m)?.[`${s}_mean`]
  const timings = runs.filter((r) => r.controller?.timing).map((r) => ({ id: r.id, ...r.controller.timing }))
  const dMean = mean(timings.map((x) => x.detect_s)), rMean = mean(timings.map((x) => x.recover_s))
  const nB = runs.filter((r) => r.scenario === 'B').length, nC = runs.filter((r) => r.scenario === 'C').length
  const KPI = [['Ping avg (ms)', 'Ping avg (ms)', 1], ['Ping loss (%)', 'Ping loss (%)', 1], ['UDP loss (%)', 'UDP loss (%)', 1], ['UDP jitter (ms)', 'UDP jitter (ms)', 2]]

  return (
    <div className="space-y-8">
      <PageHeader kicker="Experiments & Results" title="What the recorded runs show">
        Everything on this page is recorded data from results/ ({nB} runs without control, {nC} with ONOS control). Nothing here is simulated.
      </PageHeader>

      <section aria-label="Key results" className="space-y-2">
        <p className="text-xs text-zinc-500">Protected h2 traffic during sustained congestion</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {KPI.map(([m, l, d]) => (
            <Card key={m} className="p-3">
              <p className="text-xs text-zinc-500">{l}</p>
              <p className="mt-1.5 flex items-baseline gap-2 font-mono">
                <span className="text-sm text-red-300/90">{fmt(g('during_steady', m, 'B'), d)}</span><span className="text-zinc-500">→</span>
                <span className="text-lg text-emerald-300">{fmt(g('during_steady', m, 'C'), d)}</span>
              </p>
            </Card>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500">Red = no control, green = ONOS control.</p>
      </section>

      <section aria-label="Experiment replay" className="space-y-3">
        <div className="flex items-center gap-2"><h2 className="text-sm font-medium text-zinc-300">Experiment replay</h2><Badge>recorded data</Badge></div>
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Run" value={run.id} onChange={(e) => { setRunId(e.target.value); setT(0); setPlaying(false) }}
              className={`rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 ${FOCUS}`}>
              {runs.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.scenario === 'B' ? 'no control' : 'ONOS control'}</option>)}
            </select>
            <button onClick={() => (t >= D ? (setT(0), setPlaying(true)) : setPlaying(!playing))} className={`${BTN} !border-zinc-100 !bg-zinc-100 !text-zinc-900 hover:!bg-white`}>
              {playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause' : 'Play'}
            </button>
            <button onClick={() => { setPlaying(false); setT(0) }} className={BTN}><RotateCcw size={14} />Reset</button>
            <div role="group" aria-label="Speed" className="inline-flex rounded-md border border-zinc-800 p-0.5">
              {[1, 2, 4, 8].map((s) => (
                <button key={s} onClick={() => setSpeed(s)} aria-pressed={speed === s}
                  className={`rounded px-2 py-1 text-xs ${FOCUS} ${speed === s ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-500 hover:text-zinc-200'}`}>{s}×</button>
              ))}
            </div>
            <span className="ml-auto font-mono text-xs text-zinc-400">t = {t.toFixed(1)} s / {D} s</span>
          </div>
          <input type="range" aria-label="Timeline position" min={0} max={D} step={0.1} value={t} className="w-full accent-emerald-400"
            onChange={(e) => { setPlaying(false); setT(Number(e.target.value)) }} />
          <div className="flex flex-wrap items-start gap-3 border-t border-zinc-800 pt-3">
            <Badge tone={label === 'Baseline' ? 'neutral' : 'accent'}>{label}</Badge>
            <p className="flex-1 text-sm leading-relaxed text-zinc-300" aria-live={playing ? 'off' : 'polite'}>{text}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 border-t border-zinc-800 pt-3 sm:grid-cols-3 lg:grid-cols-6">
            {[['h2 latency', `${fmt(at(run.ping, t)?.v)} ms`], ['h2 UDP', `${fmt(th?.h2, 2)} Mbps`],
              ['h1 / h3 delivered', `${fmt(th?.h1)} / ${fmt(th?.h3)} Mbps`], ['Ping loss', `${fmt(at(run.pingLoss, t)?.v, 0)}% this second`],
              ['Utilization', ctrl ? `${fmt(c?.util)}%` : 'not logged for B'], ['Controller', ctrl ? `${c?.state ?? '–'}` : 'none in B']].map(([k, v]) => (
              <div key={k}><dt className="text-[11px] text-zinc-500">{k}</dt><dd className="mt-0.5 font-mono text-[13px] text-zinc-100">{v}</dd></div>
            ))}
          </dl>
          {events.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
              <span className="text-xs text-zinc-500">Controller decisions</span>
              {events.map((e, i) => (
                <button key={i} onClick={() => { setPlaying(false); setT(Math.min(D, e.t)) }} className={`${BTN} !py-1 !text-xs`}>
                  {e.type === 'RESTRICT_APPLIED' ? 'Restrict' : 'Restore'} @ {e.t.toFixed(1)} s{e.action_ms != null ? ` · ${Math.round(e.action_ms)} ms` : ''}
                </button>
              ))}
            </div>
          )}
        </Card>

        <div className="grid gap-3 lg:grid-cols-2">
          <TimeChart {...common} title="h2 latency (ping RTT)" unit="ms, log scale" data={run.ping} lines={[{ key: 'v', name: 'RTT', color: run.scenario === 'B' ? COL.B : COL.C }]}
            scale="log" domain={[5, 'dataMax']} ticks={[10, 100, 1000, 10000]} note="Shaded band: bulk traffic on (10–40 s). Dashed lines: restrict / restore applied." />
          <TimeChart {...common} title="Delivered throughput" unit="Mbps, per second" data={thr} domain={[0, 'auto']}
            lines={[{ key: 'h1', name: 'h1 bulk', color: COL.grey }, { key: 'h3', name: 'h3 bulk', color: COL.dim }, { key: 'h2', name: 'h2 UDP (protected)', color: COL.C }]}
            note="From the iperf3 receiver logs. h1 and h3 are measured only while bulk traffic runs." />
          <TimeChart {...common} title="Bottleneck utilization (s1 → s2)" unit="% of 10 Mbps" data={util} lines={[{ key: 'v', name: 'Utilization', color: COL.grey }]}
            domain={[0, 110]} refs={[{ y: 80, color: COL.B }, { y: 50, color: COL.C }]}
            empty={ctrl ? null : 'Utilization comes from the controller log, so it exists only for C runs. Pick a C run.'} note="Red line 80%: restrict threshold. Green line 50%: recovery threshold." />
          <TimeChart {...common} title="h2 ping loss" unit="% per second" data={run.pingLoss} lines={[{ key: 'v', name: 'Ping loss', color: COL.B, type: 'stepAfter' }]} domain={[0, 100]} />
          <TimeChart {...common} title="h2 UDP jitter" unit="ms, per second" data={jitter} lines={[{ key: 'v', name: 'Jitter', color: COL.grey }]} domain={[0, 'auto']} />
        </div>
      </section>

      <Compare table={table} />

      <section aria-labelledby="timing" className="space-y-3">
        <h2 id="timing" className="text-sm font-medium text-zinc-300">Controller timing (C runs)</h2>
        {timings.length === 0 ? <p className="text-sm text-zinc-500">No complete restrict + restore cycle found in the controller log.</p> : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-left text-sm">
              <thead className="text-xs text-zinc-500"><tr>{['Run', 'Detection (s)', 'Restrict action (ms)', 'Recovery (s)', 'Restore action (ms)'].map((h) => <th key={h} className="px-4 py-2 font-normal">{h}</th>)}</tr></thead>
              <tbody className="font-mono text-[13px] text-zinc-200">
                {timings.map((x) => (
                  <tr key={x.id} className="border-t border-zinc-800"><td className="px-4 py-2">{x.id}</td><td className="px-4">{fmt(x.detect_s)}</td>
                    <td className="px-4">{fmt(x.restrict_ms, 0)}</td><td className="px-4">{fmt(x.recover_s)}</td><td className="px-4">{fmt(x.restore_ms, 0)}</td></tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        <p className="text-xs text-zinc-500">Detection: bulk start to restriction applied. Recovery: bulk stop to restore applied. Same method as app/analyze.py.</p>
      </section>

      <section aria-labelledby="trade" className="space-y-3">
        <h2 id="trade" className="text-sm font-medium text-zinc-300">Reading the results, and the trade-offs</h2>
        <Card className="p-5">
          <ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed text-zinc-300">
            <li><span className="text-zinc-100">Protected traffic wins.</span> In sustained congestion, h2 ping averages {fmt(g('during_steady', 'Ping avg (ms)', 'C'))} ms with control versus {fmt(g('during_steady', 'Ping avg (ms)', 'B'))} ms without, and ping loss falls from {fmt(g('during_steady', 'Ping loss (%)', 'B'))}% to {fmt(g('during_steady', 'Ping loss (%)', 'C'))}%.</li>
            <li><span className="text-zinc-100">Bulk traffic pays.</span> h1 and h3 average {fmt(g('during_steady', 'Bulk h1 (Mbps)', 'C'), 2)} and {fmt(g('during_steady', 'Bulk h3 (Mbps)', 'C'), 2)} Mbps with control, against {fmt(g('during_steady', 'Bulk h1 (Mbps)', 'B'), 2)} and {fmt(g('during_steady', 'Bulk h3 (Mbps)', 'B'), 2)} Mbps without. That is the intended cost of protecting h2.</li>
            <li><span className="text-zinc-100">Detection is not instant.</span> In the first {K.early_s} s after bulk starts, ping still averages {fmt(g('during_early', 'Ping avg (ms)', 'C'))} ms with control ({fmt(g('during_early', 'Ping avg (ms)', 'B'))} ms without), because the controller needs {N_HIGH} readings above 80% before it acts{dMean != null ? `; measured detection took about ${fmt(dMean)} s` : ''}.</li>
            <li><span className="text-zinc-100">Recovery is deliberately cautious.</span> {rMean != null ? `Restore came about ${fmt(rMean)} s after bulk stopped, ` : ''}because it needs {N_LOW} readings below 50%, no pinned host, and the 15 s cooldown. In the recovery window, ping averages {fmt(g('post', 'Ping avg (ms)', 'C'))} ms with control versus {fmt(g('post', 'Ping avg (ms)', 'B'))} ms without.</li>
            <li><span className="text-zinc-100">Limits.</span> {nB} B runs and {nC} C runs. Utilization was logged only for C runs. Per-second charts come from ping and iperf3 server logs, so very short events can fall between samples.</li>
          </ul>
        </Card>
      </section>
      <p className="text-[11px] text-zinc-500">Data generated {data.generated}. Re-run tools/build_data.py after new experiments.</p>
    </div>
  )
}

export default function Results() {
  const [state, setState] = useState({ status: 'loading', data: null })
  useEffect(() => {
    fetch('/data/results.json').then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((data) => setState({ status: 'ok', data })).catch(() => setState({ status: 'missing', data: null }))
  }, [])
  if (state.status === 'loading') return <p className="text-sm text-zinc-500">Loading recorded results…</p>
  if (state.status === 'missing' || !state.data.runs?.length) return <Missing onLoad={(data) => setState({ status: 'ok', data })} />
  return <Loaded data={state.data} />
}
