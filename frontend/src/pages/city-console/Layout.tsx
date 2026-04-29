import { NavLink, Outlet } from 'react-router-dom'
import { Activity, AlertTriangle, BarChart3, Coins, Github, MapPinned, ShieldCheck, Zap } from 'lucide-react'

import { Footer } from '@/components/Footer'
import { LiveClock } from '@/components/ioc/LiveClock'
import { RoleSwitcher } from '@/components/ioc/RoleSwitcher'
import { WeatherBadge } from '@/components/ioc/WeatherBadge'
import { StatusBadges } from '@/components/StatusBadges'
import { SystemStatusPanel } from '@/components/sidebar/SystemStatusPanel'
import { TodayPanel } from '@/components/sidebar/TodayPanel'
import { TechStackPanel } from '@/components/sidebar/TechStackPanel'
import { env } from '@/lib/env'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: typeof Activity
  end?: boolean
}

// Unified label format: "<English> · <中文>" — matches the topbar brand
// rhythm and stops the sidebar reading like a numbered course outline.
const NAV_ITEMS: NavItem[] = [
  { to: '/city', label: 'Overview · 总览', icon: Activity, end: true },
  { to: '/city/heatmap', label: 'Heatmap · 热力图', icon: MapPinned },
  { to: '/city/site-selection', label: 'Site Selection · 选址 ⭐', icon: BarChart3 },
  { to: '/city/grid', label: 'Grid Coordination · 电网协同', icon: Zap },
  { to: '/city/compliance', label: 'Compliance · 合规审计', icon: ShieldCheck },
  { to: '/city/emergency', label: 'Emergency · 应急响应', icon: AlertTriangle },
  { to: '/city/subsidy', label: 'Subsidy · 补贴评估', icon: Coins },
]

export function CityConsoleLayout() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-ioc-radial">
      {/* Topbar */}
      <header className="flex h-20 shrink-0 items-center justify-between border-b border-ioc-border px-5">
        {/* Brand block — Spawn 9.6/B amplified. */}
        <div className="flex items-center gap-3">
          <img
            src="/logo.svg"
            alt="智枢"
            className="h-10 w-10 drop-shadow-[0_0_12px_rgba(0,212,255,0.45)]"
          />
          <div className="flex flex-col leading-tight">
            <div className="flex items-baseline gap-2">
              <span
                className="font-display text-3xl font-extrabold tracking-wide text-ioc-cyan"
                style={{ textShadow: '0 0 14px rgba(0,212,255,0.55)' }}
              >
                智枢
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-ioc-text-muted">
                ZHISHU
              </span>
            </div>
            <span className="text-[11px] tracking-wide text-ioc-text-secondary">
              杭州智慧充电城市大脑 · Hangzhou EV Charging Brain
            </span>
          </div>
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-3 text-xs text-ioc-text-secondary">
          <StatusBadges variant="compact" />
          <WeatherBadge />
          <LiveClock tz="Asia/Shanghai" />
          <RoleSwitcher current="city" />
          <a
            href={env.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="View on GitHub"
            aria-label="GitHub repository"
            className="btn-press hover-glow flex items-center gap-1.5 rounded-md border border-ioc-cyan/40 bg-ioc-cyan/10 px-3 py-1.5 text-xs font-medium text-ioc-cyan transition-colors hover:bg-ioc-cyan/20"
          >
            <Github className="h-4 w-4" />
            <span>GitHub</span>
            <span aria-hidden className="text-[10px] opacity-70">↗</span>
          </a>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="flex w-64 shrink-0 flex-col border-r border-ioc-border bg-ioc-deep/60 px-3 py-4">
          {/* Nav links */}
          <div className="flex flex-col gap-1">
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
          </div>

          {/* Bottom panels — fill the empty space below the nav. */}
          <div className="mt-auto flex flex-col gap-2 pt-4">
            <SystemStatusPanel />
            <TodayPanel />
            <TechStackPanel />
          </div>
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
