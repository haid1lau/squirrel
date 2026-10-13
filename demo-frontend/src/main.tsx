import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ToastProvider } from './components/ToastProvider.tsx'
import { DemoBanner } from './demo/DemoBanner.tsx'
import { Root } from './Root.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <Root />
        <DemoBanner />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
)
