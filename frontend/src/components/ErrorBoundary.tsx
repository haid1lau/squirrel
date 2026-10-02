import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Keeps a rendering bug from blanking the whole page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Squirrel crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-content-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">Something broke on this page</h1>
        <p className="text-ink-muted">Your benefits are safe on the server. Reloading usually fixes this.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mx-auto min-h-11 cursor-pointer rounded-xl bg-cta px-5 font-semibold text-white transition-colors duration-150 hover:bg-cta-hover"
        >
          Reload the page
        </button>
      </main>
    )
  }
}
