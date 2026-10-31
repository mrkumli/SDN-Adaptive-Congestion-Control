#!/usr/bin/env python3
"""onos_ctl.py - controller actions via ONOS REST. CLI test: python3 onos_ctl.py on | off | status"""
import sys, time, requests
ONOS = 'http://127.0.0.1:8181/onos/v1'; AUTH = ('onos', 'rocks')
S1, OUT_PORT = 'of:0000000000000001', 4        # s1, port 4 -> s2 (bottleneck)
BULK = ['10.0.0.1', '10.0.0.3']                 # h1, h3 (bulk senders)
DSTS = ['10.0.0.4', '10.0.0.5']                 # receivers behind the bottleneck
RATE_KBPS = 3000                                # per-host limit = 3 Mbps
APP, PRIO = 'org.onosproject.dcnproject', 50000

def restrict(rate_kbps=RATE_KBPS):
    """Create one DROP meter per bulk host, then install metered flows on s1."""
    ids = []
    for _ in BULK:
        body = {"deviceId": S1, "unit": "KB_PER_SEC", "burst": True,
                "bands": [{"type": "DROP", "rate": rate_kbps, "burstSize": rate_kbps // 10}]}
        r = requests.post(f'{ONOS}/meters/{S1}', json=body, auth=AUTH); r.raise_for_status()
        ids.append(int(r.headers['Location'].rstrip('/').split('/')[-1]))   # meter id from Location header
    # end = time.time() + 3                       # wait until ONOS reports the meters ADDED on the switch
    # while time.time() < end:
    #     st = {m['id']: m['state'] for m in requests.get(f'{ONOS}/meters/{S1}', auth=AUTH).json()['meters']}
    #     if all(st.get(str(i)) == 'ADDED' for i in ids): break
    #     time.sleep(0.2)
    time.sleep(0.5)                             # OpenFlow keeps order: meter-mod is processed before the flow-mods that use it
    flows = []
    for ip, mid in zip(BULK, ids):              # same meter for a host's flows to h4 and h5
        for dst in DSTS:
            flows.append({"priority": PRIO, "timeout": 0, "isPermanent": True, "deviceId": S1,
                "selector": {"criteria": [{"type": "ETH_TYPE", "ethType": "0x0800"},
                                          {"type": "IPV4_SRC", "ip": ip + "/32"},
                                          {"type": "IPV4_DST", "ip": dst + "/32"}]},
                "treatment": {"instructions": [{"type": "METER", "meterId": mid},
                                               {"type": "OUTPUT", "port": str(OUT_PORT)}]}})
    r = requests.post(f'{ONOS}/flows?appId={APP}', json={"flows": flows}, auth=AUTH); r.raise_for_status()
    return ids

def restore():
    """Remove our flows first, then our meters."""
    requests.delete(f'{ONOS}/flows/application/{APP}', auth=AUTH)
    time.sleep(0.5)
    for m in requests.get(f'{ONOS}/meters/{S1}', auth=AUTH).json().get('meters', []):
        if m['appId'] == 'org.onosproject.rest':
            requests.delete(f"{ONOS}/meters/{S1}/{m['id']}", auth=AUTH)

def flow_bytes():
    """Per-bulk-host matched bytes (pre-meter = offered traffic) from ONOS flow stats, plus newest flow 'life' (s)."""
    fl = requests.get(f'{ONOS}/flows/application/{APP}', auth=AUTH).json().get('flows', [])
    ip = lambda f, t: next(c['ip'] for c in f['selector']['criteria'] if c['type'] == t)[:-3]   # strip '/32'
    b = {h: 0 for h in BULK}
    for f in fl: b[ip(f, 'IPV4_SRC')] += f['bytes']
    return b, max((f['life'] for f in fl), default=0)

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'status'
    if cmd == 'on': print('meters', restrict())
    elif cmd == 'off': restore(); print('restored')
    print('flows:', len(requests.get(f'{ONOS}/flows/application/{APP}', auth=AUTH).json().get('flows', [])),
          'meters:', len(requests.get(f'{ONOS}/meters/{S1}', auth=AUTH).json().get('meters', [])))