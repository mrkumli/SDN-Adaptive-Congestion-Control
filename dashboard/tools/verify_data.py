#!/usr/bin/env python3
"""verify_data.py - read-only cross-check of dashboard results.json against the raw files in ../../results."""
import csv, json, os, re
HERE = os.path.dirname(os.path.abspath(__file__)); R = os.path.normpath(os.path.join(HERE, '..', '..', 'results'))
D = json.load(open(os.path.join(HERE, '..', 'frontend', 'public', 'data', 'results.json')))
K, INT, ok = D['constants'], 0.2, True
def check(name, cond, detail=''):
    global ok; ok = ok and bool(cond); print(('OK       ' if cond else 'MISMATCH ') + name + ('' if cond else f'  {detail}'))
fl = lambda x: float(x) if x != '' else None
same = lambda a, b: (a is None and b is None) or (a is not None and b is not None and abs(a - b) < 1e-9)

rows = list(csv.DictReader(open(os.path.join(R, 'summary_table.csv'))))
check('summary table row count', len(rows) == len(D['table']), f"{len(rows)} csv vs {len(D['table'])} json")
bad = [r['window'] + '/' + r['metric'] for r, j in zip(rows, D['table'])
       if (r['window'], r['metric']) != (j['window'], j['metric']) or not all(same(fl(r[k]), j[k]) for k in ('B_mean', 'B_sd', 'C_mean', 'C_sd'))]
check('summary table values', not bad, str(bad))

for run in D['runs']:
    d, n = os.path.join(R, run['id']), run['id']
    S = json.load(open(os.path.join(d, 'summary.json')))
    rtt = {int(m.group(1)): float(m.group(2)) for l in open(os.path.join(d, 'ping.txt')) if (m := re.search(r'icmp_seq=(\d+).*time=([\d.]+) ms', l))}
    check(f'{n} ping points', len(rtt) == len(run['ping']), f"{len(rtt)} vs {len(run['ping'])}")
    dur = run['duration']; npk = int(round(dur / INT)); b0, b1, e = K['bulk_start'], K['bulk_stop'], K['early_s']
    for w, (s, t) in {'pre': (0, b0), 'during_early': (b0, b0 + e), 'during_steady': (b0 + e, b1), 'post': (b1, dur)}.items():
        if w not in S: print(f'SKIP     {n} {w} (not in summary.json)'); continue
        seqs = [q for q in range(1, npk + 1) if s <= (q - 1) * INT < t]; got = [rtt[q] for q in seqs if q in rtt]
        avg = round(sum(got) / len(got), 3) if got else None; loss = round(100 * (1 - len(got) / len(seqs)), 2) if seqs else None
        check(f'{n} {w} ping avg/loss', S[w]['ping_avg_ms'] == avg and S[w]['ping_loss_pct'] == loss, f"summary.json {S[w]['ping_avg_ms']}/{S[w]['ping_loss_pct']} vs recomputed {avg}/{loss}")

log = list(csv.DictReader(open(os.path.join(R, 'C_controller_log.csv'))))
for run in D['runs']:
    if run['controller']:
        raw = [r['event'] for r in log if r['event'] and -5 <= float(r['t_epoch']) - run['t0'] <= run['duration'] + 10]
        got = [e['type'] for e in run['controller']['events']]
        check(f"{run['id']} controller events", raw == got, f'csv {raw} vs json {got}')
        print('         ', run['id'], [(e['type'], e['t']) for e in run['controller']['events']], run['controller']['timing'])
print('\nALL CHECKS PASSED' if ok else '\nSOME CHECKS FAILED: paste the MISMATCH lines')
