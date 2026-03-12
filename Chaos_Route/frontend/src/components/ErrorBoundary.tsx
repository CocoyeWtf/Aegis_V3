/* Error Boundary pour chunks lazy — evite ecran blanc / Catches lazy chunk load failures */

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  handleRetry = () => {
    this.setState({ hasError: false })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Erreur de chargement de la page.
          </p>
          <div className="flex gap-2">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Réessayer
            </button>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg text-sm font-medium border"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            >
              Recharger la page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
