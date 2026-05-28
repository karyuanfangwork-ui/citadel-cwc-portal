import React, { useState } from 'react';
import ConfirmDialog from '../ConfirmDialog';

export interface BulkAction {
  label: string;
  icon: string;
  variant?: 'default' | 'danger';
  onClick: (selectedIds: string[]) => Promise<void>;
}

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  actions: BulkAction[];
  loading?: boolean;
}

const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  actions,
  loading = false,
}) => {
  const [processing, setProcessing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<BulkAction | null>(null);

  if (selectedCount === 0) return null;

  const handleAction = async (action: BulkAction) => {
    if (action.variant === 'danger') {
      setConfirmAction(action);
      return;
    }
    await executeAction(action);
  };

  const executeAction = async (action: BulkAction, ids?: string[]) => {
    setProcessing(true);
    try {
      // The parent page must supply IDs via the action's onClick
      // We pass an empty array — the parent component wraps the onClick with actual selectedIds
      await action.onClick([]);
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmAction) return;
    setProcessing(true);
    try {
      await confirmAction.onClick([]);
    } finally {
      setProcessing(false);
      setConfirmAction(null);
    }
  };

  return (
    <>
      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.12)]" style={{ backdropFilter: 'blur(8px)' }}>
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
          {/* Left: Selection info */}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-600 text-white text-xs font-bold">
              {selectedCount}
            </span>
            <span className="text-sm text-text-secondary">
              {selectedCount} of {totalCount} selected
            </span>
            <button
              onClick={onSelectAll}
              className="text-xs text-brand-600 hover:text-brand-800 font-medium"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              Select all ({totalCount})
            </button>
            <button
              onClick={onClearSelection}
              className="text-xs text-text-secondary hover:text-text-primary font-medium"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              Clear
            </button>
          </div>

          {/* Right: Action buttons */}
          <div className="flex items-center gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                onClick={() => handleAction(action)}
                disabled={processing || loading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  action.variant === 'danger'
                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                    : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                } disabled:opacity-50`}
                style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                <span className="material-symbols-outlined text-sm">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Confirm dialog for destructive actions */}
      {confirmAction && (
        <ConfirmDialog
          open={true}
          title={`Confirm ${confirmAction.label}`}
          message={`Are you sure you want to ${confirmAction.label.toLowerCase()} ${selectedCount} item${selectedCount > 1 ? 's' : ''}? This action cannot be undone.`}
          confirmLabel={confirmAction.label}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
};

export default BulkActionBar;