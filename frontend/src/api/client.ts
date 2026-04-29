/** Re-export of the shared axios instance — kept here so feature folders
 * can `import { apiClient } from '@/api/client'` without crossing into the
 * generic `lib/` namespace. */
export { apiClient } from '@/lib/api'
