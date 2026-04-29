import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Building2, Car, ChevronDown, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { cn } from '@/lib/utils'

interface Role {
  id: 'city' | 'operator' | 'driver'
  label_zh: string
  label_en: string
  href: string
  Icon: typeof ShieldCheck
}

const ROLES: Role[] = [
  { id: 'city', label_zh: '城市端', label_en: 'City', href: '/city', Icon: ShieldCheck },
  { id: 'operator', label_zh: '运营商', label_en: 'Operator', href: '/operator', Icon: Building2 },
  { id: 'driver', label_zh: '车主端', label_en: 'Driver', href: '/driver', Icon: Car },
]

interface RoleSwitcherProps {
  current?: Role['id']
  className?: string
}

/**
 * Role switcher — Spawn 9.6/C upgraded.
 *
 * The trigger now leads with the active role's tinted icon (so the user
 * sees what console they're in even before reading the text), shows
 * both 中文 and English labels, has a hover-glow CTA treatment, and
 * stacks each dropdown item with a visible icon + bilingual label.
 */
export function RoleSwitcher({ current = 'city', className }: RoleSwitcherProps) {
  const navigate = useNavigate()
  const active = ROLES.find((r) => r.id === current) ?? ROLES[0]

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            'btn-press hover-glow flex items-center gap-2 rounded-md border border-ioc-cyan/40 bg-ioc-cyan/10 px-3 py-1.5 text-xs text-ioc-cyan transition-colors',
            'hover:border-ioc-cyan/70 hover:bg-ioc-cyan/20 focus:outline-none focus:ring-1 focus:ring-ioc-cyan/60',
            className,
          )}
        >
          <active.Icon className="h-4 w-4" />
          <div className="flex items-baseline gap-1.5 leading-tight">
            <span className="font-medium">{active.label_zh}</span>
            <span className="hidden lg:inline font-mono text-[10px] uppercase tracking-wider opacity-70">
              {active.label_en}
            </span>
          </div>
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-[1100] min-w-[220px] rounded-md border border-ioc-cyan/40 bg-ioc-deep/95 p-1.5 shadow-ioc-glow backdrop-blur"
        >
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.22em] text-ioc-text-muted">
            Switch Console · 切换端
          </div>
          {ROLES.map((r) => {
            const isActive = r.id === current
            return (
              <DropdownMenu.Item
                key={r.id}
                onSelect={() => navigate(r.href)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded px-2 py-2 text-xs outline-none transition-colors',
                  isActive
                    ? 'bg-ioc-cyan/15 text-ioc-cyan'
                    : 'text-ioc-text-secondary hover:bg-ioc-panel/80 hover:text-ioc-text-primary',
                )}
              >
                <r.Icon className="h-4 w-4 shrink-0" />
                <div className="flex flex-1 items-baseline gap-1.5">
                  <span className="font-medium">{r.label_zh}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider opacity-65">
                    {r.label_en}
                  </span>
                </div>
                {isActive ? (
                  <span className="text-[9px] uppercase tracking-wider text-ioc-cyan/80">
                    当前
                  </span>
                ) : null}
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
