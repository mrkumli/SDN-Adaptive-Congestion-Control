import { useState } from 'react'
import { Boxes, Cable, Server, Cpu } from 'lucide-react'
import { PageHeader, Card, Badge } from '../components/ui.jsx'

const STACK = [
  { id: 'mininet', name: 'Mininet', sub: 'Network emulator', Icon: Boxes,
    text: 'Builds the virtual network on one machine: three Open vSwitch switches (s1–s3) and five hosts (h1–h5). Hosts run real traffic tools such as iperf3 and ping.' },
  { id: 'openflow', name: 'OpenFlow 1.3', sub: 'Switch ↔ controller protocol', Icon: Cable,
    text: 'The language switches use to talk to the controller. It carries flow rules, meters (rate limiters) and port statistics.' },
  { id: 'onos', name: 'ONOS 2.7.0', sub: 'SDN controller', Icon: Server,
    text: 'Discovers the topology, installs rules and meters on the switches, and exposes a REST API at http://127.0.0.1:8181/onos/v1.' },
  { id: 'py', name: 'Python controller', sub: 'Our application', Icon: Cpu,
    text: 'Our congestion-control loop. It reads link utilization through ONOS, decides when congestion starts and ends, and asks ONOS to apply or remove the 3 Mbps meters.' },
]

const LOOP = [
  ['Monitor', 'Read bottleneck utilization from ONOS about every 2 s.'],
  ['Detect', 'Above 80% for 3 consecutive readings means congestion.'],
  ['Restrict', 'Meters cap h1 and h3 at 3 Mbps each; h2 is untouched.'],
  ['Recover', 'Below 50% for 5 readings, after cooldown and guard checks.'],
  ['Evaluate', 'Repeatable experiments compare latency, loss and throughput.'],
]

const SPECS = [
  ['Switches / hosts', '3 (s1–s3) / 5 (h1–h5)'],
  ['Bottleneck', '10 Mbps, between s1 and s2'],
  ['Other links', '100 Mbps'],
  ['Traffic roles', 'h1, h3 bulk · h2 latency-sensitive · h4, h5 receivers'],
  ['Congestion trigger', '> 80% utilization, 3 consecutive readings'],
  ['Restriction', 'h1 and h3 limited to 3 Mbps each (OpenFlow meters)'],
  ['Recovery', '< 50% utilization, 5 readings, with cooldown and guard'],
  ['Environment', 'Ubuntu 24.04 · ONOS 2.7.0 · Open vSwitch 3.3.9 · Python 3'],
]

export default function Overview() {
  const [sel, setSel] = useState('mininet')
  const active = STACK.find((s) => s.id === sel)
  return (
    <div className="space-y-10">
      <PageHeader kicker="Overview" title="How the system fits together">
        An SDN network that watches its own bottleneck, restricts bulk traffic when it congests, and restores it when the congestion clears.
      </PageHeader>

      <section aria-labelledby="arch" className="space-y-4">
        <h2 id="arch" className="text-sm font-medium text-zinc-300">Architecture <span className="font-normal text-zinc-500">· select a layer</span></h2>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {STACK.map(({ id, name, sub, Icon }, i) => (
            <div key={id} className="contents">
              <button
                onClick={() => setSel(id)}
                aria-pressed={sel === id}
                className={`flex-1 rounded-lg border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
                  sel === id ? 'border-emerald-400/50 bg-emerald-400/5' : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                }`}
              >
                <Icon size={18} aria-hidden="true" className={sel === id ? 'text-emerald-300' : 'text-zinc-500'} />
                <p className="mt-2 text-sm font-medium text-zinc-100">{name}</p>
                <p className="text-xs text-zinc-500">{sub}</p>
              </button>
              {i < STACK.length - 1 && (
                <>
                  <span aria-hidden="true" className="flow-line hidden w-8 flex-none sm:block" />
                  <span aria-hidden="true" className="mx-auto h-4 w-px bg-zinc-700 sm:hidden" />
                </>
              )}
            </div>
          ))}
        </div>
        <Card className="p-4 text-sm leading-relaxed text-zinc-300" >
          <p aria-live="polite"><span className="font-medium text-zinc-50">{active.name}. </span>{active.text}</p>
        </Card>
      </section>

      <section aria-labelledby="loop" className="space-y-4">
        <h2 id="loop" className="text-sm font-medium text-zinc-300">Control loop</h2>
        <Card>
          <ol className="grid divide-y divide-zinc-800 sm:grid-cols-5 sm:divide-x sm:divide-y-0">
            {LOOP.map(([name, text], i) => (
              <li key={name} className="p-4">
                <p className="font-mono text-[11px] text-emerald-400/80">0{i + 1}</p>
                <p className="mt-1 text-sm font-medium text-zinc-100">{name}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{text}</p>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section aria-labelledby="specs" className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 id="specs" className="text-sm font-medium text-zinc-300">Key specifications</h2>
          <Badge>from project brief</Badge>
        </div>
        <Card>
          <dl className="divide-y divide-zinc-800">
            {SPECS.map(([k, v]) => (
              <div key={k} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[11rem_1fr]">
                <dt className="text-zinc-500">{k}</dt>
                <dd className="text-zinc-200">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </section>
    </div>
  )
}
