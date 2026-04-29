import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Building2, ChevronDown } from 'lucide-react'

import type { Operator } from '@/api/operators'
import { cn } from '@/lib/utils'

interface OperatorPickerProps {
  operators: Operator[]
  selectedId: string
  onSelect: (id: string) => void
  className?: string
}

/**
 * Topbar dropdown that scopes the entire Operator console to a single
 * operator. Mirrors the visual weight of `RoleSwitcher` so the two pills
 * sit side-by-side comfortably.
 */
export function OperatorPicker({
  operators,
  selectedId,
  onSelect,
  className,
}: OperatorPickerProps) {
  const active = operators.find((o) => o.id === selectedId) ?? operators[0]

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
          <Building2 className="h-3.5 w-3.5" />
          {active ? (
            <>
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: active.color }}
              />
              <span className="text-ioc-text-secondary">{active.name_zh}</span>
              <span className="hidden lg:inline text-[10px] text-ioc-text-muted">
                {active.pile_count ?? 0} piles
              </span>
            </>
          ) : (
            <span className="text-ioc-text-muted">loading…</span>
          )}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-[1100] min-w-[220px] rounded-sm border border-ioc-cyan/40 bg-ioc-deep/95 p-1 shadow-ioc-glow backdrop-blur"
        >
          <div className="px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-ioc-text-muted">
            Switch Operator · 切换运营商
          </div>
          {operators.map((o) => {
            const isActive = o.id === selectedId
            return (
              <DropdownMenu.Item
                key={o.id}
                onSelect={() => onSelect(o.id)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs outline-none',
                  isActive
                    ? 'bg-ioc-cyan/15 text-ioc-cyan'
                    : 'text-ioc-text-secondary hover:bg-ioc-panel/80 hover:text-ioc-text-primary',
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: o.color }}
                />
                <span>{o.name_zh}</span>
                <span className="ml-auto text-[10px] text-ioc-text-muted">
                  {o.pile_count ?? 0} 桩
                </span>
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
