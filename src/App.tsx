import { lazy, Suspense } from 'react'
import { usePathname } from './lib/router'
import PublicProfile, { Message } from './pages/PublicProfile'

// The dashboard is code-split so public visitors never download it. (It contains no secrets
// either way — every admin API is enforced server-side by Cloudflare Access + the Worker.)
const AdminApp = lazy(() => import('./admin/AdminApp'))

export default function App() {
  const path = usePathname()

  if (path === '/admin' || path.startsWith('/admin/')) {
    return (
      <Suspense fallback={<div className="min-h-dvh" />}>
        <AdminApp />
      </Suspense>
    )
  }
  if (path === '/' || path === '/index.html') return <PublicProfile />
  return <Message title="Page not found" body="There’s nothing here." />
}
