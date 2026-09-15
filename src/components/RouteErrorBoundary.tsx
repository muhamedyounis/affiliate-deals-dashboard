import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from './StateViews'

type RouteErrorBoundaryProps = {
  children: ReactNode
}

type RouteErrorBoundaryState = {
  error: Error | null
}

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route render failed', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-4 md:p-6">
          <ErrorState message={this.state.error.message || 'This view failed to render.'} />
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-4 min-h-10 rounded-lg border border-white/10 px-4 text-sm font-semibold text-slate-200 hover:bg-white/5"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
