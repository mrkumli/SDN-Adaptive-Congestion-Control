// Deterministic model of app/controller_app.py. Every number it produces is SIMULATED.
export const CAP = 10            // CAP_MBPS in monitor.py
export const LIMIT = 3           // per-host limit in Mbps (onos_ctl.RATE_KBPS / 1000)
export const N_HIGH = 3, N_LOW = 5, PINNED = 0.8, COOLDOWN = 15
export const SAMPLE_S = 2        // one reading is about 2 s (spacing seen in controller_log.csv)
export const REAL = { high: 80, low: 50 }

export const PRESETS = [
  { id: 'flood', label: 'Bulk flood', d: { h1: 10, h2: 1, h3: 10 } },
  { id: 'stop', label: 'Bulk stops', d: { h1: 0, h2: 1, h3: 0 } },
  { id: 'guard', label: 'Guard demo', d: { h1: 9, h2: 0.5, h3: 0 } },
]

export const initial = (demand, high = REAL.high, low = REAL.low) => ({
  t: 0, n: 0, state: 'NORMAL', hi: 0, lo: 0, tState: -Infinity, prevSet: false, off: null,
  rate: null, util: null, phase: 'init', demand, high, low, rows: [], hist: [],
})

// Per-host traffic crossing the bottleneck. Restricted bulk hosts are capped by their meter;
// if the total still exceeds the link, everyone gets a proportional share (simplification).
export function hostLoads(s) {
  const { h1, h2, h3 } = s.demand, m = s.state === 'RESTRICTED'
  const o = { h1: m ? Math.min(h1, LIMIT) : h1, h2, h3: m ? Math.min(h3, LIMIT) : h3 }
  const tot = o.h1 + o.h2 + o.h3, k = tot > CAP ? CAP / tot : 1
  return { h1: o.h1 * k, h2: o.h2 * k, h3: o.h3 * k, over: tot > CAP }
}

function tick(s) {
  const t = s.t + SAMPLE_S
  const L = hostLoads(s), rate = L.h1 + L.h2 + L.h3, util = rate / CAP
  let { state, hi, lo, tState, prevSet, off } = s
  let ev = '', phase
  const cdOk = t - tState >= COOLDOWN
  if (state === 'NORMAL') {
    hi = util > s.high / 100 ? hi + 1 : 0                          // consecutive over-threshold readings
    if (hi >= N_HIGH && cdOk) {                                    // DETECT -> ACT
      state = 'RESTRICTED'; tState = t; hi = 0; lo = 0; prevSet = false; off = null
      ev = 'RESTRICT_APPLIED'; phase = 'restrict'
    } else phase = hi === 0 ? 'monitor' : hi >= N_HIGH ? 'cooldown' : 'detect'
  } else {
    if (!prevSet) prevSet = true                                   // first flow-stats sample is only a baseline
    else off = { h1: s.demand.h1, h3: s.demand.h3 }                // offered load, counted before the meter drops
    const pinned = off === null || Math.max(off.h1, off.h3) > PINNED * LIMIT
    const low = util < s.low / 100
    lo = low && !pinned && cdOk ? lo + 1 : 0
    if (lo >= N_LOW) {                                             // RECOVER
      state = 'NORMAL'; tState = t; hi = 0; lo = 0; prevSet = false; off = null
      ev = 'RESTORE_APPLIED'; phase = 'restore'
    } else phase = off === null ? 'baseline' : !low ? 'util-high' : pinned ? 'pinned' : !cdOk ? 'cooldown-r' : 'recover'
  }
  const row = { t, rate, util: util * 100, state, hi, lo, h1: off ? off.h1 : '', h3: off ? off.h3 : '', ev }
  return {
    ...s, t, n: s.n + 1, state, hi, lo, tState, prevSet, off, rate, util, phase, ev,
    rows: [...s.rows, row].slice(-30), hist: [...s.hist, { u: util * 100, ev }].slice(-40),
  }
}

export function reducer(s, a) {
  switch (a.type) {
    case 'tick': return tick(s)
    case 'reset': return initial(s.demand, s.high, s.low)
    case 'demand': return { ...s, demand: { ...s.demand, [a.host]: a.value } }
    case 'preset': return { ...s, demand: a.d }
    case 'params': return { ...s, [a.key]: a.value }
    default: return s
  }
}

// ---- What / Why / How text, tied to the real code ----
const f1 = (x) => x.toFixed(1)
const MON = ['Monitor.sample()', 'GET /onos/v1/statistics/ports/of:0000000000000001', 'Port statistics of s1 port 4 (the link to s2): the bytesSent counter']
const CM = ['hi = hi + 1 if util > HIGH else 0', 'if hi >= N_HIGH and now - t_state >= COOLDOWN:', '    onos_ctl.restrict()']
const CR = ['pinned = off is None or max(off.values()) > PINNED * LIMIT',
  'lo = lo + 1 if (util < LOW and not pinned and now - t_state >= COOLDOWN) else 0', 'if lo >= N_LOW:', '    onos_ctl.restore()']
const RF = ['for _ in BULK: POST /meters/S1   # DROP band, rate 3000, burstSize 300',
  'POST /flows?appId=org.onosproject.dcnproject   # 4 flows, priority 50000', '    treatment: METER <id>, then OUTPUT port 4']
const RS = ['DELETE /flows/application/org.onosproject.dcnproject', 'time.sleep(0.5)   # flows go first, then their meters',
  'for m in meters: if m["appId"] == "org.onosproject.rest": DELETE /meters/S1/<id>']

export function explain(s) {
  const u = Math.round((s.util ?? 0) * 100), r = f1(s.rate ?? 0)
  const cd = Math.max(0, COOLDOWN - (s.t - s.tState))
  const E = (title, what, why, fn, rest, of, code, hl) => ({ title, what, why, fn, rest, of, code, hl })
  switch (s.phase) {
    case 'monitor':
      return E('Monitor: link healthy', `Measured ${r} Mbps (${u}%), not above ${s.high}%. The counter hi is reset to 0.`,
        'Congestion must persist across several readings, so one calm reading cancels an earlier burst.', ...MON, CM, [0])
    case 'detect':
      return E('Detect: counting', `Utilization ${u}% is above ${s.high}%, so hi = ${s.hi} of ${N_HIGH}.`,
        'Requiring 3 consecutive readings (about 6 s here) avoids restricting traffic because of a momentary spike.', ...MON, CM, [0, 1])
    case 'cooldown':
      return E('Detect: waiting for cooldown', `hi has reached ${N_HIGH}, but the last state change was only ${f1(s.t - s.tState)} s ago. The controller waits ${f1(cd)} s more.`,
        'The cooldown prevents rapid RESTRICT/RESTORE flapping.', ...MON, CM, [1])
    case 'restrict':
      return E('Restrict: meters applied', `Congestion confirmed. One DROP meter is created for each bulk host (h1, h3), then 4 metered flows are installed on s1 (h1 and h3 to h4 and h5). The next reading will show the effect.`,
        'Capping h1 and h3 at 3 Mbps each leaves at least 4 Mbps of the 10 Mbps link for h2, which is never metered.',
        'onos_ctl.restrict()', 'POST /onos/v1/meters/of:0000000000000001 (twice), then POST /onos/v1/flows?appId=org.onosproject.dcnproject',
        'Meter-mod (DROP band, rate 3000, burst 300), then flow-mods: match IPv4 src/dst, instructions METER id + OUTPUT port 4, priority 50000. Real runs took about 0.5 s.', RF, [0, 1, 2])
    case 'baseline':
      return E('Recover: collecting a baseline', 'ONOS flow counters are cumulative byte counts. The first sample after restricting is only a baseline, so the offered load is still unknown.',
        'Offered load is the difference between two samples. Unknown counts as pinned, which is the safe choice.',
        'onos_ctl.flow_bytes()', 'GET /onos/v1/flows/application/org.onosproject.dcnproject',
        'Flow counters count bytes before the meter drops them, so they show what each host wants to send.', CR, [0])
    case 'util-high':
      return E('Recover: link still busy', `Utilization ${u}% is not below ${s.low}%, so lo stays 0.`,
        'Recovery needs the link to be quiet, not merely limited by the meters.', ...MON, CR, [1])
    case 'pinned': {
      const m = Math.max(s.off.h1, s.off.h3)
      return E('Recover: pinned-host guard', `Utilization is low (${u}%), but a bulk host still offers ${f1(m)} Mbps, above ${f1(PINNED * LIMIT)} Mbps (80% of its 3 Mbps limit). The guard keeps the restriction.`,
        'Utilization is low only because of the meters. Restoring now would let that host flood the link again, and the controller would flap.',
        'onos_ctl.flow_bytes()', 'GET /onos/v1/flows/application/org.onosproject.dcnproject', 'Offered load per host comes from pre-meter flow byte counters.', CR, [0, 1])
    }
    case 'cooldown-r':
      return E('Recover: waiting for cooldown', `Utilization is low and no host is pinned, but the cooldown has ${f1(cd)} s left.`,
        'Recovery cannot start until the controller has been in this state for 15 s.', ...MON, CR, [1])
    case 'recover':
      return E('Recover: counting', `Utilization ${u}% is below ${s.low}% and no host is pinned, so lo = ${s.lo} of ${N_LOW}.`,
        'Five consecutive quiet readings (about 10 s here) confirm that congestion is really over.', ...MON, CR, [1, 2])
    case 'restore':
      return E('Recover: normal forwarding restored', 'lo reached 5. The controller deletes its metered flows first, then its meters. The next reading shows the unrestricted load.',
        'Flows are removed before meters so no flow references a missing meter.',
        'onos_ctl.restore()', 'DELETE /onos/v1/flows/application/org.onosproject.dcnproject, then DELETE /onos/v1/meters/of:0000000000000001/{id}',
        'Flow-mod deletes remove our priority-50000 flows; meter-mod deletes remove the meters. Default forwarding applies again.', RS, [0, 1, 2])
    default:
      return E('Ready', 'Nothing has run yet. The simulated controller starts in NORMAL with no restrictions. Press Start or Step.',
        'The real app calls onos_ctl.restore() at startup so it always begins from a clean state.',
        'main() calls onos_ctl.restore()', 'DELETE /onos/v1/flows/application/org.onosproject.dcnproject', 'Our metered flows and meters are removed.', CM, [])
  }
}
