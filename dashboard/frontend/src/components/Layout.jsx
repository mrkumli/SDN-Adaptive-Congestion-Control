import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { NAV } from '../nav.js'

const GROUPS = ['Start', 'Learning Mode', 'Live Mode']

function NavList({ onNavigate }) {
  return (
    <nav aria-label="Main" className="space-y-6">
      {GROUPS.map((g) => (
        <div key={g}>
          <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{g}</p>
          <ul className="space-y-1">
            {NAV.filter((n) => n.group === g).map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.to === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                      isActive ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <span aria-hidden="true">{n.icon}</span>
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export default function Layout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 border-r border-slate-800 bg-slate-900 p-4 overflow-y-auto">
        <p className="px-3 py-4 text-lg font-bold text-cyan-400">SDN Learning Lab</p>
        <NavList />
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
        <p className="font-bold text-cyan-400">SDN Learning Lab</p>
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Toggle menu"
          className="rounded-lg px-3 py-1 text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          {open ? '✕' : '☰'}
        </button>
      </header>
      {open && (
        <div className="lg:hidden border-b border-slate-800 bg-slate-900 p-4">
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