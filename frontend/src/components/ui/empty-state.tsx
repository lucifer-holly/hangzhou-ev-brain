/**
 * Reusable empty-state component.
 *
 * Used for empty pile lists, empty event streams, empty reservations,
 * pre-search states, and the 404 page. Each scenario gets a distinct
 * inline SVG illustration so the empty state communicates intent
 * (waiting / nothing yet / error) rather than just blanking out.
 */

import { cn } from '@/lib/utils'

type EmptyKind =
  | 'no-piles'
  | 'no-events'
  | 'no-reservations'
  | 'no-candidates'
  | 'disconnected'
  | 'not-found'

interface EmptyStateProps {
  kind: EmptyKind
  title?: string
  description?: string
  /** Optional CTA element (button, link). */
  action?: React.ReactNode
  className?: string
  /** Use IOC dark palette (default) or SaaS light palette. */
  theme?: 'dark' | 'light'
}

const ILLUSTRATIONS: Record<EmptyKind, () => JSX.Element> = {
  'no-piles': () => (
    <svg viewBox="0 0 120 120" fill="none" className="h-24 w-24" aria-hidden>
      <circle cx="60" cy="60" r="48" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />
      <rect x="42" y="38" width="36" height="48" rx="3" stroke="currentColor" strokeWidth="2" />
      <rect x="48" y="46" width="24" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <line x1="50" y1="68" x2="70" y2="68" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <line x1="50" y1="74" x2="65" y2="74" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <path d="M58 32 V26 M62 32 V26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  'no-events': () => (
    <svg viewBox="0 0 120 120" fill="none" className="h-24 w-24" aria-hidden>
      <circle cx="60" cy="60" r="48" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />
      <line x1="36" y1="50" x2="84" y2="50" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <line x1="36" y1="62" x2="76" y2="62" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <line x1="36" y1="74" x2="80" y2="74" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="60" cy="42" r="3" fill="currentColor" opacity="0.6">
        <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.6s" repeatCount="indefinite" />
      </circle>
    </svg>
  ),
  'no-reservations': () => (
    <svg viewBox="0 0 120 120" fill="none" className="h-24 w-24" aria-hidden>
      <rect x="32" y="36" width="56" height="48" rx="4" stroke="currentColor" strokeWidth="2" />
      <line x1="32" y1="48" x2="88" y2="48" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="44" cy="42" r="2" fill="currentColor" />
      <circle cx="76" cy="42" r="2" fill="currentColor" />
      <text x="60" y="74" textAnchor="middle" fill="currentColor" fontSize="20" fontFamily="monospace" opacity="0.55">∅</text>
    </svg>
  ),
  'no-candidates': () => (
    <svg viewBox="0 0 120 120" fill="none" className="h-24 w-24" aria-hidden>
      <circle cx="56" cy="56" r="22" stroke="currentColor" strokeWidth="2" />
      <line x1="74" y1="74" x2="92" y2="92" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <text x="56" y="62" textAnchor="middle" fill="currentColor" fontSize="20" fontWeight="700" opacity="0.55">?</text>
    </svg>
  ),
  disconnected: () => (
    <svg viewBox="0 0 120 120" fill="none" className="h-24 w-24" aria-hidden>
      <path d="M30 60 Q60 36 90 60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <path d="M40 70 Q60 54 80 70" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <path d="M50 80 Q60 72 70 80" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="32" y1="32" x2="88" y2="88" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="60" cy="92" r="3" fill="currentColor" />
    </svg>
  ),
  'not-found': () => (
    <svg viewBox="0 0 120 120" fill="none" className="h-28 w-28" aria-hidden>
      <circle cx="60" cy="60" r="48" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <path d="M40 36 L80 84 M80 36 L40 84" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
    </svg>
  ),
}

const DEFAULT_TITLES: Record<EmptyKind, string> = {
  'no-piles': '暂无桩点',
  'no-events': '暂无事件',
  'no-reservations': '还没有预约',
  'no-candidates': '点击地图选择候选位置',
  disconnected: '实时连接断开',
  'not-found': '页面不存在',
}

const DEFAULT_DESC: Record<EmptyKind, string> = {
  'no-piles': '该筛选条件下没有桩点 · 试试调整运营商或区域',
  'no-events': '一切平静 · 当前没有需要关注的事件',
  'no-reservations': '在地图或列表上找一个桩，开始预约充电',
  'no-candidates': 'XGBoost 模型已就绪，等待你点击候选格子',
  disconnected: '正在重连…如果持续无响应请检查后端服务',
  'not-found': '看起来这个页面还没接入电网 ⚡',
}

export function EmptyState({
  kind,
  title,
  description,
  action,
  className,
  theme = 'dark',
}: EmptyStateProps) {
  const Illustration = ILLUSTRATIONS[kind]
  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center gap-3 px-6 py-10 text-center',
        theme === 'dark' ? 'text-ioc-text-muted' : 'text-saas-text-light',
        className,
      )}
    >
      <div
        className={cn(
          theme === 'dark' ? 'text-ioc-cyan/55' : 'text-saas-accent/55',
        )}
      >
        <Illustration />
      </div>
      <div
        className={cn(
          'font-display text-base font-medium',
          theme === 'dark' ? 'text-ioc-text-secondary' : 'text-saas-text-mid',
        )}
      >
        {title ?? DEFAULT_TITLES[kind]}
      </div>
      <div className="max-w-sm text-xs">{description ?? DEFAULT_DESC[kind]}</div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
