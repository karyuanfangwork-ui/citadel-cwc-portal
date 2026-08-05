import React from 'react';

// ── Phase 6: Section-level error boundary ──────────────────────────────────
// Catches render errors from tab components and shows a retry button
// instead of crashing the entire PersonalFastView.

interface SectionErrorBoundaryProps {
  children: React.ReactNode;
  sectionTitle: string;
  onRetry?: () => void;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class SectionErrorBoundary extends React.Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): SectionErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[PersonalFast] Section "${this.props.sectionTitle}" render error:`, error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
          <span className="material-symbols-outlined text-3xl text-red-400 mb-2">error_outline</span>
          <h4 className="text-sm font-bold text-text-primary mb-1">
            {this.props.sectionTitle} failed to load
          </h4>
          <p className="text-xs text-text-secondary max-w-xs mb-3">
            {this.state.error?.message || 'An unexpected error occurred while rendering this section.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-cwc-md transition-colors"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Section loading skeleton ───────────────────────────────────────────────
export const SectionLoadingSkeleton: React.FC<{ lines?: number }> = ({ lines = 4 }) => (
  <div className="py-2" aria-busy="true">
    {[...Array(lines)].map((_, i) => (
      <div
        key={i}
        className="mb-3 rounded-cwc-md"
        style={{
          height: i === lines - 1 ? 20 : 16,
          width: `${i === lines - 1 ? 60 : 100}%`,
          background: 'var(--bg-subtle, #f3f4f6)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
    ))}
  </div>
);

// ── Section empty state ───────────────────────────────────────────────────
interface SectionEmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
}

export const SectionEmptyState: React.FC<SectionEmptyStateProps> = ({
  icon = 'info',
  title,
  description,
}) => (
  <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
    <span className="material-symbols-outlined text-3xl text-text-secondary opacity-20 mb-2">{icon}</span>
    <h4 className="text-sm font-bold text-text-primary mb-0.5">{title}</h4>
    {description && <p className="text-xs text-text-secondary max-w-xs">{description}</p>}
  </div>
);