import type {
  AdminIdentity,
  AnalyticsSummary,
  ApiError,
  Link,
  LinkInput,
  Profile,
  ProfileInput,
  PublicPageData,
} from '../../shared/types'
import type { ImageKind } from '../../shared/validation'

export class ApiRequestError extends Error {
  status: number
  fields?: Record<string, string>
  constructor(status: number, body: Partial<ApiError>) {
    super(body.error || `Request failed (${status})`)
    this.status = status
    this.fields = body.fields
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && typeof init.body === 'string') headers.set('Content-Type', 'application/json')
  headers.set('Accept', 'application/json')
  const res = await fetch(path, { ...init, headers, credentials: 'same-origin' })
  if (res.status === 204) return undefined as T
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    /* non-JSON error page, e.g. an Access login redirect */
  }
  if (!res.ok) throw new ApiRequestError(res.status, (body as ApiError) ?? {})
  return body as T
}

const json = (data: unknown) => JSON.stringify(data)

export const publicApi = {
  page: () => request<PublicPageData>('/api/profile'),
  /** Fire-and-forget profile view beacon. */
  trackView() {
    try {
      const body = new Blob([json({ referrer: document.referrer || '' })], { type: 'application/json' })
      if (navigator.sendBeacon?.('/api/track/view', body)) return
    } catch {
      /* fall through */
    }
    fetch('/api/track/view', { method: 'POST', body: json({ referrer: document.referrer || '' }), keepalive: true }).catch(
      () => {},
    )
  },
}

export const adminApi = {
  me: () => request<AdminIdentity>('/api/admin/me'),
  getProfile: () => request<Profile>('/api/admin/profile'),
  saveProfile: (input: ProfileInput) => request<Profile>('/api/admin/profile', { method: 'PUT', body: json(input) }),
  uploadImage: (kind: ImageKind, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<Profile>(`/api/admin/images/${kind}`, { method: 'POST', body: form })
  },
  removeImage: (kind: ImageKind) => request<Profile>(`/api/admin/images/${kind}`, { method: 'DELETE' }),
  listLinks: () => request<Link[]>('/api/admin/links'),
  createLink: (input: LinkInput) => request<Link>('/api/admin/links', { method: 'POST', body: json(input) }),
  updateLink: (id: number, input: Partial<LinkInput>) =>
    request<Link>(`/api/admin/links/${id}`, { method: 'PATCH', body: json(input) }),
  deleteLink: (id: number) => request<void>(`/api/admin/links/${id}`, { method: 'DELETE' }),
  reorderLinks: (ids: number[]) => request<Link[]>('/api/admin/links/order', { method: 'PUT', body: json({ ids }) }),
  analytics: (days: number) => request<AnalyticsSummary>(`/api/admin/analytics?days=${days}`),
}
