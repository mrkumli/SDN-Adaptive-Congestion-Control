import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Network, Menu, X } from 'lucide-react'
import { NAV } from '../nav.js'

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-400/40 bg-emerald-400/10 text-emerald-300">
        <Network size={15} aria-hidden="true" />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-zinc-50">SDN Control Center</p>
        <p className="text-[11px] text-zinc-500">Adaptive Congestion Control</p>
      </div>
    </div>
  )
}

function NavList({ onNavigate }) {
  return (
    <nav aria-label="Main" className="space-y-0.5">
      {NAV.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
              isActive ? 'bg-zinc-800/80 text-zinc-50' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={16} aria-hidden="true" className={isActive ? 'text-emerald-400' : ''} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-zinc-800 bg-zinc-950 p-3 lg:flex">
        <div className="py-3"><Brand /></div>
        <div className="mt-3"><NavList /></div>
        <p className="mt-auto px-2.5 text-[11px] leading-relaxed text-zinc-500">
          Recorded results are real. Simulations are labeled illustrative.
        </p>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-4 py-3 backdrop-blur lg:hidden">
        <Brand />
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Toggle menu"
          className="rounded-md border border-zinc-800 p-1.5 text-zinc-300 outline-none hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-emerald-400/60"
        >
          {open ? <X size={16} /> : <Menu size={16} />}
        </button>
      </header>
      {open && (
        <div className="border-b border-zinc-800 bg-zinc-950 p-3 lg:hidden">
          <NavList onNavigate={() => setOpen(false)} />
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
