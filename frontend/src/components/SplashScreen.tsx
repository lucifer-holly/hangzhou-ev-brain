/**
 * First-load splash screen — once per browser session.
 *
 * 1.5 s pure-CSS animation sequence:
 *   0–300ms   logo fade + scale 0.85 → 1
 *   300–600ms 智枢 (CN) fades in
 *   600–1100ms data-flow scan line sweeps across
 *   1100–1500 tagline fades in
 *   1500ms+   whole splash fades out (300ms) and unmounts
 *
 * Skipped on subsequent visits (sessionStorage flag) and clickable
 * to dismiss immediately.
 */

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'zhishu:splash-shown'
const TOTAL_MS = 1800
const FADE_OUT_MS = 300

export function SplashScreen() {
  const [show, setShow] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return sessionStorage.getItem(STORAGE_KEY) !== '1'
    } catch {
      return true
    }
  })
  const [fadingOut, setFadingOut] = useState(false)

  useEffect(() => {
    if (!show) return
    const timer = setTimeout(() => setFadingOut(true), TOTAL_MS - FADE_OUT_MS)
    const finish = setTimeout(() => {
      try {
        sessionStorage.setItem(STORAGE_KEY, '1')
      } catch {
        // sessionStorage may be unavailable in private mode — non-fatal.
      }
      setShow(false)
    }, TOTAL_MS)
    return () => {
      clearTimeout(timer)
      clearTimeout(finish)
    }
  }, [show])

  if (!show) return null

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-ioc-deep transition-opacity duration-300 ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={() => {
        try {
          sessionStorage.setItem(STORAGE_KEY, '1')
        } catch {
          /* ignore */
        }
        setShow(false)
      }}
      role="presentation"
    >
      {/* Radial halo */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,212,255,0.18)_0%,transparent_60%)]" />

      {/* Logo */}
      <div className="splash-logo">
        <img src="/logo.svg" alt="智枢" className="h-24 w-24 drop-shadow-[0_0_24px_rgba(0,212,255,0.6)]" />
      </div>

      {/* CN brand */}
      <h1 className="splash-cn font-display text-6xl font-semibold tracking-wider text-ioc-cyan">
        智枢
      </h1>

      {/* Scan line */}
      <div className="splash-scan absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-ioc-cyan to-transparent" />

      {/* Tagline */}
      <p className="splash-tag font-mono text-xs uppercase tracking-[0.4em] text-ioc-text-secondary">
        From Pile to Brain · From Charging to Governing
      </p>

      <p className="splash-tag-zh mt-1 text-[11px] tracking-widest text-ioc-text-muted">
        ZHISHU · 杭州智慧充电城市大脑
      </p>

      <p className="splash-skip absolute bottom-8 text-[10px] tracking-widest text-ioc-text-muted">
        click anywhere to skip
      </p>
    </div>
  )
}
