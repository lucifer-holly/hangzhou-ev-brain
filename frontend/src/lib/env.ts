/**
 * Typed Vite environment variables.
 *
 * Vite only injects vars prefixed with `VITE_`. We re-export them through
 * helpers so consumers don't need to deal with the `import.meta.env` shape.
 *
 * Defaults match the docker-compose dev setup so a fresh checkout works.
 */

export interface AppEnv {
  apiBaseUrl: string
  wsUrl: string
  mapProvider: 'amap' | 'osm'
  amapKey: string
  amapSecurity: string
  githubUrl: string
}

function readMapProvider(value: string | undefined): 'amap' | 'osm' {
  if (value === 'amap' || value === 'osm') return value
  return 'osm'
}

export const env: AppEnv = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  wsUrl: import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000/ws',
  mapProvider: readMapProvider(import.meta.env.VITE_MAP_PROVIDER),
  amapKey: import.meta.env.VITE_AMAP_KEY ?? '',
  amapSecurity: import.meta.env.VITE_AMAP_SECURITY_KEY ?? '',
  githubUrl:
    import.meta.env.VITE_GITHUB_URL ??
    'https://github.com/your-username/hz-ev-brain',
}
