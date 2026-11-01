// Commands come from your shell history, network.py and project notes.
export const TERMINALS = [
  ['ONOS terminal', 'Starts ONOS. The start command returns to the prompt while ONOS keeps running in the background.'],
  ['ONOS CLI', 'An ssh session into ONOS (port 8101) for apps and network state.'],
  ['Mininet terminal', 'Runs network.py and the mininet> prompt.'],
  ['Check terminal', 'A free terminal for curl checks.'],
]

export const STEPS = [
  { id: 'clean', title: 'Clean stale state', terminal: 'Mininet terminal',
    why: 'Interrupted runs leave old Mininet switches and iperf3 processes behind, which break the next start.',
    commands: [{
      cmd: `sudo mn -c; sudo pkill iperf3`,
      does: 'Removes leftover Mininet switches, links and namespaces, and stops stray iperf3 processes.',
      why: 'Starts every run from a clean network.',
      expect: 'Cleanup messages or silence, and no errors. Silence from pkill means no iperf3 was running.',
      errors: ['Password prompt: enter your Ubuntu password (sudo).'] }] },

  { id: 'onos', title: 'Start ONOS', terminal: 'ONOS terminal',
    why: 'ONOS is the SDN controller; the switches and our Python app both depend on it.',
    commands: [
      { cmd: `export JAVA_TOOL_OPTIONS="-Djdk.util.zip.disableZip64ExtraFieldValidation=true"`,
        does: 'Tells Java to accept the ONOS jar format.',
        why: 'Without it ONOS 2.7.0 fails to start with an Invalid CEN header error on your Java.',
        expect: 'No output. It only lasts for this terminal unless added to ~/.bashrc.',
        errors: ['Invalid CEN header when starting ONOS: this variable was not set in that terminal.'] },
      { cmd: `cd ~/dcn-project/controller/onos-2.7.0
./bin/onos-service start`,
        does: 'Starts ONOS from its install folder.',
        why: 'Opens the OpenFlow port (6653), the REST/GUI port (8181) and the CLI port (8101).',
        expect: 'The prompt returns while ONOS keeps running in the background. Give it a minute or more to finish starting before the next step.',
        errors: ['After a restart, the onos-core-dist and onos-core-net bundles have needed manual restoration. Check their status instead of reinstalling ONOS.'] }] },

  { id: 'cli', title: 'Open the ONOS CLI', terminal: 'ONOS CLI',
    why: 'The CLI is how we activate ONOS applications and inspect what it has discovered.',
    commands: [{
      cmd: `ssh -o HostKeyAlgorithms=+ssh-rsa -p 8101 onos@localhost`,
      does: "Logs into ONOS's shell over SSH on port 8101 as user onos.",
      why: 'ONOS offers its CLI through SSH. The option allows its older RSA host key.',
      expect: 'A password prompt (rocks), then an onos> prompt.',
      errors: ['no matching host key type found: the -o HostKeyAlgorithms=+ssh-rsa option is missing.', 'Connection refused: ONOS has not finished starting.'] }] },

  { id: 'apps', title: 'Activate ONOS applications', terminal: 'ONOS CLI',
    why: 'ONOS only talks to switches, finds links and hosts, and forwards packets once these apps are active.',
    commands: [
      { cmd: `app activate org.onosproject.openflow
app activate org.onosproject.hostprovider
app activate org.onosproject.lldpprovider
app activate org.onosproject.fwd
app deactivate org.onosproject.gui2
app activate org.onosproject.gui`,
        does: 'openflow: speaks OpenFlow to switches. hostprovider: learns hosts. lldpprovider: discovers links. fwd: reactive forwarding so hosts can ping. gui replaces gui2 for the web interface.',
        why: 'Without openflow no switch can connect; without fwd pings fail.',
        expect: 'Each command returns quickly, usually with no error text.',
        errors: ['pingall later fails: check that fwd is active.'] },
      { cmd: `apps -s -a`,
        does: 'Lists active applications (standard ONOS CLI command).',
        why: 'Confirms the five apps are really active.',
        expect: 'Lines marked * for openflow, hostprovider, lldpprovider, fwd and gui, plus a few defaults.' }] },

  { id: 'mininet', title: 'Start the Mininet topology', terminal: 'Mininet terminal',
    why: 'Builds our 3-switch, 5-host network and connects it to ONOS.',
    commands: [{
      cmd: `cd ~/dcn-project/topology
sudo python3 network.py`,
      does: 'Runs network.py: creates s1–s3 and h1–h5, connects to the controller at 127.0.0.1:6653, then opens the Mininet CLI.',
      why: 'sudo is needed to create virtual network devices.',
      expect: 'It waits for the switches to connect to ONOS, prints a Ready line (pingall | net | links | h1 ping -c3 h4), then shows the mininet> prompt.',
      errors: ['Stuck on Waiting for switches: ONOS is not running, the openflow app is not active, or the port is wrong (switches use 6653, not 8181).',
        'File exists or leftover interface errors: run the cleanup step.',
        'sch_htb quantum warnings on the 100 Mbps links were seen and did not stop connectivity.'] }] },

  { id: 'switches', title: 'Verify switches in ONOS', terminal: 'Check terminal',
    why: 'Confirms every switch connected to ONOS before any test.',
    commands: [{
      cmd: `curl -s -u onos:rocks http://localhost:8181/onos/v1/devices | python3 -m json.tool | grep -E '"id"|"available"'`,
      does: 'Asks the ONOS REST API for its devices and prints only each ID and availability.',
      why: 'The same REST API is what our Python controller uses.',
      expect: 'Three devices (of:000000000000000N), each with "available": true.',
      errors: ['No output: ONOS not ready, or wrong credentials (onos / rocks).', '"available": false: Mininet is not running or the openflow app is inactive.'] }] },

  { id: 'ping', title: 'Test connectivity', terminal: 'Mininet terminal',
    why: 'Proves traffic can cross the whole topology through ONOS-installed forwarding.',
    commands: [
      { cmd: `pingall`,
        does: 'Every host pings every other host (5 hosts = 20 pairs).',
        why: 'The quickest end-to-end check, and it makes ONOS learn the hosts.',
        expect: 'Results: 0% dropped (20/20 received).',
        errors: ['Dropped pings: check the fwd app and the devices check above.'] },
      { cmd: `h1 ping -c3 h4`,
        does: 'Sends 3 pings from h1 across s1, the bottleneck, s2 and s3 to h4.',
        why: 'Shows the baseline latency through the bottleneck link (5 ms delay each way).',
        expect: 'Three replies at roughly 10 ms.' },
      { cmd: `net`,
        does: 'Prints each node and what it is connected to.',
        why: 'Confirms the wiring and which switch port each link uses.',
        expect: 'Hosts h1–h3 on s1, h4–h5 on s3, s1–s2 and s2–s3 between switches.' }] },

  { id: 'discover', title: 'Check discovery in ONOS', terminal: 'ONOS CLI',
    why: 'Confirms ONOS sees the same network Mininet built.',
    commands: [
      { cmd: `devices
links
hosts`,
        does: 'Lists switches, switch-to-switch links and learned hosts (standard ONOS CLI commands).',
        why: 'Our controller relies on ONOS knowing this topology.',
        expect: '3 devices available; the s1–s2 and s2–s3 links (listed per direction); 5 hosts with 10.0.0.1–10.0.0.5.',
        errors: ['No hosts listed: hosts are learned from traffic. Run pingall first.'] },
      { cmd: `http://localhost:8181/onos/ui/`,
        does: 'Opens the ONOS web GUI (browser, login onos / rocks).',
        why: 'A visual check of the discovered topology, useful in the demo.',
        expect: 'The topology view shows 3 switches, 5 hosts and their links.' }] },
]

export const TROUBLE = [
  ['Invalid CEN header when starting ONOS', 'Set JAVA_TOOL_OPTIONS in that same terminal before starting ONOS. Do not reinstall ONOS, switch to Docker or downgrade Java.'],
  ['ONOS core bundles inactive after a restart', 'The onos-core-dist and onos-core-net bundles have needed manual restoration. Check their status in the ONOS CLI (for example bundle:list | grep onos-core) and restore them rather than reinstalling.'],
  ['ssh: no matching host key type', 'Add -o HostKeyAlgorithms=+ssh-rsa to the ssh command.'],
  ['Mininet stuck on "Waiting for switches"', 'Check ONOS is running, the openflow app is active, and that switches use port 6653 (8181 is only REST and the GUI).'],
  ['Leftover interfaces / File exists', 'Run sudo mn -c; sudo pkill iperf3, then start network.py again.'],
  ['ONOS shows no hosts', 'Hosts appear after they send traffic. Run pingall in Mininet.'],
  ['pingall drops packets', 'Check apps -s -a (fwd must be active) and that all 3 devices are available.'],
  ['sch_htb quantum warnings', 'Seen on the 100 Mbps links. Connectivity still passed (pingall 0% dropped).'],
]
