import React from 'react';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: (error: Error) => React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback?: (error: Error) => React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error);
      }
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-surface-1 text-text-primary rounded-lg border border-red-500/30">
          <h2 className="text-red-400 font-bold mb-2">Component Crashed</h2>
          <pre className="text-xs text-red-300/80 max-w-full overflow-auto p-4 bg-black/50 rounded">
            {this.state.error.message}
          </pre>
          <pre className="text-[10px] text-text-muted mt-2 max-w-full overflow-auto p-4 bg-black/50 rounded">
            {this.state.error.stack}
          </pre>
          <button 
            className="mt-4 px-4 py-2 bg-surface-3 hover:bg-surface-4 rounded text-sm transition-colors"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
