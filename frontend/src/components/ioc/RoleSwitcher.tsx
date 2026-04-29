import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Building2, Car, ChevronDown, ShieldCheck, UserCog } from 'lucide-react'
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
  { id: 'city', label_zh: '城市端', label_en: 'City Console', href: '/city', Icon: ShieldCheck },
  { id: 'operator', label_zh: '运营商端', label_en: 'Operator', href: '/operator', Icon: Building2 },
  { id: 'driver', label_zh: '车主端', label_en: 'Driver', href: '/driver', Icon: Car },
]

interface RoleSwitcherProps {
  current?: Role['id']
  className?: string
}

export function RoleSwitcher({ current = 'city', className }: RoleSwitcherProps) {
  const navigate = useNavigate()
  const active = ROLES.find((r) => r.id === current) ?? ROLES[0]

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 rounded-sm border border-ioc-cyan/40 bg-ioc-deep/70 px-2.5 py-1 text-xs text-ioc-cyan transition-colors',
            'hover:border-ioc-cyan/70 hover:bg-ioc-cyan/10 focus:outline-none focus:ring-1 focus:ring-ioc-cyan/60',
            className,
          )}
        >
          <UserCog className="h-3.5 w-3.5" />
          <span className="text-ioc-text-secondary">{active.label_zh}</span>
          <span className="hidden lg:inline text-[10px] text-ioc-text-muted">{active.label_en}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-[1100] min-w-[180px] rounded-sm border border-ioc-cyan/40 bg-ioc-deep/95 p-1 shadow-ioc-glow backdrop-blur"
        >
          <div className="px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-ioc-text-muted">
            Switch Console · 切换端
          </div>
          {ROLES.map((r) => {
            const isActive = r.id === current
            return (
              <DropdownMenu.Item
                key={r.id}
                onSelect={() => navigate(r.href)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs outline-none',
                  isActive
                    ? 'bg-ioc-cyan/15 text-ioc-cyan'
                    : 'text-ioc-text-secondary hover:bg-ioc-panel/80 hover:text-ioc-text-primary',
                )}
              >
                <r.Icon className="h-3.5 w-3.5" />
                <span>{r.label_zh}</span>
                <span className="ml-auto text-[10px] text-ioc-text-muted">
                  {r.label_en}
                </span>
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
