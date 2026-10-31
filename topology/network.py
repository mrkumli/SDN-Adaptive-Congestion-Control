#!/usr/bin/env python3
"""
DCN Project - SDN congestion-control topology (Mininet + ONOS, OpenFlow 1.3)

  h1 (bulk A)  10.0.0.1 --+
  h2 (latency) 10.0.0.2 --+-- s1 ==[10 Mbps, 5ms]== s2 --[100 Mbps]-- s3 --+-- h4 10.0.0.4
  h3 (bulk B)  10.0.0.3 --+                                               +-- h5 10.0.0.5

Run:  sudo python3 network.py [controller_ip]
"""
import sys
from mininet.net import Mininet
from mininet.node import RemoteController, OVSSwitch
from mininet.link import TCLink          # TCLink = links that support bw/delay via Linux tc
from mininet.topo import Topo
from mininet.cli import CLI
from mininet.log import setLogLevel, info

# --- Tunable parameters (reused in Task 2) ---
BOTTLENECK_BW = 10      # Mbps, the s1-s2 link we will congest
BOTTLENECK_DELAY = '5ms'
ACCESS_BW = 100         # Mbps, host links and s2-s3 link
CONTROLLER_PORT = 6653  # ONOS OpenFlow listening port (NOT the 8181 GUI/REST port)


class CongestionTopo(Topo):
    def build(self):    
        # Switches: OpenFlow 1.3 is required for meters later
        s1 = self.addSwitch('s1', protocols='OpenFlow13')
        s2 = self.addSwitch('s2', protocols='OpenFlow13')
        s3 = self.addSwitch('s3', protocols='OpenFlow13')

        # Hosts with fixed IPs and MACs so ONOS shows stable identities
        h1 = self.addHost('h1', ip='10.0.0.1/24', mac='00:00:00:00:00:01')  # bulk A
        h2 = self.addHost('h2', ip='10.0.0.2/24', mac='00:00:00:00:00:02')  # latency-sensitive
        h3 = self.addHost('h3', ip='10.0.0.3/24', mac='00:00:00:00:00:03')  # bulk B
        h4 = self.addHost('h4', ip='10.0.0.4/24', mac='00:00:00:00:00:04')  # server
        h5 = self.addHost('h5', ip='10.0.0.5/24', mac='00:00:00:00:00:05')  # server

        # Sender-side access links
        for h in (h1, h2, h3):
            self.addLink(h, s1, bw=ACCESS_BW)
        # Receiver-side access links
        for h in (h4, h5):
            self.addLink(h, s3, bw=ACCESS_BW)

        # THE BOTTLENECK: all sender traffic must cross this one link
        self.addLink(s1, s2, bw=BOTTLENECK_BW, delay=BOTTLENECK_DELAY)
        self.addLink(s2, s3, bw=ACCESS_BW)


def run(controller_ip='127.0.0.1'):
    net = Mininet(topo=CongestionTopo(), controller=None,
                  switch=OVSSwitch, link=TCLink, autoSetMacs=False)
    net.addController('c0', controller=RemoteController,
                      ip=controller_ip, port=CONTROLLER_PORT)
    net.start()
    info('*** Waiting for switches to connect to ONOS\n')
    net.waitConnected()
    info('*** Ready. Try: pingall | net | links | h1 ping -c3 h4\n')
    CLI(net)
    net.stop()


if __name__ == '__main__':
    setLogLevel('info')
    run(sys.argv[1] if len(sys.argv) > 1 else '127.0.0.1')