// Shared design primitives: reuse these on every page.
export function PageHeader({ kicker, title, children }) {
  return (
    <header className="border-b border-zinc-800 pb-6">
      <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/80">{kicker}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">{title}</h1>
      {children && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{children}</p>}
    </header>
  )
}

export function Card({ className = '', children }) {
  return <div className={`rounded-lg border border-zinc-800 bg-zinc-900/40 ${className}`}>{children}</div>
}

const TONES = {
  neutral: 'border-zinc-700 text-zinc-400',
  accent: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  warn: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
}
export function Badge({ tone = 'neutral', children }) {
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>{children}</span>
}
