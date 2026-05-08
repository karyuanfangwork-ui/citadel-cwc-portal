import React, { ComponentType, ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { ErrorFallback } from './ErrorFallback';

interface ErrorBoundaryOptions {
    fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    displayName?: string;
}

/**
 * Higher-Order Component that wraps a component with ErrorBoundary
 * 
 * Usage:
 * const ProtectedComponent = withErrorBoundary(MyComponent, {
 *   fallback: CustomFallback,
 *   onError: (error, info) => console.error(error)
 * });
 */
export function withErrorBoundary<P extends object>(
    WrappedComponent: ComponentType<P>,
    options: ErrorBoundaryOptions = {}
): ComponentType<P> {
    const { fallback: Fallback, onError, displayName } = options;

    const componentName = displayName || WrappedComponent.displayName || WrappedComponent.name || 'Component';

    class ErrorBoundaryWrapper extends React.Component<P> {
        static displayName = `withErrorBoundary(${componentName})`;

        render() {
            return (
                <ErrorBoundary
                    fallback={Fallback || ErrorFallback}
                    onError={onError}
                >
                    <WrappedComponent {...this.props} />
                </ErrorBoundary>
            );
        }
    }

    return ErrorBoundaryWrapper;
}

/**
 * Hook-based error boundary wrapper for functional components
 * Returns a component wrapped with ErrorBoundary
 * 
 * Usage:
 * const MyComponent = () => { ... };
 * export default createErrorBoundary(MyComponent);
 */
export function createErrorBoundary<P extends object>(
    component: ComponentType<P>,
    options: ErrorBoundaryOptions = {}
): ComponentType<P> {
    return withErrorBoundary(component, options);
}

export default withErrorBoundary;
