#!/usr/bin/env python3
"""analyze.py - aggregate B (no control) vs C (ONOS control): table, detection/recovery times, figures.
Run: python3 analyze.py"""
import csv, glob, json, os, re, statistics as st
import matplotlib; matplotlib.use('Agg')              # save PNGs, no display needed
import matplotlib.pyplot as plt

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'results')
BS, BE, DUR, INT = 10, 40, 60, 0.2                    # bulk start/stop, run length, ping interval (as in experiment.py)
runs = lambda p: sorted(glob.glob(os.path.join(R, p + '_run[0-9]')))
WINS = ['pre', 'during_early', 'during_steady', 'post']
METRICS = [('ping_avg_ms', 'Ping avg (ms)'), ('ping_loss_pct', 'Ping loss (%)'), ('udp_mbps', 'UDP throughput (Mbps)'),
           ('udp_loss_pct', 'UDP loss (%)'), ('udp_jitter_ms', 'UDP jitter (ms)'),
           ('h1_mbps', 'Bulk h1 (Mbps)'), ('h3_mbps', 'Bulk h3 (Mbps)')]
S = {s: [json.load(open(os.path.join(d, 'summary.json'))) for d in runs(s)] for s in ('B', 'C')}

def agg(s, w, k):                                      # mean and sd over runs for one window/metric
    v = [r[w][k] for r in S[s] if r.get(w, {}).get(k) is not None]
    return (st.mean(v), st.stdev(v) if len(v) > 1 else 0.0) if v else (None, None)

# ---- 1) table ----
rows = [['window', 'metric', 'B_mean', 'B_sd', 'C_mean', 'C_sd']]
for w in WINS:
    for k, lab in METRICS:
        b, c = agg('B', w, k), agg('C', w, k)
        if b[0] is None and c[0] is None: continue
        rows.append([w, lab] + [round(x, 3) if x is not None else '' for x in (*b, *c)])
csv.writer(open(os.path.join(R, 'summary_table.csv'), 'w', newline='')).writerows(rows)
for r in rows: print(f'{r[0]:14} {r[1]:24} B={r[2]!s:>9} ±{r[3]!s:<7} C={r[4]!s:>9} ±{r[5]}')
print(f'runs: B={len(S["B"])} C={len(S["C"])}')

# ---- 2) controller timing, aligned to each run's start time t0 ----
log = list(csv.DictReader(open(os.path.join(R, 'C_controller_log.csv'))))
ev = [(float(r['t_epoch']), r['event'], float(r['action_ms'] or 0) / 1000) for r in log if r['event']]
print('\nC runs: detection = bulk start -> restrict applied; recovery = bulk stop -> restore applied')
for d in runs('C'):
    t0 = json.load(open(os.path.join(d, 'meta.json')))['t0']
    rs = [(t, a) for t, e, a in ev if e == 'RESTRICT_APPLIED' and t0 + BS <= t <= t0 + BE]
    ro = [(t, a) for t, e, a in ev if e == 'RESTORE_APPLIED' and t0 + BE <= t <= t0 + DUR + 10]
    if rs and ro:
        print(f'{os.path.basename(d)}: detect {rs[0][0] + rs[0][1] - (t0 + BS):.1f} s, restrict action {rs[0][1]*1000:.0f} ms, '
              f'recover {ro[0][0] + ro[0][1] - (t0 + BE):.1f} s, restore action {ro[0][1]*1000:.0f} ms')

# ---- 3) figures ----
def rtts(d):                                           # seq -> RTT (ms) from ping.txt
    o = {}
    for l in open(os.path.join(d, 'ping.txt')):
        m = re.search(r'icmp_seq=(\d+).*time=([\d.]+) ms', l)
        if m: o[int(m.group(1))] = float(m.group(2))
    return o

fig, ax = plt.subplots(1, 3, figsize=(11, 3.5))        # Fig 1: protected-traffic metrics, steady window
for a, (k, lab, lg) in zip(ax, [('ping_avg_ms', 'Ping avg (ms, log)', True), ('udp_loss_pct', 'UDP loss (%)', False),
                                ('udp_jitter_ms', 'UDP jitter (ms)', False)]):
    m = [agg(s, 'during_steady', k) for s in ('B', 'C')]
    a.bar(['B: no control', 'C: ONOS control'], [x[0] for x in m], yerr=[x[1] for x in m], color=['#c44', '#2a7'], capsize=4)
    a.set_title(lab); a.set_yscale('log' if lg else 'linear')
fig.suptitle('Protected h2 traffic, steady congestion window (mean ± sd)'); fig.tight_layout()
fig.savefig(os.path.join(R, 'fig1_protected_metrics.png'), dpi=150)

t0c = json.load(open(os.path.join(runs('C')[0], 'meta.json')))['t0']
plt.figure(figsize=(9, 3.5))                           # Fig 2: RTT timeline, first B run vs first C run
for s, col in (('B', '#c44'), ('C', '#2a7')):
    r = rtts(runs(s)[0]); q = sorted(r)
    plt.plot([(i - 1) * INT for i in q], [r[i] for i in q], color=col, lw=.8, label=f'{s}_run1')
for t, e, a in ev:
    if t0c <= t <= t0c + DUR + 10: plt.axvline(t + a - t0c, color='k', ls='--', lw=.8)
plt.axvspan(BS, BE, color='orange', alpha=.1, label='bulk traffic on')
plt.yscale('log'); plt.xlabel('time (s)'); plt.ylabel('h2→h4 RTT (ms)'); plt.legend()
plt.title('Protected-flow latency (dashed: restrict/restore applied)'); plt.tight_layout()
plt.savefig(os.path.join(R, 'fig2_rtt_timeline.png'), dpi=150)

plt.figure(figsize=(9, 3.5))                           # Fig 3: link utilization and controller state, first C run
pts = [(float(r['t_epoch']) - t0c, float(r['util_pct'])) for r in log if t0c - 5 <= float(r['t_epoch']) <= t0c + DUR + 5]
plt.plot([p[0] for p in pts], [p[1] for p in pts], 'o-', ms=3, label='s1→s2 utilization')
plt.axhline(80, color='r', ls=':', label='congestion threshold 80%'); plt.axhline(50, color='g', ls=':', label='recovery threshold 50%')
a_ = [t + a - t0c for t, e, a in ev if e == 'RESTRICT_APPLIED' and t0c <= t <= t0c + DUR]
b_ = [t + a - t0c for t, e, a in ev if e == 'RESTORE_APPLIED' and t0c <= t <= t0c + DUR + 10]
if a_ and b_: plt.axvspan(a_[0], b_[0], color='orange', alpha=.2, label='RESTRICTED')
plt.xlabel('time (s)'); plt.ylabel('utilization (%)'); plt.legend(fontsize=7); plt.title('Bottleneck utilization and controller state')
plt.tight_layout(); plt.savefig(os.path.join(R, 'fig3_utilization.png'), dpi=150)
print('\nsaved: summary_table.csv, fig1_protected_metrics.png, fig2_rtt_timeline.png, fig3_utilization.png')