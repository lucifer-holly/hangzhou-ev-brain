import type { Config } from 'tailwindcss'
import animatePlugin from 'tailwindcss-animate'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      colors: {
        ioc: {
          deep: '#0A0E1A',
          panel: 'rgba(20,30,60,0.7)',
          'panel-solid': '#141E3C',
          border: 'rgba(0,212,255,0.3)',
          cyan: '#00D4FF',
          blue: '#4A9EFF',
          warning: '#FFB800',
          danger: '#FF6B35',
          success: '#00FF94',
          'text-primary': '#FFFFFF',
          'text-secondary': '#A0B0CC',
          'text-muted': '#5A6680',
        },
        saas: {
          bg: '#FFFFFF',
          'bg-alt': '#F8FAFC',
          border: '#E2E8F0',
          accent: '#2563EB',
          'text-dark': '#0F172A',
          'text-mid': '#475569',
          'text-light': '#94A3B8',
        },
      },
      fontFamily: {
        // Geist + Noto Sans SC harmonize EN/ZH at the same x-height.
        display: [
          '"Geist Variable"',
          '"Noto Sans SC"',
          'PingFang SC',
          'Hiragino Sans GB',
          'system-ui',
          'sans-serif',
        ],
        body: [
          '"Geist Variable"',
          '"Noto Sans SC"',
          'PingFang SC',
          'Hiragino Sans GB',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          '"Geist Mono Variable"',
          'JetBrains Mono',
          'ui-monospace',
          'monospace',
        ],
        // Back-compat alias for legacy `font-title` usages.
        title: [
          '"Geist Variable"',
          '"Noto Sans SC"',
          'PingFang SC',
          'system-ui',
          'sans-serif',
        ],
      },
      backgroundImage: {
        'ioc-radial':
          'radial-gradient(circle at 20% 30%, #1A2238 0%, #0A0E1A 70%)',
      },
      boxShadow: {
        'ioc-glow': '0 0 16px rgba(0,212,255,0.45)',
        'ioc-glow-lg': '0 0 32px rgba(0,212,255,0.6)',
        'ioc-warning': '0 0 16px rgba(255,184,0,0.45)',
        'ioc-danger': '0 0 16px rgba(255,107,53,0.45)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        marquee: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-50%)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.6s cubic-bezier(0.215,0.61,0.355,1) infinite',
        'scan-line': 'scan-line 6s linear infinite',
        marquee: 'marquee 30s linear infinite',
        flicker: 'flicker 2s ease-in-out infinite',
      },
    },
  },
  plugins: [animatePlugin],
}

export default config
