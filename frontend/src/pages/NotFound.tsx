import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-ioc-radial">
      <h1 className="font-title text-5xl uppercase tracking-[0.3em] text-ioc-cyan text-glow-cyan">
        404
      </h1>
      <p className="text-sm text-ioc-text-secondary">Route not found · 路径不存在</p>
      <Link
        to="/city"
        className="rounded-md border border-ioc-cyan/40 bg-ioc-cyan/15 px-4 py-2 text-sm text-ioc-cyan hover:bg-ioc-cyan/25"
      >
        Back to City Console
      </Link>
    </div>
  )
}
