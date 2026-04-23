import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the component tree and displays a fallback UI.
 * 
 * Usage:
 * <ErrorBoundary fallback={CustomFallback}>
 *   <YourComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error to console (in production, send to monitoring service)
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
        
        // Call custom error handler if provided
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }

        // In production, you might want to send to an error tracking service:
        // if (process.env.NODE_ENV === 'production') {
        //     sendToMonitoringService(error, errorInfo);
        // }
    }

    resetError = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        const { hasError, error } = this.state;
        const { children, fallback: Fallback } = this.props;

        if (hasError && error) {
            if (Fallback) {
                return <Fallback error={error} resetError={this.resetError} />;
            }

            // Default fallback UI
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                    <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="mt-4 text-lg font-medium text-gray-900">Something went wrong</h3>
                            <p className="mt-2 text-sm text-gray-500">
                                {error.message || 'An unexpected error occurred. Please try again.'}
                            </p>
                            <div className="mt-6">
                                <button
                                    onClick={this.resetError}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#0052cc] hover:bg-[#0047b3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0052cc]"
                                >
                                    Try Again
                                </button>
                            </div>
                            {process.env.NODE_ENV === 'development' && (
                                <details className="mt-4 text-left">
                                    <summary className="text-xs text-gray-400 cursor-pointer">Error Details (Development)</summary>
                                    <pre className="mt-2 text-xs text-red-600 bg-red-50 p-3 rounded overflow-auto max-h-48">
                                        {error.toString()}
                                        {error.stack && `\n\nStack:\n${error.stack}`}
                                    </pre>
                                </details>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        return children;
    }
}

export default ErrorBoundary;
