/**
 * 智枢 — System Architecture explainer modal.
 *
 * Triggered from the sidebar "Powered by" panel and from the Tech-Stack
 * ribbon on the Operator console. Shows the 3-layer architecture, the
 * 4 AI models with measured metrics, and a small perf footnote.
 *
 * Pure SVG diagram — no extra runtime cost beyond the open state.
 */

import * as Dialog from '@radix-ui/react-dialog'
import { ExternalLink, X } from 'lucide-react'

import { env } from '@/lib/env'

interface ArchitectureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ArchitectureModal({ open, onOpenChange }: ArchitectureModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1200] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[1201] w-[min(960px,92vw)] max-h-[88vh] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-md border border-ioc-cyan/40 bg-ioc-deep shadow-ioc-glow-lg data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95"
        >
          <div className="flex items-center justify-between border-b border-ioc-border/50 px-5 py-3">
            <Dialog.Title asChild>
              <h2 className="font-display text-xl font-semibold text-ioc-cyan text-glow-cyan">
                智枢 · 系统架构
                <span className="ml-3 font-mono text-xs uppercase tracking-[0.2em] text-ioc-text-muted">
                  System Architecture
                </span>
              </h2>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="btn-press rounded-sm p-1 text-ioc-text-secondary transition-colors hover:bg-ioc-panel hover:text-ioc-cyan"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-5">
            <Dialog.Description className="sr-only">
              智枢三层架构：边缘 · 云端 · 用户层 + 4 个 AI 模型
            </Dialog.Description>

            <ArchitectureDiagram />

            {/* AI models section */}
            <h3 className="mt-6 font-display text-sm font-semibold uppercase tracking-wider text-ioc-cyan">
              AI 模型 · 4 active
            </h3>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {AI_MODELS.map((m) => (
                <div
                  key={m.name}
                  className="rounded-md border border-ioc-border/40 bg-ioc-panel/40 p-3 text-xs"
                >
                  <div className="font-display text-sm font-semibold text-ioc-cyan">
                    {m.name}
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ioc-text-muted">
                    {m.framework}
                  </div>
                  <div className="mt-2 text-ioc-text-secondary">{m.usage_zh}</div>
                  <div className="mt-1 font-mono text-[11px] text-ioc-success">{m.metric}</div>
                </div>
              ))}
            </div>

            {/* Perf footnote */}
            <div className="mt-5 rounded-md border border-ioc-border/40 bg-ioc-deep/40 px-3 py-2 font-mono text-[11px] text-ioc-text-muted">
              <span className="text-ioc-cyan">PERF</span>
              <span className="mx-2 opacity-50">·</span>
              bundle 83 KB gzipped (initial)
              <span className="mx-2 opacity-50">·</span>
              LSTM ~30 ms inference
              <span className="mx-2 opacity-50">·</span>
              ESP32-S3 TFLite Micro on-device
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Dialog.Close asChild>
                <button className="btn-press rounded-sm border border-ioc-border/60 bg-ioc-panel/40 px-4 py-1.5 text-xs text-ioc-text-secondary hover:border-ioc-cyan/40 hover:text-ioc-cyan">
                  关闭 · Close
                </button>
              </Dialog.Close>
              <a
                href={env.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press hover-glow flex items-center gap-1.5 rounded-sm border border-ioc-cyan/50 bg-ioc-cyan/15 px-4 py-1.5 text-xs text-ioc-cyan hover:bg-ioc-cyan/25"
              >
                GitHub <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const AI_MODELS = [
  {
    name: 'LSTM',
    framework: 'PyTorch',
    usage_zh: '需求预测 · 100 桩 24h',
    metric: 'MAE 0.04 · 30ms',
  },
  {
    name: 'XGBoost + SHAP',
    framework: 'xgboost',
    usage_zh: '选址决策 · 可解释',
    metric: 'R² 0.94',
  },
  {
    name: 'Autoencoder',
    framework: 'PyTorch → TFLite',
    usage_zh: '异常检测 · Edge AI',
    metric: 'F1 0.96',
  },
  {
    name: 'YOLOv8',
    framework: 'Ultralytics',
    usage_zh: '占位识别 · 图像',
    metric: 'COCO pretrain',
  },
] as const

function ArchitectureDiagram() {
  return (
    <svg viewBox="0 0 920 340" className="w-full" role="img" aria-label="智枢三层架构图">
      <defs>
        <linearGradient id="layerGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0F1933" />
          <stop offset="1" stopColor="#0A0E1A" />
        </linearGradient>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#00D4FF" />
        </marker>
      </defs>

      {/* Layer columns */}
      {[
        { x: 30, label: 'EDGE · 边缘', sub: 'ESP32-S3 / Wokwi', items: ['传感器 + PID + Fuzzy', 'TFLite Micro', '异常检测自治'] },
        { x: 330, label: 'CLOUD · 云端', sub: 'FastAPI · SQLite · Mosquitto', items: ['100桩×30天合成', 'LSTM / XGBoost / AE', 'YOLOv8 按需推理', 'WebSocket 1 Hz 推送'] },
        { x: 630, label: 'USER · 用户层', sub: 'React + TS + Tailwind', items: ['City Console (IOC)', 'Operator Dashboard', 'Driver App (H5)', 'AMap + ECharts'] },
      ].map((layer, idx) => (
        <g key={idx}>
          <rect x={layer.x} y={20} width={260} height={300} rx={6} fill="url(#layerGrad)" stroke="#00D4FF" strokeOpacity="0.4" />
          <text x={layer.x + 16} y={48} fill="#00D4FF" fontFamily="'Geist Variable', sans-serif" fontSize="13" fontWeight="600" letterSpacing="0.15em">
            {layer.label}
          </text>
          <text x={layer.x + 16} y={68} fill="#A0B0CC" fontFamily="'Geist Mono Variable', monospace" fontSize="10">
            {layer.sub}
          </text>
          {layer.items.map((it, i) => (
            <g key={i}>
              <rect x={layer.x + 16} y={90 + i * 46} width={228} height={36} rx={4} fill="#141E3C" stroke="#00D4FF" strokeOpacity="0.25" />
              <text x={layer.x + 28} y={113 + i * 46} fill="#FFFFFF" fontFamily="'Geist Variable', sans-serif" fontSize="12">
                {it}
              </text>
            </g>
          ))}
        </g>
      ))}

      {/* Arrows EDGE → CLOUD → USER */}
      <line x1="290" y1="170" x2="330" y2="170" stroke="#00D4FF" strokeWidth="2" markerEnd="url(#arrow)" />
      <text x="295" y="160" fill="#00D4FF" fontSize="10" fontFamily="'Geist Mono Variable', monospace">MQTT/HTTP</text>
      <line x1="590" y1="170" x2="630" y2="170" stroke="#00D4FF" strokeWidth="2" markerEnd="url(#arrow)" />
      <text x="595" y="160" fill="#00D4FF" fontSize="10" fontFamily="'Geist Mono Variable', monospace">REST/WS</text>
    </svg>
  )
}
