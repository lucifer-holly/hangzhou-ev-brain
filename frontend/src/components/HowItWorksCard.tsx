/**
 * HowItWorksCard — Spawn 9.7/C
 *
 * A friendly explainer card that translates each detail page's underlying
 * algorithm into a 2–3 sentence plain-language description and surfaces the
 * tech name(s) as small pills. Replaces the engineer-tone "Pipeline · 流水线
 * → POST /api/… → XGBoost 推断" footnotes that the older detail pages
 * shipped, because portfolio visitors don't need (and shouldn't have to read)
 * the API path to understand what the page does.
 *
 * Visual conventions:
 *   - SaaS-light surface (the detail pages are light-themed)
 *   - 4 px gradient cyan→blue accent bar on the left edge — this is the
 *     small visual signal that ties an otherwise "ordinary card" to the
 *     project's IOC accent palette and tells the eye "this card explains
 *     something about the AI/algorithm"
 *   - Tech badges in cyan-tinted pills (matches the IOC vibe for the tech
 *     name itself, even on a SaaS-light page)
 *   - "查看架构详情" CTA opens the project ArchitectureModal so a curious
 *     reader can drill into the full system diagram + AI metrics
 *
 * Bundle cost: the modal is shared with AIModelsCard / TechStackRibbon, so
 * importing it from this card adds essentially zero extra weight beyond a
 * few hundred bytes of JSX.
 */

import { useState, type ReactNode } from 'react'
import { ChevronRight, Sparkles } from 'lucide-react'

import { ArchitectureModal } from '@/components/ArchitectureModal'
import { cn } from '@/lib/utils'

interface HowItWorksCardProps {
  /** Inline icon node (emoji or Lucide icon). Rendered in a soft cyan chip. */
  icon?: ReactNode
  /**
   * Card title — recommended format: "<topic> · How it works".
   * Keep titles short; the description does the heavy lifting.
   */
  title: string
  /**
   * Plain-language explanation of the underlying AI / algorithm. 2–3 sentences.
   * Don't expose API paths or hyperparameter values; do keep tech names
   * (XGBoost, SHAP, LSTM, …) since they are part of the project's signal.
   */
  description: string
  /** Short tech-name pills, e.g. ["XGBoost", "SHAP"]. */
  techBadges: readonly string[]
  /**
   * When true (default), shows a "查看架构详情" CTA that opens the project
   * ArchitectureModal. Set false to render a strictly informational card.
   */
  showArchitectureCta?: boolean
  className?: string
}

export function HowItWorksCard({
  icon,
  title,
  description,
  techBadges,
  showArchitectureCta = true,
  className,
}: HowItWorksCardProps) {
  const [archOpen, setArchOpen] = useState(false)

  return (
    <>
      <section
        className={cn(
          'hover-lift relative overflow-hidden rounded-xl border border-saas-border bg-white shadow-sm transition-shadow hover:shadow-md',
          className,
        )}
      >
        {/* Left vertical accent bar — gradient cyan → saas-blue. Anchors the
            card visually to the IOC palette without overwhelming the SaaS
            surface around it. */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-ioc-cyan via-ioc-cyan/70 to-saas-accent"
        />

        <div className="px-5 py-4 pl-6">
          <header className="flex items-center gap-2.5">
            {icon ? (
              <span
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-ioc-cyan/25 bg-ioc-cyan/10 text-xl"
              >
                {icon}
              </span>
            ) : null}
            <h3 className="text-base font-semibold text-saas-text-dark">
              {title}
            </h3>
          </header>

          <p className="mt-3 text-sm leading-relaxed text-saas-text-mid">
            {description}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-saas-text-light">
                <Sparkles className="h-3 w-3 text-ioc-cyan" />
                Powered by
              </span>
              {techBadges.map((b) => (
                <span
                  key={b}
                  className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 font-mono text-[11px] font-medium text-cyan-700"
                >
                  {b}
                </span>
              ))}
            </div>

            {showArchitectureCta ? (
              <button
                type="button"
                onClick={() => setArchOpen(true)}
                className="btn-press flex items-center gap-0.5 rounded-md px-2 py-1 text-xs font-medium text-saas-accent transition-colors hover:bg-saas-accent/10"
              >
                <span>查看架构详情</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {showArchitectureCta ? (
        <ArchitectureModal open={archOpen} onOpenChange={setArchOpen} />
      ) : null}
    </>
  )
}
