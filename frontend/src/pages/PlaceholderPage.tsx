import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

import { TechBorder } from '@/components/ioc/TechBorder'

interface PlaceholderPageProps {
  title: string
  subtitle?: string
  /** Optional label shown as “Reserved for …” (e.g. module or feature name). */
  reservedFor?: string
  notes?: string[]
}

/**
 * Reusable placeholder for routes whose real implementation ships in a
 * later iteration. The mood matches the IOC palette so navigation feels live.
 */
export function PlaceholderPage({ title, subtitle, reservedFor, notes }: PlaceholderPageProps) {
  return (
    <div className="flex h-full min-h-[calc(100vh-3.5rem)] items-start justify-center p-6">
      <TechBorder className="w-full max-w-3xl">
        <div className="space-y-4 p-8">
          <Link
            to="/city"
            className="inline-flex items-center gap-1 text-xs text-ioc-text-secondary hover:text-ioc-cyan"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to overview
          </Link>
          <h1 className="font-title text-2xl font-bold uppercase tracking-widest text-ioc-cyan text-glow-cyan">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm text-ioc-text-secondary">{subtitle}</p>
          ) : null}
          {reservedFor ? (
            <p className="font-mono text-xs uppercase tracking-wider text-ioc-text-muted">
              Reserved for {reservedFor}
            </p>
          ) : null}
          {notes && notes.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-ioc-text-secondary">
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </TechBorder>
    </div>
  )
}
