import { NavLink, Outlet } from 'react-router-dom'
import { Activity, AlertTriangle, BarChart3, Coins, Github, MapPinned, ShieldCheck, Zap } from 'lucide-react'

import { Footer } from '@/components/Footer'
import { LiveClock } from '@/components/ioc/LiveClock'
import { PulseDot } from '@/components/ioc/PulseDot'
import { RoleSwitcher } from '@/components/ioc/RoleSwitcher'
import { WeatherBadge } from '@/components/ioc/WeatherBadge'
import { useWebSocket } from '@/hooks/useWebSocket'
import { env } from '@/lib/env'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: typeof Activity
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/city', label: 'Overview · 总览', icon: Activity, end: true },
  { to: '/city/heatmap', label: 'Heatmap 热力图', icon: MapPinned },
  { to: '/city/site-selection', label: 'Site Selection 选址 ⭐', icon: BarChart3 },
  { to: '/city/grid', label: 'Grid Coordination 电网协同', icon: Zap },
  { to: '/city/compliance', label: 'Compliance 合规审计', icon: ShieldCheck },
  { to: '/city/emergency', label: 'Emergency 应急响应', icon: AlertTriangle },
  { to: '/city/subsidy', label: 'Subsidy 补贴评估', icon: Coins },
]

/**
 * Outer chrome of the City Console — sidebar + topbar.
 *
 * Spawn 5 will replace the bare scaffold here with a full IOC dashboard
 * grid; the placeholder Home page already proves the design tokens work.
 */
export function CityConsoleLayout() {
  const { isConnected } = useWebSocket()

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-ioc-radial">
      {/* Topbar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-ioc-border px-5">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="智枢" className="h-7 w-7" />
          <span className="font-display text-lg font-semibold tracking-wide text-ioc-cyan text-glow-cyan">
            智枢
          </span>
          <span className="hidden md:inline font-mono text-[10px] uppercase tracking-[0.2em] text-ioc-text-muted">
            ZHISHU
          </span>
          <span className="hidden lg:inline text-xs text-ioc-text-secondary">
            杭州智慧充电城市大脑
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-ioc-text-secondary">
          <div className="flex items-center gap-2 rounded-sm border border-ioc-border/50 bg-ioc-deep/60 px-2 py-1">
            <PulseDot tone={isConnected ? 'success' : 'danger'} size="sm" />
            <span className="font-mono text-[10px]">
              {isConnected ? 'WS · LIVE' : 'WS · OFFLINE'}
            </span>
          </div>
          <WeatherBadge />
          <LiveClock tz="Asia/Shanghai" />
          <RoleSwitcher current="city" />
          <a
            href={env.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="View on GitHub"
            aria-label="GitHub repository"
            className="btn-press hover-glow flex h-8 w-8 items-center justify-center rounded-sm border border-ioc-border/50 bg-ioc-deep/60 text-ioc-text-secondary transition-colors hover:text-ioc-cyan"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="flex w-64 shrink-0 flex-col gap-1 border-r border-ioc-border bg-ioc-deep/60 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-ioc-cyan/15 text-ioc-cyan shadow-ioc-glow'
                    : 'text-ioc-text-secondary hover:bg-ioc-panel hover:text-ioc-text-primary',
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Main */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      <Footer theme="dark" />
    </div>
  )
}
