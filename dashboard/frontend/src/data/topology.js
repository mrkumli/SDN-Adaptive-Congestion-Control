// Facts come from topology/network.py, app/monitor.py and app/onos_ctl.py.
export const NODES = {
  h1: { kind: 'host', cls: 'bulk', x: 70, y: 60, sub: 'bulk A', title: 'h1 · Bulk sender A', badge: 'Host',
    rows: [['IP', '10.0.0.1'], ['MAC', '00:00:00:00:00:01'], ['Attached to', 's1 · 100 Mbps']],
    what: 'Generates bulk traffic (iperf3). One of the two hosts the controller restricts.' },
  h2: { kind: 'host', cls: 'latency', x: 70, y: 180, sub: 'latency-sensitive', title: 'h2 · Latency-sensitive', badge: 'Host',
    rows: [['IP', '10.0.0.2'], ['MAC', '00:00:00:00:00:02'], ['Attached to', 's1 · 100 Mbps']],
    what: 'Sends latency-sensitive traffic (ping and a light 1 Mbps UDP stream). It is never restricted; the controller exists to protect it.' },
  h3: { kind: 'host', cls: 'bulk', x: 70, y: 300, sub: 'bulk B', title: 'h3 · Bulk sender B', badge: 'Host',
    rows: [['IP', '10.0.0.3'], ['MAC', '00:00:00:00:00:03'], ['Attached to', 's1 · 100 Mbps']],
    what: 'Generates bulk traffic (iperf3). The second host the controller restricts.' },
  h4: { kind: 'host', cls: 'server', x: 850, y: 80, sub: 'server', title: 'h4 · Receiving server', badge: 'Host',
    rows: [['IP', '10.0.0.4'], ['MAC', '00:00:00:00:00:04'], ['Attached to', 's3 · 100 Mbps']],
    what: 'Receives traffic after it has crossed the bottleneck.' },
  h5: { kind: 'host', cls: 'server', x: 850, y: 280, sub: 'server', title: 'h5 · Receiving server', badge: 'Host',
    rows: [['IP', '10.0.0.5'], ['MAC', '00:00:00:00:00:05'], ['Attached to', 's3 · 100 Mbps']],
    what: 'Receives traffic after it has crossed the bottleneck.' },
  s1: { kind: 'switch', cls: 'sw1', x: 290, y: 180, title: 's1 · Sender-side switch', badge: 'OpenFlow switch',
    rows: [['ONOS ID', 'of:0000000000000001'], ['Ports', '1–3 → h1–h3 · 4 → s2 (s1-eth4)'], ['Protocol', 'OpenFlow 1.3']],
    what: "All sender traffic enters here. This is where utilization is measured (port 4, TX bytes) and where the controller's meters are installed." },
  s2: { kind: 'switch', cls: 'sw', x: 540, y: 180, title: 's2 · Transit switch', badge: 'OpenFlow switch',
    rows: [['Links', 's1 (10 Mbps) · s3 (100 Mbps)'], ['Protocol', 'OpenFlow 1.3']],
    what: 'Forwards traffic between the bottleneck and s3.' },
  s3: { kind: 'switch', cls: 'sw', x: 720, y: 180, title: 's3 · Receiver-side switch', badge: 'OpenFlow switch',
    rows: [['Links', 's2 · h4 · h5 (100 Mbps)'], ['Protocol', 'OpenFlow 1.3']],
    what: 'Delivers traffic to the receiving servers h4 and h5.' },
}

export const LINKS = [
  { id: 'h1-s1', a: 'h1', b: 's1', kind: 'access' },
  { id: 'h2-s1', a: 'h2', b: 's1', kind: 'access' },
  { id: 'h3-s1', a: 'h3', b: 's1', kind: 'access' },
  { id: 's1-s2', a: 's1', b: 's2', kind: 'bottleneck' },
  { id: 's2-s3', a: 's2', b: 's3', kind: 'transit' },
  { id: 's3-h4', a: 's3', b: 'h4', kind: 'access' },
  { id: 's3-h5', a: 's3', b: 'h5', kind: 'access' },
]

const LINK_INFO = {
  access: { badge: 'Link', rows: [['Capacity', '100 Mbps'], ['Created by', 'TCLink in network.py']],
    what: 'A host access link. At 100 Mbps it is never the limiting factor.' },
  transit: { badge: 'Link', rows: [['Capacity', '100 Mbps'], ['Created by', 'TCLink in network.py']],
    what: 'Fast transit link. It carries whatever the bottleneck lets through.' },
  bottleneck: { badge: 'Bottleneck', rows: [['Capacity', '10 Mbps'], ['Delay', '5 ms'], ['Created by', 'TCLink (Linux tc) in network.py'],
    ['Measured at', 's1 port 4, TX bytes (monitor.py)'], ['Controlled at', 's1 meters, output port 4 (onos_ctl.py)']],
    what: 'Every sender-to-receiver packet must cross this single link, so congestion forms here. Its utilization is what the controller watches.' },
}

const NODE_NOTES = {
  bulk: { normal: 'Idle in this state.', congested: 'Sending bulk traffic at full speed. This is what saturates the bottleneck.',
    controlled: 'Still sending, but capped at 3 Mbps by its meter on s1.' },
  latency: { normal: 'Light traffic, so latency stays near the baseline.',
    congested: "Its packets queue behind bulk traffic. This is the damage the controller must prevent.",
    controlled: 'Not metered, so its traffic flows normally while bulk traffic is capped.' },
  server: { normal: "Receives h2's traffic.", congested: 'Receives whatever survives the bottleneck.', controlled: 'Receives traffic at the controlled rates.' },
  sw1: { normal: "Forwards h2's traffic out port 4.", congested: 'All three senders converge here; port 4 (s1-eth4) is the measurement point.',
    controlled: 'ONOS has installed one meter per bulk host plus metered flows (priority 50000). h1 and h3 are rate-limited before the bottleneck.' },
  sw: { normal: 'Forwards traffic toward its destination.', congested: 'Forwards what the bottleneck delivers.', controlled: 'Forwards the reduced, controlled load.' },
}
const LINK_NOTES = {
  access: { normal: 'Lightly used.', congested: 'Hosts can send up to 100 Mbps here, which is why the 10 Mbps link behind it overloads.',
    controlled: 'Hosts still send, but s1 meters h1 and h3 before the bottleneck.' },
  transit: { normal: 'Lightly used.', congested: 'Carries at most what the bottleneck delivers, so it stays uncongested.', controlled: 'Even lighter load now.' },
  bottleneck: {
    normal: "Only h2's light traffic crosses, so there is plenty of headroom and latency stays near baseline.",
    congested: 'h1 and h3 push far more than 10 Mbps into a 10 Mbps link. The queue fills, latency jumps and packets are dropped.',
    controlled: 'After 3 consecutive readings above 80%, the controller meters h1 and h3 to 3 Mbps each. The queue drains. Utilization stays above the 50% recovery threshold while bulk traffic continues, so the restriction stays in place.',
  },
}

export function getInfo(sel, scen) {
  if (sel.type === 'node') {
    const n = NODES[sel.id]
    return { title: n.title, badge: n.badge, rows: n.rows, what: n.what, note: NODE_NOTES[n.cls][scen] }
  }
  const l = LINKS.find((x) => x.id === sel.id), i = LINK_INFO[l.kind]
  return { title: `${l.a} – ${l.b}`, badge: i.badge, rows: i.rows, what: i.what, note: LINK_NOTES[l.kind][scen] }
}

// flows: [source, destination, packet count, seconds per trip (bigger = slower), kind]
export const SCENARIOS = {
  normal: { label: 'Normal', tone: 'bg-zinc-400', load: 10, loadText: 'low',
    blurb: 'Only h2 sends light traffic. The bottleneck has plenty of headroom.',
    flows: [['h2', 'h4', 2, 4, 'ok']] },
  congested: { label: 'Congested', tone: 'bg-red-400', load: 100, loadText: 'demand far above 10 Mbps',
    blurb: 'h1 and h3 flood the bottleneck with no control. h2 packets (slower dots) are stuck in the same queue.',
    flows: [['h1', 'h4', 7, 3, 'bulk'], ['h3', 'h5', 7, 3, 'bulk'], ['h2', 'h4', 2, 8, 'ok']] },
  controlled: { label: 'Controlled', tone: 'bg-emerald-400', load: 70, loadText: '≤ 3 + 3 + 1 Mbps',
    blurb: 'ONOS meters cap h1 and h3 at 3 Mbps each. h2 is untouched and flows at normal speed.',
    flows: [['h1', 'h4', 3, 4, 'bulk'], ['h3', 'h5', 3, 4, 'bulk'], ['h2', 'h4', 2, 4, 'ok']] },
}
