/**
 * Compact, abstract operator badge SVGs.
 *
 * 24×24, single-color (uses currentColor by default but each icon has a
 * brand-correct fill prop for the colored variant). Designed to be drop-in
 * replacements for plain text operator labels (e.g. KPI cards, pile lists).
 *
 * Brand-mark concepts (intentionally abstract — no real logos used):
 *   - state-grid : grid + power lozenge,    #C8102E
 *   - teld       : lightning + triangle,    #FF6900
 *   - starcharge : star + plug fang,        #4A90E2
 *   - nio        : hexagon + horizon line,  #00BFA5
 */

import type { SVGProps } from 'react'

interface IconProps extends SVGProps<SVGSVGElement> {
  /** When true, render in brand color. Default: currentColor (mono). */
  colored?: boolean
}

const SIZE = 24

export function StateGridIcon({ colored, ...props }: IconProps) {
  const fill = colored ? '#C8102E' : 'currentColor'
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="国网"
      {...props}
    >
      <rect x="2" y="2" width="20" height="20" rx="3" stroke={fill} strokeWidth="1.6" />
      <line x1="2" y1="9" x2="22" y2="9" stroke={fill} strokeWidth="1" opacity="0.6" />
      <line x1="2" y1="15" x2="22" y2="15" stroke={fill} strokeWidth="1" opacity="0.6" />
      <line x1="9" y1="2" x2="9" y2="22" stroke={fill} strokeWidth="1" opacity="0.6" />
      <line x1="15" y1="2" x2="15" y2="22" stroke={fill} strokeWidth="1" opacity="0.6" />
      <circle cx="12" cy="12" r="2.5" fill={fill} />
    </svg>
  )
}

export function TeldIcon({ colored, ...props }: IconProps) {
  const fill = colored ? '#FF6900' : 'currentColor'
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="特来电"
      {...props}
    >
      <path d="M12 2 L22 20 H2 Z" stroke={fill} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M13 7 L8 14 H11.5 L10 18 L16 11 H12.5 Z" fill={fill} />
    </svg>
  )
}

export function StarChargeIcon({ colored, ...props }: IconProps) {
  const fill = colored ? '#4A90E2' : 'currentColor'
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="星星充电"
      {...props}
    >
      <path
        d="M12 3 L14.2 9.4 L21 9.6 L15.6 13.6 L17.6 20 L12 16.2 L6.4 20 L8.4 13.6 L3 9.6 L9.8 9.4 Z"
        fill={fill}
      />
      <rect x="11" y="14" width="2" height="3" fill="#fff" opacity="0.85" />
    </svg>
  )
}

export function NioIcon({ colored, ...props }: IconProps) {
  const fill = colored ? '#00BFA5' : 'currentColor'
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="蔚来"
      {...props}
    >
      <path
        d="M12 2 L21 7 V17 L12 22 L3 17 V7 Z"
        stroke={fill}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M6 13 Q12 9, 18 13" stroke={fill} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="12" cy="13.5" r="1.4" fill={fill} />
    </svg>
  )
}

/** ID → component map for dynamic lookup by operator_id. */
export const OPERATOR_ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  state_grid: StateGridIcon,
  teld: TeldIcon,
  starcharge: StarChargeIcon,
  nio: NioIcon,
}

/** Brand color reference. */
export const OPERATOR_COLORS: Record<string, string> = {
  state_grid: '#C8102E',
  teld: '#FF6900',
  starcharge: '#4A90E2',
  nio: '#00BFA5',
}

/** Drop-in component: <OperatorIcon id="state_grid" colored /> */
export function OperatorIcon({
  id,
  ...props
}: IconProps & { id: string }) {
  const Cmp = OPERATOR_ICONS[id]
  if (!Cmp) return null
  return <Cmp {...props} />
}
