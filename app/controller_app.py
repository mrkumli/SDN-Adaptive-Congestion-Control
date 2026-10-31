#!/usr/bin/env python3
"""controller_app.py - closed-loop congestion control: monitor -> detect -> restrict -> recover.
Run: python3 controller_app.py   (Ctrl-C restores normal forwarding and exits)"""
import csv, os, time
from monitor import Monitor, CAP_MBPS
import onos_ctl

HIGH, N_HIGH = 0.80, 3      # congestion: utilization > 80% for 3 consecutive readings
LOW, N_LOW = 0.50, 5        # recovery: utilization < 50% for 5 consecutive readings ...
PINNED = 0.80               # ... and no restricted host offering > 80% of its limit (it still wants more)
COOLDOWN = 15               # s: minimum time in a state before the next transition (anti-flapping)
LIMIT = onos_ctl.RATE_KBPS / 1000.0                    # per-host limit in Mbps
LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'results', 'controller_log.csv')

def main():
    mon = Monitor(); onos_ctl.restore()                # start from a clean NORMAL state
    state, hi, lo, t_state, prev, off = 'NORMAL', 0, 0, 0.0, None, None
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    f = open(LOG, 'w', newline=''); w = csv.writer(f)
    w.writerow(['t_epoch', 'rate_mbps', 'util_pct', 'state', 'hi', 'lo', 'off_h1_mbps', 'off_h3_mbps', 'event', 'action_ms'])
    try:
        while True:
            #rate = mon.sample()                        # Mbps when ONOS has a NEW port sample, else None
            try: rate = mon.sample()                   # Mbps when ONOS has a NEW port sample, else None
            except Exception: rate = None              # ONOS/device not ready yet (e.g. Mininet restarting)
            if rate is None: time.sleep(0.5); continue
            util, now, ev, ms = rate / CAP_MBPS, time.time(), '', ''
            if state == 'NORMAL':
                hi = hi + 1 if util > HIGH else 0      # consecutive over-threshold readings
                if hi >= N_HIGH and now - t_state >= COOLDOWN:           # DETECT -> ACT
                    t0 = time.time(); onos_ctl.restrict(); ms = round((time.time() - t0) * 1000)
                    state, t_state, hi, lo, prev, off, ev = 'RESTRICTED', time.time(), 0, 0, None, None, 'RESTRICT_APPLIED'
            else:
                #b, life = onos_ctl.flow_bytes()        # offered load per bulk host (counted before the meter drops)
                try: b, life = onos_ctl.flow_bytes()   # offered load per bulk host (counted before the meter drops)
                except Exception: time.sleep(0.5); continue
                if prev is None or life > prev[1]:     # only use NEW ONOS flow-stats samples
                    if prev: off = {h: (b[h] - prev[0][h]) * 8 / (life - prev[1]) / 1e6 for h in b}
                    prev = (b, life)
                pinned = off is None or max(off.values()) > PINNED * LIMIT   # unknown counts as pinned (stay safe)
                lo = lo + 1 if (util < LOW and not pinned and now - t_state >= COOLDOWN) else 0
                if lo >= N_LOW:                                          # RECOVER
                    t0 = time.time(); onos_ctl.restore(); ms = round((time.time() - t0) * 1000)
                    state, t_state, hi, lo, prev, off, ev = 'NORMAL', time.time(), 0, 0, None, None, 'RESTORE_APPLIED'
            o = [round(off[h], 2) if off else '' for h in onos_ctl.BULK]
            print(f'{time.strftime("%H:%M:%S")} {rate:5.2f}Mbps {100*util:5.1f}% hi={hi} lo={lo} {state:10} off={o} {ev} {ms}', flush=True)
            w.writerow([round(now, 3), round(rate, 3), round(100 * util, 1), state, hi, lo, *o, ev, ms]); f.flush()
    except KeyboardInterrupt: pass
    finally:
        if state == 'RESTRICTED': onos_ctl.restore()   # never leave restrictions behind
        f.close()

if __name__ == '__main__': main()