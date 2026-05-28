"use client";

import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-950 min-h-[400px]">
          <div className="bg-red-500/10 text-red-500 rounded-full p-4 mb-4">
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold font-display text-text-primary">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-text-secondary max-w-md leading-normal">
            An unexpected error occurred in this view. Please try refreshing the page or contact support if the issue persists.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 bg-slate-800 hover:bg-slate-700 text-text-primary px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors focus:outline-none"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
