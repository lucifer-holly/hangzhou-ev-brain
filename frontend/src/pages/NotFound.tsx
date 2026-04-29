import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Home } from 'lucide-react'

import { EmptyState } from '@/components/ui/empty-state'

export function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="bg-ioc-circuit relative flex h-screen w-screen flex-col items-center justify-center bg-ioc-radial">
      <div className="flex flex-col items-center gap-2">
        {/* Big gradient 404 */}
        <h1
          className="font-display text-[8rem] font-thin leading-none tracking-tight"
          style={{
            backgroundImage:
              'linear-gradient(135deg, #00D4FF 0%, #4A9EFF 60%, #2563EB 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            textShadow: '0 0 40px rgba(0,212,255,0.25)',
          }}
        >
          404
        </h1>

        <EmptyState
          kind="not-found"
          title="页面不存在 · Page not found"
          description="看起来这个页面还没接入电网 ⚡ — 也许它正在重构中"
          className="!h-auto !py-2"
        />

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="btn-press flex items-center gap-2 rounded-md border border-ioc-border/60 bg-ioc-panel/40 px-4 py-2 text-sm text-ioc-text-secondary transition-colors hover:border-ioc-cyan/40 hover:text-ioc-cyan"
          >
            <ArrowLeft className="h-4 w-4" />
            返回上一页
          </button>
          <Link
            to="/city"
            className="btn-press hover-glow flex items-center gap-2 rounded-md border border-ioc-cyan/40 bg-ioc-cyan/15 px-4 py-2 text-sm text-ioc-cyan transition-colors hover:bg-ioc-cyan/25"
          >
            <Home className="h-4 w-4" />
            回到首页 · City Console
          </Link>
        </div>
      </div>

      <div className="absolute bottom-8 font-mono text-[10px] uppercase tracking-[0.4em] text-ioc-text-muted">
        智枢 · ZHISHU · 杭州智慧充电城市大脑
      </div>
    </div>
  )
}
