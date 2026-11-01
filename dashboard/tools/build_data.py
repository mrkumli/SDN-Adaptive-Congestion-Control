#!/usr/bin/env python3
"""build_data.py - converts recorded experiment files into one JSON for the dashboard.
READ-ONLY on ~/dcn-project/results. Writes dashboard/frontend/public/data/results.json
Run: python3 ~/dcn-project/dashboard/tools/build_data.py   (re-run after any new experiment or analyze.py run)"""
import csv, glob, json, os, re, time

HERE = os.path.dirname(os.path.abspath(__file__))
R = os.path.normpath(os.path.join(HERE, '..', '..', 'results'))
OUT = os.path.normpath(os.path.join(HERE, '..', 'frontend', 'public', 'data'))
BS, BE, EARLY, INT, DUR_ANALYZE = 10, 40, 12, 0.2, 60   # same constants as topology/experiment.py and app/analyze.py

def jload(path):
    try:
        with open(path) as f: return json.load(f)
    except Exception: return None

def num(x):
    try: return float(x)
    except (TypeError, ValueError): return None

def ping(d):
    rtt, total = {}, None
    try:
        for l in open(os.path.join(d, 'ping.txt')):
            m = re.search(r'icmp_seq=(\d+).*time=([\d.]+) ms', l)
            if m: rtt[int(m.group(1))] = float(m.group(2))
            m = re.search(r'(\d+) packets transmitted', l)
            if m: total = int(m.group(1))
    except OSError: pass
    n = total or (max(rtt) if rtt else 0)
    series = [{'t': round((q - 1) * INT, 2), 'v': rtt[q]} for q in sorted(rtt)]
    buckets = {}                                   # per-second ping loss
    for q in range(1, n + 1):
        b = int(round((q - 1) * INT, 6)); tot, got = buckets.get(b, (0, 0)); buckets[b] = (tot + 1, got + (q in rtt))
    loss = [{'t': b, 'v': round(100 * (1 - g / t), 1)} for b, (t, g) in sorted(buckets.items())]
    return series, loss, n

def intervals(path, offset=0):                    # per-second iperf3 server intervals
    out = []
    for i in (jload(path) or {}).get('intervals', []):
        s = i.get('sum', {}); pk = s.get('packets')
        out.append({'t': round(offset + s.get('start', 0), 2), 'mbps': round(s.get('bits_per_second', 0) / 1e6, 3),
                    'jitter': s.get('jitter_ms'), 'loss': round(100 * s.get('lost_packets', 0) / pk, 2) if pk else None})
    return out

def controller(log, t0, dur):
    rows = []
    for r in log:
        t = float(r['t_epoch']) - t0
        if -5 <= t <= dur + 10:
            rows.append({'t': round(t, 2), 'rate': num(r['rate_mbps']), 'util': num(r['util_pct']), 'state': r['state'],
                         'hi': int(r['hi'] or 0), 'lo': int(r['lo'] or 0), 'off_h1': num(r['off_h1_mbps']),
                         'off_h3': num(r['off_h3_mbps']), 'event': r['event'] or None, 'action_ms': num(r['action_ms'])})
    if not rows: return None
    ev = [{'type': r['event'], 't': round(r['t'] + (r['action_ms'] or 0) / 1000, 2), 'action_ms': r['action_ms']} for r in rows if r['event']]
    rs = [r for r in rows if r['event'] == 'RESTRICT_APPLIED' and BS <= r['t'] <= BE]       # same selection as analyze.py
    ro = [r for r in rows if r['event'] == 'RESTORE_APPLIED' and BE <= r['t'] <= DUR_ANALYZE + 10]
    timing = None
    if rs and ro:
        a, b = rs[0], ro[0]
        timing = {'detect_s': round(a['t'] + (a['action_ms'] or 0) / 1000 - BS, 1), 'restrict_ms': a['action_ms'],
                  'recover_s': round(b['t'] + (b['action_ms'] or 0) / 1000 - BE, 1), 'restore_ms': b['action_ms']}
    return {'rows': rows, 'events': ev, 'timing': timing}

def main():
    table = []
    try:
        for r in csv.DictReader(open(os.path.join(R, 'summary_table.csv'))):
            table.append({'window': r['window'], 'metric': r['metric'], 'B_mean': num(r['B_mean']), 'B_sd': num(r['B_sd']),
                          'C_mean': num(r['C_mean']), 'C_sd': num(r['C_sd'])})
    except OSError: print('! summary_table.csv not found')
    try: log = list(csv.DictReader(open(os.path.join(R, 'C_controller_log.csv'))))
    except OSError: log = []; print('! C_controller_log.csv not found')
    runs = []
    for p in ('B', 'C'):
        for d in sorted(glob.glob(os.path.join(R, p + '_run[0-9]'))):
            name, meta = os.path.basename(d), jload(os.path.join(d, 'meta.json')) or {}
            pg, pl, n = ping(d); dur = int(round(n * INT))
            if not dur: print(f'! {name}: no ping data, skipped'); continue
            ctrl = controller(log, meta['t0'], dur) if p == 'C' and log and meta.get('t0') else None
            runs.append({'id': name, 'scenario': p, 't0': meta.get('t0'), 'duration': dur, 'summary': jload(os.path.join(d, 'summary.json')),
                         'ping': pg, 'pingLoss': pl, 'h2': intervals(os.path.join(d, 'srv_h2.json')),
                         'h1': intervals(os.path.join(d, 'srv_h1.json'), BS), 'h3': intervals(os.path.join(d, 'srv_h3.json'), BS),
                         'controller': ctrl})
            print(f'{name}: {dur}s, {len(pg)} pings, controller rows: {len(ctrl["rows"]) if ctrl else "none"}'
                  + (f', timing {ctrl["timing"]}' if ctrl and ctrl['timing'] else ''))
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'results.json'), 'w') as f:
        json.dump({'generated': time.strftime('%Y-%m-%d %H:%M:%S'),
                   'constants': {'bulk_start': BS, 'bulk_stop': BE, 'early_s': EARLY, 'ping_interval_s': INT},
                   'table': table, 'runs': runs}, f, separators=(',', ':'))
    print(f'wrote {os.path.join(OUT, "results.json")}  ({len(runs)} runs, {len(table)} table rows)')

main()
