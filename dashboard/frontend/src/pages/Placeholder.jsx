import { PageHeader, Badge } from '../components/ui.jsx'

// Temporary stub; each section replaces it as it is built.
export default function Placeholder({ item }) {
  return (
    <div className="space-y-6">
      <PageHeader kicker="Section" title={item.label} />
      <Badge tone="warn">In progress</Badge>
    </div>
  )
}
