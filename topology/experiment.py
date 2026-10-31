#!/usr/bin/env python3
"""Repeatable experiment on the Task 1 topology.
Usage: sudo python3 experiment.py NAME [--duration 50] [--bulk-start 10] [--bulk-stop 40] [--no-bulk]"""
import argparse, json, os, re, subprocess, time
from mininet.net import Mininet
from mininet.node import RemoteController, OVSSwitch
from mininet.link import TCLink
from mininet.log import setLogLevel
from network import CongestionTopo, CONTROLLER_PORT   # reuse Task 1 topology unchanged

ap = argparse.ArgumentParser()
ap.add_argument('name'); ap.add_argument('--duration', type=int, default=50)
ap.add_argument('--bulk-start', type=int, default=10); ap.add_argument('--bulk-stop', type=int, default=40)
ap.add_argument('--no-bulk', action='store_true')
a = ap.parse_args()
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'results', a.name)
os.makedirs(OUT, exist_ok=True)
INT = 0.2                                   # ping interval (s)
NP = int(a.duration / INT)                  # number of pings
bulk = not a.no_bulk
DN = subprocess.DEVNULL

setLogLevel('warning')
net = Mininet(topo=CongestionTopo(), controller=None, switch=OVSSwitch, link=TCLink, autoSetMacs=False)
net.addController('c0', controller=RemoteController, ip='127.0.0.1', port=CONTROLLER_PORT)
files = []
def fh(n):                                  # open an output file in the results dir
    f = open(os.path.join(OUT, n), 'w'); files.append(f); return f
try:
    net.start(); net.waitConnected(); time.sleep(3)
    net.pingAll()                           # warm-up so ONOS learns hosts (not measured)
    h1, h2, h3, h4, h5 = [net.get(n) for n in ('h1', 'h2', 'h3', 'h4', 'h5')]
    # one-shot iperf3 servers (-1) write JSON when their test ends
    srv = [h4.popen(['iperf3', '-s', '-p', '5202', '-1', '-J'], stdout=fh('srv_h2.json'))]
    if bulk:
        srv += [h4.popen(['iperf3', '-s', '-p', '5201', '-1', '-J'], stdout=fh('srv_h1.json')),
                h5.popen(['iperf3', '-s', '-p', '5201', '-1', '-J'], stdout=fh('srv_h3.json'))]
    time.sleep(1)
    T0 = time.time()                            # run start, used to align controller logs
    # protected traffic: ping (latency/loss) + 1 Mbps UDP (throughput/loss/jitter), h2 -> h4
    cl = [h2.popen(['ping', '-i', str(INT), '-c', str(NP), '10.0.0.4'], stdout=fh('ping.txt')),
          h2.popen(['iperf3', '-c', '10.0.0.4', '-p', '5202', '-u', '-b', '1M', '-t', str(a.duration)], stdout=DN)]
    if bulk:                                # bulk TCP from h1 and h3 over the bottleneck
        time.sleep(a.bulk_start); t = str(a.bulk_stop - a.bulk_start)
        cl += [h1.popen(['iperf3', '-c', '10.0.0.4', '-p', '5201', '-t', t], stdout=DN),
               h3.popen(['iperf3', '-c', '10.0.0.5', '-p', '5201', '-t', t], stdout=DN)]
    for p in cl: p.wait()
    time.sleep(2)
    for p in srv: p.wait()
    json.dump({'t0': T0}, open(os.path.join(OUT, 'meta.json'), 'w'))
finally:
    net.stop()
    for f in files: f.close()

# ---- summary per time window ----
# wins = ([('pre', 0, a.bulk_start), ('during', a.bulk_start, a.bulk_stop), ('post', a.bulk_stop, a.duration)]
#         if bulk else [('all', 0, a.duration)])
EARLY = 12     # s after bulk start covering detection + action in C (same windows for B)
wins = ([('pre', 0, a.bulk_start), ('during_early', a.bulk_start, a.bulk_start + EARLY),
         ('during_steady', a.bulk_start + EARLY, a.bulk_stop), ('post', a.bulk_stop, a.duration)]
        if bulk else [('all', 0, a.duration)])
avg = lambda v: round(sum(v) / len(v), 3) if v else None
rtt = {}                                    # seq -> RTT ms (time of ping n is ~ (n-1)*INT)
for l in open(os.path.join(OUT, 'ping.txt')):
    m = re.search(r'icmp_seq=(\d+).*time=([\d.]+) ms', l)
    if m: rtt[int(m.group(1))] = float(m.group(2))
def ivs(fn):                                # per-second interval sums from a server JSON
    try: return [i['sum'] for i in json.load(open(os.path.join(OUT, fn)))['intervals']]
    except Exception: return []
u, b1, b3 = ivs('srv_h2.json'), ivs('srv_h1.json'), ivs('srv_h3.json')
res = {}
for n, s, e in wins:
    seqs = [q for q in range(1, NP + 1) if s <= (q - 1) * INT < e]
    got = [rtt[q] for q in seqs if q in rtt]
    uw = [x for x in u if s <= x['start'] < e]
    bw = lambda L: [x['bits_per_second'] / 1e6 for x in L if s <= x['start'] - 0 < e - 0]
    lost, pk = sum(x['lost_packets'] for x in uw), sum(x['packets'] for x in uw)
    res[n] = dict(ping_avg_ms=avg(got), ping_max_ms=max(got) if got else None,
                  ping_loss_pct=round(100 * (1 - len(got) / len(seqs)), 2) if seqs else None,
                  udp_mbps=avg([x['bits_per_second'] / 1e6 for x in uw]),
                  udp_loss_pct=round(100 * lost / pk, 2) if pk else None,
                  udp_jitter_ms=avg([x['jitter_ms'] for x in uw]))
    # if bulk and n == 'during':              # bulk server intervals are relative to bulk start
    #     res[n]['h1_mbps'] = avg([x['bits_per_second'] / 1e6 for x in b1])
    #     res[n]['h3_mbps'] = avg([x['bits_per_second'] / 1e6 for x in b3])
    if bulk and n.startswith('during'):     # bulk server intervals are relative to bulk start
        for k, L in (('h1_mbps', b1), ('h3_mbps', b3)):
            res[n][k] = avg([x['bits_per_second'] / 1e6 for x in L if s - a.bulk_start <= x['start'] < e - a.bulk_start])
json.dump(res, open(os.path.join(OUT, 'summary.json'), 'w'), indent=2)
for k, v in res.items(): print(k, v)