import { useState } from 'react'
import { Copy, Check, ChevronDown } from 'lucide-react'

const BTN = 'flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-zinc-400 outline-none hover:bg-zinc-800 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-emerald-400/60'

export default function CommandPanel({ cmd, does, why, expect, errors = [] }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(cmd); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard unavailable */ }
  }
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-end gap-1 border-b border-zinc-800 px-2 py-1">
        <button onClick={copy} className={BTN} aria-label="Copy command">
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}{copied ? 'Copied' : 'Copy'}
        </button>
        <button onClick={() => setOpen(!open)} aria-expanded={open} className={BTN}>
          Details <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[13px] leading-relaxed text-zinc-200"><code>{cmd}</code></pre>
      {open && (
        <dl className="space-y-2.5 border-t border-zinc-800 px-3 py-3 text-sm">
          {[['What it does', does], ['Why it matters', why], ['Expected result', expect]].filter(([, v]) => v).map(([k, v]) => (
            <div key={k}><dt className="text-xs text-zinc-500">{k}</dt><dd className="mt-0.5 text-zinc-300">{v}</dd></div>
          ))}
          {errors.length > 0 && (
            <div><dt className="text-xs text-zinc-500">Common errors</dt>
              <dd><ul className="mt-0.5 list-disc space-y-1 pl-4 text-zinc-400">{errors.map((e) => <li key={e}>{e}</li>)}</ul></dd></div>
          )}
        </dl>
      )}
    </div>
  )
}
