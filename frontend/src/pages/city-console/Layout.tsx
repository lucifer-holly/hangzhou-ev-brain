import { NavLink, Outlet } from 'react-router-dom'
import { Activity, AlertTriangle, BarChart3, Coins, MapPinned, Network, ShieldCheck, Zap } from 'lucide-react'

import { LiveClock } from '@/components/ioc/LiveClock'
import { PulseDot } from '@/components/ioc/PulseDot'
import { RoleSwitcher } from '@/components/ioc/RoleSwitcher'
import { WeatherBadge } from '@/components/ioc/WeatherBadge'
import { useWebSocket } from '@/hooks/useWebSocket'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: typeof Activity
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/city', label: 'Overview · 总览', icon: Activity, end: true },
  { to: '/city/heatmap', label: '1 · Heatmap 热力图', icon: MapPinned },
  { to: '/city/site-selection', label: '2 · Site Selection 选址 ⭐', icon: BarChart3 },
  { to: '/city/grid', label: '3 · Grid Coordination 电网协同', icon: Zap },
  { to: '/city/compliance', label: '4 · Compliance 合规审计', icon: ShieldCheck },
  { to: '/city/emergency', label: '5 · Emergency 应急响应', icon: AlertTriangle },
  { to: '/city/subsidy', label: '6 · Subsidy 补贴评估', icon: Coins },
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
          <Network className="h-5 w-5 text-ioc-cyan" />
          <span className="font-title text-base font-bold uppercase tracking-[0.2em] text-ioc-cyan text-glow-cyan">
            HZ-EV Brain
          </span>
          <span className="text-xs text-ioc-text-secondary">
            杭州智慧充电城市大脑
          </span>
          <span className="ml-2 hidden lg:inline rounded-sm border border-ioc-cyan/30 bg-ioc-cyan/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ioc-cyan">
            v1 · IOC
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
    </div>
  )
}
