import React from 'react';

interface ErrorFallbackProps {
    error: Error;
    resetError: () => void;
    title?: string;
    showDetails?: boolean;
}

/**
 * Default Error Fallback Component
 * Used by ErrorBoundary when no custom fallback is provided.
 * Can also be used as a custom fallback for consistent error UI.
 */
export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
    error,
    resetError,
    title = 'Something went wrong',
    showDetails = false,
}) => {
    return (
        <div className="min-h-[400px] flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200 p-8">
            <div className="max-w-md w-full text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
                    <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h3 className="mt-4 text-xl font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm text-gray-600">
                    {error.message || 'An unexpected error occurred. Please try again.'}
                </p>
                <div className="mt-6 flex justify-center gap-3">
                    <button
                        onClick={resetError}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#0052cc] hover:bg-[#0047b3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0052cc]"
                    >
                        Try Again
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0052cc]"
                    >
                        Refresh Page
                    </button>
                </div>
                {showDetails && (
                    <details className="mt-6 text-left">
                        <summary className="text-xs text-gray-400 cursor-pointer">Error Details</summary>
                        <pre className="mt-2 text-xs text-red-600 bg-red-50 p-3 rounded overflow-auto max-h-64 font-mono">
                            {error.toString()}
                            {error.stack && `\n\nStack Trace:\n${error.stack}`}
                        </pre>
                    </details>
                )}
            </div>
        </div>
    );
};

/**
 * Inline Error Fallback - Compact version for embedding in cards/panels
 */
export const InlineErrorFallback: React.FC<ErrorFallbackProps> = ({
    error,
    resetError,
}) => {
    return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
                <svg className="h-5 w-5 text-red-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="ml-3 flex-1">
                    <h4 className="text-sm font-medium text-red-800">Error loading content</h4>
                    <p className="mt-1 text-xs text-red-600">{error.message || 'Failed to load'}</p>
                    <button
                        onClick={resetError}
                        className="mt-2 text-xs font-medium text-red-700 hover:text-red-600 underline"
                    >
                        Retry
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ErrorFallback;
