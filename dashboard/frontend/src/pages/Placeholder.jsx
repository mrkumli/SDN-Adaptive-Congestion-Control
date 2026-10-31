export default function Placeholder({ item }) {
  return (
    <section>
      <h1 className="text-3xl font-bold">
        <span aria-hidden="true">{item.icon}</span> {item.label}
      </h1>
      <p className="mt-4 rounded-lg border border-dashed border-slate-700 p-6 text-slate-400">
        This section is coming soon.
      </p>
    </section>
  )
}