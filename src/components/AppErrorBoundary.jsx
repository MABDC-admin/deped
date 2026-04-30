import { Component } from 'react'
import { RefreshCw } from 'lucide-react'

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  handleReload = () => {
    sessionStorage.removeItem('sms:chunk-reload')
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">App needs a refresh</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            The page loaded an outdated or failed app file. Refreshing will load the latest version.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh app
          </button>
        </div>
      </div>
    )
  }
}
