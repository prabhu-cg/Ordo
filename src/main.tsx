import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { AppErrorBoundary } from '@/features/error-page'
import { startAnalytics } from '@/lib/analytics'
import './index.css'

startAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
