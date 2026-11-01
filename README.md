# SDN Adaptive Congestion Control

**Adaptive Congestion Detection and Traffic Control Using Software-Defined Networking**  
Data Communication and Networking (DCN) · Fall 2026 · Habib University

A working, controller-driven congestion-management system built with **Mininet, Open vSwitch, ONOS 2.7.0, OpenFlow 1.3, and Python**. It monitors a constrained link, detects persistent congestion, selectively limits bulk traffic, and restores normal forwarding when demand subsides. A companion **React SDN Control Center** helps explain the architecture, inspect the topology, explore the control algorithm, and replay recorded experiments.

> **Dashboard modes:** The React dashboard currently offers *illustrative interactive simulations* and *replays of saved experimental measurements*. It **does not** connect live to ONOS or control the network. The working SDN control loop is implemented in `app/`.

## Project at a glance

| Item | Configuration |
| --- | --- |
| Network emulator | Mininet with `TCLink` |
| Switches | 3 Open vSwitch switches (`s1`, `s2`, `s3`) |
| Hosts | 5 (`h1`–`h5`) |
| Bottleneck | `s1` ↔ `s2`, 10 Mbps, 5 ms configured delay |
| Other links | 100 Mbps |
| External controller | ONOS 2.7.0 on `127.0.0.1:6653` |
| Southbound protocol | OpenFlow 1.3 |
| Monitoring | ONOS REST port statistics, approximately every 2 seconds |
| Congestion trigger | >80% bottleneck utilization for 3 consecutive readings |
| Congestion action | 3 Mbps OpenFlow meters on bulk senders `h1` and `h3` |
| Recovery | <50% for 5 readings, 15-second cooldown, and offered-load guard |

### Topology

```text
 h1 ──┐
 h2 ──┼── s1 ══ 10 Mbps / 5 ms ══ s2 ── s3 ── h4
 h3 ──┘                                  │
                                        h5
```

- **h1 and h3:** bulk TCP senders.
- **h2:** latency-sensitive traffic (UDP stream and periodic ping).
- **h4 and h5:** receiving hosts.
- The other host-to-switch and switch-to-switch links are configured for 100 Mbps.

## How the SDN solution works

1. **Monitor:** `app/monitor.py` retrieves ONOS port counters for the `s1 → s2` interface and calculates link utilization.
2. **Detect:** `app/controller_app.py` identifies congestion after three consecutive readings above **80%** of the 10 Mbps bottleneck (above 8 Mbps).
3. **Restrict:** `app/onos_ctl.py` asks ONOS to install metered OpenFlow rules limiting `h1` and `h3` to **3 Mbps each** while leaving protected `h2` traffic unrestricted.
4. **Recover:** The controller restores normal forwarding only after five readings below **50%**, the cooldown requirement, and a guard checking whether restricted senders still have excess offered load. This helps avoid oscillation between restricted and unrestricted states.
5. **Evaluate:** Repeated controlled/uncontrolled experiments compare throughput, latency, loss, jitter, utilization, and controller-response timing.

**Control plane:** ONOS supplies statistics and installs/removes rules and meters using OpenFlow.  
**Decision logic:** Python implements detection, action, and recovery.  
**Data plane:** Open vSwitch forwards packets and enforces the meters.  

The thresholds, cooldown, and rate limit are **experimental design choices**, not universal optimal values.

## Experimental results

The project evaluated baseline traffic (A), competing bulk traffic without adaptive control (B), competing traffic with ONOS control (C), and post-congestion recovery (D). The steady-window figures below are reported means from **three B runs and three C runs** on the same emulated topology.

| Metric | B: No adaptive control | C: ONOS control |
| --- | ---: | ---: |
| Protected ping latency | 1,388 ms | 10.6 ms |
| Protected ping loss | 18.9% | 0% |
| Protected UDP throughput | 0.81 Mbps | 1.00 Mbps |
| Protected UDP loss | 18.7% | 0% |
| UDP jitter | 4.68 ms | 0.59 ms |
| Bulk throughput, h1 | 4.21 Mbps | 2.89 Mbps |
| Bulk throughput, h3 | 4.21 Mbps | 2.89 Mbps |

**Observed trade-off:** Protected ping latency decreased by approximately **99%**, and protected UDP loss dropped to **0%**, while bulk throughput decreased by approximately **31% per sender**.

In the controlled runs, congestion detection took approximately **7.5–7.6 seconds** after bulk traffic began, restriction installation approximately **525–532 ms**, and restoration occurred approximately **11.4–11.5 seconds** after bulk traffic stopped. These measurements describe this testbed, not guarantees for real-world networks.

### Limitations

- Three runs per comparison scenario and one emulated topology limit generalizability.
- Deep emulated queues amplify uncontrolled latency (bufferbloat).
- Fixed 3 Mbps meters improve protected traffic at the expense of bulk throughput and may leave link capacity unused.
- The selected thresholds and timing parameters were not exhaustively optimized.
- The dashboard's simulation is **not** an emulation of TCP dynamics or an ONOS connection; use saved results for measured evidence.

## Repository structure

```text
SDN-Adaptive-Congestion-Control/
├── app/
│   ├── controller_app.py    # Closed-loop decision logic and event logging
│   ├── monitor.py           # ONOS statistics and utilization
│   ├── onos_ctl.py          # ONOS REST flow/meter actions
│   └── analyze.py           # Experimental aggregation and figures
├── topology/
│   ├── network.py           # Three-switch/five-host Mininet topology
│   └── experiment.py       # Repeatable traffic experiments
├── results/                # Recorded experimental outputs and summaries
├── dashboard/              # Optional React visualization companion
│   ├── frontend/           # Vite + React + Tailwind CSS
│   └── tools/              # Recorded-data preparation and verification
└── README.md
```

`dashboard/` is included in this layout **only when committed to the repository**. The locally installed ONOS distribution and `node_modules/` are not part of the source repository. There may be additional files in the working tree.

## Requirements

- Ubuntu 24.04 (project development environment)
- Python 3, Mininet, Open vSwitch, `iperf3`
- ONOS 2.7.0 with OpenFlow, host provider, LLDP provider, and reactive-forwarding applications
- OpenJDK 11 for the existing ONOS installation
- Node.js and npm **only** for the optional dashboard

ONOS is expected to be installed separately at `~/dcn-project/controller/onos-2.7.0`. The repository does not bundle the controller.

## Running the SDN testbed

The commands below reflect the project's established Ubuntu setup. Execute each set in the terminal indicated.

**Terminal 1 — Start ONOS**

```bash
export JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
export JAVA_TOOL_OPTIONS="-Djdk.util.zip.disableZip64ExtraFieldValidation=true"
cd ~/dcn-project/controller/onos-2.7.0
./bin/onos-service start
```

**Terminal 2 — ONOS CLI**

```bash
ssh -o HostKeyAlgorithms=+ssh-rsa -p 8101 onos@localhost
```

At the `onos@root >` prompt, check or activate the required apps:

```text
apps -s -a
app activate org.onosproject.openflow
app activate org.onosproject.hostprovider
app activate org.onosproject.lldpprovider
app activate org.onosproject.fwd
app activate org.onosproject.gui
```

Use the ONOS CLI only for the above ONOS commands, **not** for Linux commands. If applications are already active, leave them active. On the original testbed, the host, LLDP, and forwarding providers occasionally required reactivation after the Mininet topology started.

**Terminal 3 — Launch the Mininet topology**

```bash
cd ~/dcn-project/topology
sudo mn -c
sudo python3 network.py
```

At `mininet>`, check connectivity:

```text
nodes
net
links
pingall
```

The ONOS topology GUI (when enabled) is at `http://localhost:8181/onos/ui/`. You can also inspect `devices`, `hosts`, `links`, and `flows` in the ONOS CLI.

**Separate Linux terminal — Start the congestion-control application**

```bash
cd ~/dcn-project
python3 app/controller_app.py
```

The application communicates with the already-running ONOS controller through its REST API. Do not run competing instances of the control loop or the experiment topology simultaneously unless the experiment instructions explicitly require it.

### Running experiments

Experiments are managed by `topology/experiment.py`; a representative run is:

```bash
cd ~/dcn-project/topology
sudo python3 experiment.py C_run1 --duration 60
```

For **B (uncontrolled)** comparisons, stop the adaptive Python controller app. For **C (controlled)** comparisons, run it and verify ONOS is reachable. Clean stale Mininet/iperf3 processes between runs as specified in the experiment procedure. Reuse the same traffic setup for fair comparison.

Aggregate outputs using:

```bash
cd ~/dcn-project
python3 app/analyze.py
```

Run commands and scenario timing may need to be adapted to your local file layout and installed versions. Review console output and generated files before citing measurements.

## SDN Control Center — React dashboard

The optional React dashboard is a local interactive companion for **understanding and demonstrating** this project. It includes five pages:

| Page | Purpose |
| --- | --- |
| **Overview** | Explains the system architecture, control loop, and key specifications |
| **Network Topology** | Clickable topology with illustrative normal, congested, and controlled traffic states |
| **Task 1 — Infrastructure** | Guided commands, verification steps, and troubleshooting explanations |
| **Task 2 — Congestion Control** | Interactive visualization of detection counters, meter restrictions, cooldown, and recovery guard |
| **Experiments & Results** | Recorded B/C comparisons, replay timeline, event markers, metrics, and trade-offs |

**Important:** It currently has **no Live Lab backend**. The topology and Task 2 controls are educational illustrations; the Results page uses snapshots derived from the recorded experiments.

### Start the dashboard

```bash
cd ~/dcn-project/dashboard/frontend
npm install
npm run dev
```

Open the local address Vite prints, normally `http://localhost:5173/`.

The dashboard can be explored **without starting ONOS or Mininet**. If experiment outputs have been updated locally, rebuild the dashboard's data snapshot using the provided tooling:

```bash
cd ~/dcn-project
python3 dashboard/tools/build_data.py
python3 dashboard/tools/verify_data.py
```

Then refresh the browser. Keep `node_modules/`, `dist/`, credentials, and machine-specific environment files out of Git.

## Academic context

The work was developed for the **Data Communication and Networking course, Fall 2026**, as a two-stage SDN assignment: (1) environment/controller integration and topology discovery, followed by (2) controller-driven application, experiments, and evaluation.

### References

1. N. McKeown et al., “OpenFlow: Enabling Innovation in Campus Networks,” *ACM SIGCOMM CCR*, 2008. DOI: `10.1145/1355734.1355746`.
2. P. Berde et al., “ONOS: Towards an Open, Distributed SDN OS,” *ACM HotSDN*, 2014. DOI: `10.1145/2620728.2620744`.
3. M. Al-Fares et al., “Hedera: Dynamic Flow Scheduling for Data Center Networks,” *USENIX NSDI*, 2010.
4. J. Gettys and K. Nichols, “Bufferbloat: Dark Buffers in the Internet,” *ACM Queue*, 2011. DOI: `10.1145/2063166.2071893`.

## Status

**SDN implementation, controlled experiments, final report, presentation, and local interactive dashboard completed.** The dashboard is an optional visualization component and is not required to operate the SDN controller.
