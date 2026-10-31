# SDN Adaptive Congestion Control

Adaptive Congestion Detection and Traffic Control
using Software-Defined Networking (SDN).

## Overview

This project investigates congestion detection and
traffic management in a software-defined network
using Mininet, Open vSwitch, and ONOS.

## Technologies

- Ubuntu 24.04
- Python 3
- Mininet
- Open vSwitch
- OpenFlow 1.3
- ONOS Controller 2.7.0
- iperf3

## Network Topology

The network consists of:

- 3 OpenFlow switches
- 5 hosts
- A 10 Mbps bottleneck link
- An external SDN controller

## Project Objectives

1. Monitor network traffic.
2. Detect congestion based on link utilization.
3. Apply traffic control to bulk flows.
4. Restore normal traffic after congestion clears.
5. Evaluate network performance.

## Evaluation Metrics

- Throughput
- Latency
- Packet loss
- Link utilization

## Project Status

Implementation and experimental evaluation in progress.
