import { useEffect, useReducer, useState } from 'react'
import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react'
import { PageHeader, Card, Badge } from '../components/ui.jsx'
import { reducer, initial, explain, hostLoads, PRESETS, LIMIT, COOLDOWN, N_HIGH, N_LOW, PINNED, SAMPLE_S, REAL, CAP } from '../sim/controllerSim.js'

const STAGES = ['MONITOR', 'DETECT', 'RESTRICT', 'RECOVER', 'EVALUATE']
const ACTIVE = { monitor: 'MONITOR', detect: 'DETECT', cooldown: 'DETECT', restrict: 'RESTRICT', baseline: 'RECOVER', 'util-high': 'RECOVER', pinned: 'RECOVER', 'cooldown-r': 'RECOVER', recover: 'RECOVER', restore: 'RECOVER' }
const BTN = 'inline-flex items-center gap-1.5 rounded-md border border-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-emerald-400/60'

function Gauge({ util, high, low }) {
  const L = Math.PI * 80, pct = Math.min(1, util ?? 0), v = pct * 100
  const color = util == null ? '#52525b' : v > high ? '#f87171' : v < low ? '#34d399' : '#fbbf24'
  const at = (p, r) => { const a = Math.PI * (1 - p / 100); return [100 + r * Math.cos(a), 100 - r * Math.sin(a)] }
  return (
    <svg viewBox="0 -16 200 141" className="mx-auto w-full max-w-sm" role="img" aria-label={`Simulated utilization ${Math.round(v)} percent`}>
      <path d="M20,100 A80,80 0 0 1 180,100" fill="none" stroke="#27272a" strokeWidth="12" strokeLinecap="round" />
      <path d="M20,100 A80,80 0 0 1 180,100" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${pct * L} ${L}`} style={{ transition: 'stroke-dasharray .6s, stroke .3s' }} />
      {[[low, '#34d399'], [high, '#f87171']].map(([p, c]) => {
        const [x1, y1] = at(p, 70), [x2, y2] = at(p, 92), [tx, ty] = at(p, 104)
        return <g key={p}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth="2" />
          <text x={tx} y={ty} textAnchor="middle" className="fill-zinc-500 text-[10px]">{p}%</text></g>
      })}
      <text x="100" y="92" textAnchor="middle" className="fill-zinc-50 text-[28px] font-semibold">{util == null ? '–' : `${Math.round(v)}%`}</text>
      <text x="100" y="112" textAnchor="middle" className="fill-zinc-500 text-[10px]">{util == null ? 'no reading yet' : `${(util * CAP).toFixed(2)} of ${CAP} Mbps`}</text>
    </svg>
  )
}

function Spark({ hist, high, low }) {
  const W = 300, H = 80, x = (i) => i * (W / 39), y = (u) => H - (Math.min(100, u) * H) / 100
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-20 w-full" role="img" aria-label="Simulated utilization history">
      <line x1="0" x2={W} y1={y(high)} y2={y(high)} stroke="#f87171" strokeOpacity=".5" strokeDasharray="4 3" />
      <line x1="0" x2={W} y1={y(low)} y2={y(low)} stroke="#34d399" strokeOpacity=".5" strokeDasharray="4 3" />
      {hist.length > 1 && <polyline fill="none" stroke="#a1a1aa" strokeWidth="1.5" points={hist.map((p, i) => `${x(i)},${y(p.u)}`).join(' ')} />}
      {hist.map((p, i) => p.ev && <circle key={i} cx={x(i)} cy={y(p.u)} r="4" fill={p.ev === 'RESTRICT_APPLIED' ? '#f87171' : '#34d399'} />)}
    </svg>
  )
}

function Pips({ label, n, total, on, color }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-xs text-zinc-500">{label}</span>
      <div className="flex gap-1.5" role="img" aria-label={`${on ? Math.min(n, total) : 0} of ${total}`}>
        {Array.from({ length: total }, (_, i) => <span key={i} className={`h-2.5 w-6 rounded-sm transition-colors ${on && i < n ? color : 'bg-zinc-800'}`} />)}
      </div>
      <span className="font-mono text-xs text-zinc-400">{on ? n : 0}/{total}</span>
    </div>
  )
}

function Slider({ id, label, value, min, max, step, unit, onChange }) {
  return (
    <div>
      <div className="flex justify-between text-xs"><label htmlFor={id} className="text-zinc-300">{label}</label>
        <span className="font-mono text-zinc-400">{Number(value).toFixed(step < 1 ? 1 : 0)}{unit}</span></div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1.5 w-full accent-emerald-400" />
    </div>
  )
}

function HostRow({ id, name, role, value, carried, metered, max, step, onChange }) {
  const pct = (v) => `${Math.min(100, (v / max) * 100)}%`
  const lossy = carried < value - 0.01 && !metered
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-zinc-200"><span className="font-medium">{name}</span> <span className="text-zinc-500">{role}</span></span>
        <span className="font-mono text-zinc-400">carried {carried.toFixed(1)} Mbps</span>
      </div>
      <Slider id={id} label={`${name} offered demand`} value={value} min={0} max={max} step={step} unit=" Mbps" onChange={onChange} />
      <div className="relative h-2 rounded bg-zinc-800" aria-hidden="true">
        <div className="absolute inset-y-0 left-0 rounded bg-zinc-600/60" style={{ width: pct(value) }} />
        <div className={`absolute inset-y-0 left-0 rounded transition-all duration-500 ${lossy ? 'bg-red-400' : 'bg-emerald-400'}`} style={{ width: pct(carried) }} />
        {metered && <div className="absolute -inset-y-1 w-0.5 bg-amber-300" style={{ left: pct(LIMIT) }} />}
      </div>
      {metered && <p className="text-[11px] text-amber-300/80">OpenFlow meter: 3 Mbps cap on s1 (drops the excess)</p>}
    </div>
  )
}

export default function Task2() {
  const [sim, dispatch] = useReducer(reducer, null, () => initial(PRESETS[0].d))
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => dispatch({ type: 'tick' }), 900)
    return () => clearInterval(id)
  }, [playing])

  const ex = explain(sim), L = hostLoads(sim), restricted = sim.state === 'RESTRICTED'
  const cdLeft = Math.max(0, COOLDOWN - (sim.t - sim.tState)), started = Number.isFinite(sim.tState)
  const guard = !restricted ? 'Not used in NORMAL'
    : sim.off === null ? 'Offered load unknown, so counted as pinned'
    : Math.max(sim.off.h1, sim.off.h3) > PINNED * LIMIT ? `PINNED: a bulk host offers ${Math.max(sim.off.h1, sim.off.h3).toFixed(1)} Mbps > ${(PINNED * LIMIT).toFixed(1)}`
    : `Clear: no host above ${(PINNED * LIMIT).toFixed(1)} Mbps`
  const set = (host) => (value) => dispatch({ type: 'demand', host, value })
  const activeStage = ACTIVE[sim.phase]

  return (
    <div className="space-y-6">
      <PageHeader kicker="Task 2 · Congestion Control" title="The controller, one reading at a time">
        A deterministic model of controller_app.py. Change the traffic, then play or step through each decision. Simplifications: one reading ≈ 2 s, offered load equals the demand sliders, and an overloaded link is shared proportionally.
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setPlaying(!playing)} className={`${BTN} !border-zinc-100 !bg-zinc-100 !text-zinc-900 hover:!bg-white`}>
          {playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause' : 'Start'}
        </button>
        <button onClick={() => { setPlaying(false); dispatch({ type: 'tick' }) }} className={BTN}><SkipForward size={14} />Step</button>
        <button onClick={() => { setPlaying(false); dispatch({ type: 'reset' }) }} className={BTN}><RotateCcw size={14} />Reset</button>
        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-xs text-zinc-500">t = {sim.t} s · reading {sim.n} (1 reading ≈ {SAMPLE_S} s)</span>
          <Badge tone="warn">Simulated values, not ONOS measurements</Badge>
        </div>
      </div>

      <ol className="grid grid-cols-5 gap-1.5" aria-label="Control loop stage">
        {STAGES.map((s) => (
          <li key={s} title={s === 'EVALUATE' ? 'Offline: experiment.py and analyze.py' : undefined}
            className={`rounded-md border px-1 py-1.5 text-center text-[10px] font-medium sm:px-2 sm:text-[11px] transition-colors ${
              s === activeStage ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300' : 'border-zinc-800 text-zinc-500'}`}>
            {s}{s === 'EVALUATE' && <span className="hidden sm:inline font-normal"> · offline</span>}
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs font-medium text-zinc-500">Bottleneck utilization (s1 → s2)</p>
          <Gauge util={sim.util} high={sim.high} low={sim.low} />
          <Spark hist={sim.hist} high={sim.high} low={sim.low} />
          <p className="mt-1 text-[11px] text-zinc-500">Dashed lines: restrict threshold (red) and recovery threshold (green). Dots mark RESTRICT and RESTORE.</p>
        </Card>

        <Card className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-500">Controller state</p>
            <Badge tone={restricted ? 'accent' : 'neutral'}>{sim.state}</Badge>
          </div>
          <Pips label="Detect (hi)" n={sim.hi} total={N_HIGH} on={!restricted} color="bg-amber-400" />
          <Pips label="Recover (lo)" n={sim.lo} total={N_LOW} on={restricted} color="bg-emerald-400" />
          <div>
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Cooldown ({COOLDOWN} s)</span>
              <span className="font-mono text-zinc-400">{!started ? 'none yet (startup)' : cdLeft > 0 ? `${cdLeft.toFixed(0)} s left` : 'elapsed'}</span></div>
            <div className="mt-1.5 h-1.5 rounded bg-zinc-800"><div className="h-full rounded bg-zinc-400 transition-all" style={{ width: `${started ? (cdLeft / COOLDOWN) * 100 : 0}%` }} /></div>
          </div>
          <div className="text-xs"><span className="text-zinc-500">Pinned-host guard: </span><span className="text-zinc-300">{guard}</span></div>
          <p className="border-t border-zinc-800 pt-3 text-xs text-zinc-500">
            Detect: more than {sim.high}% for {N_HIGH} readings. Recover: below {sim.low}% for {N_LOW} readings, no pinned host, cooldown elapsed.
          </p>
        </Card>
      </div>

      <Card className="space-y-5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium text-zinc-500">Offered traffic</p>
          <span className="ml-auto text-xs text-zinc-500">Presets</span>
          {PRESETS.map((p) => <button key={p.id} onClick={() => dispatch({ type: 'preset', d: p.d })} className={`${BTN} !py-1 !text-xs`}>{p.label}</button>)}
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <HostRow id="d1" name="h1" role="bulk" value={sim.demand.h1} carried={L.h1} metered={restricted} max={30} step={0.5} onChange={set('h1')} />
          <HostRow id="d2" name="h2" role="latency-sensitive (never metered)" value={sim.demand.h2} carried={L.h2} max={5} step={0.1} onChange={set('h2')} />
          <HostRow id="d3" name="h3" role="bulk" value={sim.demand.h3} carried={L.h3} metered={restricted} max={30} step={0.5} onChange={set('h3')} />
        </div>
        <p className="text-sm text-zinc-400">
          <span className="text-zinc-500">h2 path: </span>
          {L.over ? <span className="text-red-300">the link is overloaded, so queues build and h2 latency would rise</span>
            : <span className="text-emerald-300">the link has headroom, so h2 latency stays low</span>}
        </p>
        <div className="grid gap-5 border-t border-zinc-800 pt-4 sm:grid-cols-2">
          <Slider id="hi" label={`Restrict threshold (real controller: ${REAL.high}%)`} value={sim.high} min={60} max={95} step={1} unit="%" onChange={(v) => dispatch({ type: 'params', key: 'high', value: v })} />
          <Slider id="lo" label={`Recovery threshold (real controller: ${REAL.low}%)`} value={sim.low} min={20} max={55} step={1} unit="%" onChange={(v) => dispatch({ type: 'params', key: 'low', value: v })} />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-50">{ex.title}</h2><Badge>What · Why · How</Badge>
        </div>
        <div aria-live={playing ? 'off' : 'polite'} className="mt-3 grid gap-5 lg:grid-cols-2">
          <dl className="space-y-3 text-sm">
            <div><dt className="text-xs text-zinc-500">What happens</dt><dd className="mt-0.5 text-zinc-200">{ex.what}</dd></div>
            <div><dt className="text-xs text-zinc-500">Why</dt><dd className="mt-0.5 text-zinc-300">{ex.why}</dd></div>
          </dl>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-xs text-zinc-500">Python function</dt><dd className="mt-0.5 font-mono text-[13px] text-zinc-200">{ex.fn}</dd></div>
            <div><dt className="text-xs text-zinc-500">ONOS REST request</dt><dd className="mt-0.5 break-all font-mono text-[13px] text-zinc-200">{ex.rest}</dd></div>
            <div><dt className="text-xs text-zinc-500">OpenFlow mechanism</dt><dd className="mt-0.5 text-zinc-300">{ex.of}</dd></div>
          </dl>
        </div>
        <pre className="mt-4 overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950 py-2 font-mono text-[12.5px] leading-6">
          {ex.code.map((l, i) => <div key={i} className={`px-3 ${ex.hl.includes(i) ? 'bg-emerald-400/10 text-emerald-200' : 'text-zinc-500'}`}>{l || ' '}</div>)}
        </pre>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2"><p className="text-xs font-medium text-zinc-500">Decision log</p><Badge tone="warn">simulated</Badge>
          <span className="text-[11px] text-zinc-500">same columns as controller_log.csv</span></div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left font-mono text-xs">
            <thead className="text-zinc-500"><tr>{['t (s)', 'rate', 'util %', 'state', 'hi', 'lo', 'off_h1', 'off_h3', 'event'].map((h) => <th key={h} className="pb-1.5 pr-3 font-normal">{h}</th>)}</tr></thead>
            <tbody className="text-zinc-300">
              {sim.rows.slice(-8).map((r) => (
                <tr key={r.t} className="border-t border-zinc-800/70">
                  <td className="py-1 pr-3">{r.t}</td><td className="pr-3">{r.rate.toFixed(2)}</td><td className="pr-3">{r.util.toFixed(1)}</td>
                  <td className="pr-3">{r.state}</td><td className="pr-3">{r.hi}</td><td className="pr-3">{r.lo}</td>
                  <td className="pr-3">{r.h1 === '' ? '' : r.h1.toFixed(2)}</td><td className="pr-3">{r.h3 === '' ? '' : r.h3.toFixed(2)}</td>
                  <td className="text-emerald-300">{r.ev}</td>
                </tr>
              ))}
              {sim.rows.length === 0 && <tr><td colSpan="9" className="py-2 text-zinc-500">No readings yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
