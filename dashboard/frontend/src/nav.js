import { LayoutDashboard, Network, Terminal, Gauge, Activity } from 'lucide-react'

export const NAV = [
  { to: '/', label: 'Overview', Icon: LayoutDashboard },
  { to: '/topology', label: 'Network Topology', Icon: Network },
  { to: '/task1', label: 'Task 1 · Infrastructure', Icon: Terminal },
  { to: '/task2', label: 'Task 2 · Congestion Control', Icon: Gauge },
  { to: '/results', label: 'Experiments & Results', Icon: Activity },
]
