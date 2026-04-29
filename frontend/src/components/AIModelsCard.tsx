/**
 * 4-up AI Models showcase card — designed for the City Console Home so a
 * portfolio visitor sees the project's AI surface area at a glance:
 * model name, framework, primary usage, and a measured metric.
 *
 * Numbers come from the project spec and are intentionally hard-coded
 * here (these are the metrics we actually trained / measured for the
 * demo). If they change, update both this file and ArchitectureModal.
 */

import { useState } from 'react'
import { Brain } from 'lucide-react'

import { ArchitectureModal } from '@/components/ArchitectureModal'
import { cn } from '@/lib/utils'

interface Model {
  name: string
  framework: string
  usage_zh: string
  usage_en: string
  metric: string
  /** Tone for the framework chip */
  tone: 'cyan' | 'success' | 'warning' | 'blue'
}

const MODELS: readonly Model[] = [
  {
    name: 'LSTM',
    framework: 'PyTorch',
    usage_zh: '需求预测',
    usage_en: 'Demand Forecast',
    metric: 'MAE 0.04',
    tone: 'cyan',
  },
  {
    name: 'XGBoost + SHAP',
    framework: 'xgboost',
    usage_zh: '选址决策',
    usage_en: 'Site Selection',
    metric: 'R² 0.94',
    tone: 'warning',
  },
  {
    name: 'Autoencoder',
    framework: 'PyTorch → TFLite',
    usage_zh: '异常检测',
    usage_en: 'Anomaly Detect',
    metric: 'F1 0.96',
    tone: 'success',
  },
  {
    name: 'YOLOv8',
    framework: 'Ultralytics',
    usage_zh: '占位识别',
    usage_en: 'Vision · COCO',
    metric: 'pretrained',
    tone: 'blue',
  },
] as const

const TONE_BORDER: Record<Model['tone'], string> = {
  cyan: 'before:bg-ioc-cyan',
  success: 'before:bg-ioc-success',
  warning: 'before:bg-ioc-warning',
  blue: 'before:bg-ioc-blue',
}

const TONE_TEXT: Record<Model['tone'], string> = {
  cyan: 'text-ioc-cyan',
  success: 'text-ioc-success',
  warning: 'text-ioc-warning',
  blue: 'text-ioc-blue',
}

export function AIModelsCard({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div
        className={cn(
          'rounded-md border border-ioc-border/50 bg-ioc-panel/40 p-3',
          className,
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-ioc-cyan" />
            <span className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-ioc-cyan">
              AI Models · 4 active
            </span>
            <span className="font-mono text-[10px] text-ioc-text-muted">
              PyTorch · xgboost · TFLite Micro · Ultralytics
            </span>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="btn-press text-[10px] uppercase tracking-wider text-ioc-text-muted transition-colors hover:text-ioc-cyan"
          >
            查看架构 →
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {MODELS.map((m) => (
            <div
              key={m.name}
              className={cn(
                'hover-lift relative overflow-hidden rounded-sm border border-ioc-border/40 bg-ioc-deep/50 px-3 py-2',
                'before:absolute before:inset-y-0 before:left-0 before:w-[3px]',
                TONE_BORDER[m.tone],
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn('font-display text-sm font-semibold', TONE_TEXT[m.tone])}>
                  {m.name}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-ioc-text-muted">
                  {m.framework}
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[11px]">
                <span className="text-ioc-text-secondary">
                  {m.usage_zh}
                  <span className="ml-1 text-[9px] uppercase tracking-wider text-ioc-text-muted">
                    {m.usage_en}
                  </span>
                </span>
                <span className={cn('font-mono text-[10px]', TONE_TEXT[m.tone])}>{m.metric}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ArchitectureModal open={open} onOpenChange={setOpen} />
    </>
  )
}
