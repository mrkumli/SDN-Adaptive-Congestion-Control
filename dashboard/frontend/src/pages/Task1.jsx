import { useState } from 'react'
import { Terminal, ChevronDown, Check } from 'lucide-react'
import { PageHeader, Card, Badge } from '../components/ui.jsx'
import CommandPanel from '../components/CommandPanel.jsx'
import { STEPS, TERMINALS, TROUBLE } from '../data/task1.js'

export default function Task1() {
  const [open, setOpen] = useState('clean')
  const [done, setDone] = useState({})
  const count = Object.values(done).filter(Boolean).length

  return (
    <div className="space-y-8">
      <PageHeader kicker="Task 1 · Infrastructure" title="From a blank machine to a working SDN lab">
        The exact sequence we use. Expand a step, copy each command, and open Details for what it does, why, and what you should see.
      </PageHeader>

      <Card className="p-4">
        <p className="text-xs font-medium text-zinc-500">Terminal layout</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {TERMINALS.map(([n, d]) => (
            <li key={n} className="text-sm"><span className="font-medium text-zinc-200">{n}</span><span className="text-zinc-500"> · {d}</span></li>
          ))}
        </ul>
      </Card>

      <section aria-label="Steps" className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-1 flex-1 rounded bg-zinc-800"><div className="h-full rounded bg-emerald-400 transition-all" style={{ width: `${(count / STEPS.length) * 100}%` }} /></div>
          <span className="text-xs text-zinc-500">{count} / {STEPS.length} done</span>
        </div>

        {STEPS.map((s, i) => {
          const isOpen = open === s.id
          return (
            <Card key={s.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => setDone({ ...done, [s.id]: !done[s.id] })} role="checkbox" aria-checked={!!done[s.id]} aria-label={`Mark step ${i + 1} done`}
                  className={`flex h-5 w-5 flex-none items-center justify-center rounded border outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
                    done[s.id] ? 'border-emerald-400 bg-emerald-400 text-zinc-950' : 'border-zinc-700 text-transparent hover:border-zinc-500'}`}>
                  <Check size={12} />
                </button>
                <button onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}
                  className="flex flex-1 items-center justify-between gap-3 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">
                  <span className="text-sm font-medium text-zinc-100"><span className="mr-2 font-mono text-xs text-zinc-500">{String(i + 1).padStart(2, '0')}</span>{s.title}</span>
                  <span className="flex items-center gap-2">
                    <span className="hidden sm:block"><Badge><Terminal size={10} className="mr-1" aria-hidden="true" />{s.terminal}</Badge></span>
                    <ChevronDown size={16} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </span>
                </button>
              </div>
              {isOpen && (
                <div className="space-y-3 border-t border-zinc-800 px-4 py-4">
                  <p className="text-sm text-zinc-400"><span className="text-zinc-500">Run in: </span>{s.terminal}. {s.why}</p>
                  {s.commands.map((c) => <CommandPanel key={c.cmd} {...c} />)}
                </div>
              )}
            </Card>
          )
        })}
      </section>

      <section aria-labelledby="trouble" className="space-y-2">
        <h2 id="trouble" className="text-sm font-medium text-zinc-300">Troubleshooting</h2>
        <Card className="divide-y divide-zinc-800">
          {TROUBLE.map(([q, a]) => (
            <details key={q} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm text-zinc-200 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">
                {q}<ChevronDown size={14} className="text-zinc-500 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{a}</p>
            </details>
          ))}
        </Card>
      </section>
    </div>
  )
}
