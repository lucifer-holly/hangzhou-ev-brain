import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'

// Self-hosted fonts (bundled via Vite, no CDN dependency).
// Geist covers Latin/numerics; CJK falls through to OS-bundled
// PingFang SC / Microsoft YaHei / Hiragino Sans GB. This keeps the
// CSS bundle small (~5KB instead of ~500KB if we shipped Noto SC).
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'

import { App } from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          theme="dark"
          position="bottom-right"
          richColors
          toastOptions={{
            style: {
              background: 'rgba(10,14,26,0.95)',
              border: '1px solid rgba(0,212,255,0.4)',
              color: '#fff',
              fontFamily: '"Geist Variable", "Noto Sans SC", sans-serif',
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
