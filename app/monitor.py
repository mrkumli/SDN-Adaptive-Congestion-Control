#!/usr/bin/env python3
"""monitor.py - bottleneck utilization from ONOS port statistics (REST). Run: python3 monitor.py [--raw]"""
import sys, time, requests
ONOS = 'http://127.0.0.1:8181/onos/v1'; AUTH = ('onos', 'rocks')
DEV, PORT = 'of:0000000000000001', 4      # s1 port 4 = s1-eth4 -> s2 (from Mininet `net`)
CAP_MBPS = 10.0                            # bottleneck capacity

def port_stats(raw=False):
    r = requests.get(f'{ONOS}/statistics/ports/{DEV}', auth=AUTH, timeout=2); r.raise_for_status()
    j = r.json()
    if raw: print(j)
    ports = j['statistics'][0]['ports'] if 'statistics' in j else j['ports']
    p = next(x for x in ports if x['port'] == PORT)
    return p['bytesSent'], p['durationSec'] + p.get('durationNano', 0) / 1e9   # TX bytes, switch-side time (s)

class Monitor:
    def __init__(self): self.prev = None
    def sample(self, raw=False):
        """Return TX rate in Mbps if ONOS has a NEW sample, else None (first/stale/counter reset)."""
        b, t = port_stats(raw)
        prev, self.prev = self.prev, (b, t)
        if prev is None or t <= prev[1] or b < prev[0]: return None
        return (b - prev[0]) * 8 / (t - prev[1]) / 1e6

if __name__ == '__main__':
    m, first = Monitor(), '--raw' in sys.argv
    while True:
        r = m.sample(first); first = False
        if r is not None: print(f'{time.strftime("%H:%M:%S")}  {r:6.2f} Mbps  {100*r/CAP_MBPS:5.1f}%', flush=True)
        time.sleep(0.5)                    # poll faster than ONOS updates; stale samples are skipped