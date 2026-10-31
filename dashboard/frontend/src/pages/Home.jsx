import { Link } from 'react-router-dom'

const STAGES = [
  ['MONITOR', 'Read link utilization from ONOS every ~2 seconds.'],
  ['DETECT', 'Utilization above 80% for 3 readings in a row = congestion.'],
  ['RESTRICT', 'Meters cap bulk hosts h1 and h3 at 3 Mbps each.'],
  ['RECOVER', 'Below 50% for 5 readings, after cooldown: restore normal.'],
  ['EVALUATE', 'Compare latency, loss and throughput across experiments.'],
]

export default function Home() {
  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Learn <span className="text-cyan-400">Software-Defined Networking</span> by exploring a real project
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-300">
          No networking background needed. See what happens, how it happens, and why, using an SDN
          network that detects congestion and fixes it automatically.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/learn" className="rounded-lg bg-cyan-500 px-5 py-2.5 font-semibold text-slate-950 hover:bg-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
            Start learning
          </Link>
          <Link to="/live" className="rounded-lg border border-slate-700 px-5 py-2.5 font-semibold text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
            Open Live Lab
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold">The congestion-control loop</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STAGES.map(([name, text], i) => (
            <li key={name} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs font-semibold text-cyan-400">STEP {i + 1}</p>
              <p className="mt-1 font-bold">{name}</p>
              <p className="mt-2 text-sm text-slate-400">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-bold">📘 Learning Mode</h2>
          <p className="mt-2 text-sm text-slate-400">Lessons, topology, walkthroughs, replay and quizzes. Works offline, with no ONOS needed.</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-bold">🔴 Live Lab Mode</h2>
          <p className="mt-2 text-sm text-slate-400">Read-only view of your running ONOS network. Optional; Learning Mode works without it.</p>
        </div>
      </section>
    </div>
  )
}