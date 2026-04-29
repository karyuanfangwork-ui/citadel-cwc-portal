import React from 'react';

interface StepRequestTypeProps {
  requestTypes: any[];
  selectedRequestType: any;
  onSelectType: (type: any) => void;
  loading: boolean;
  error: string | null;
}

const StepRequestType: React.FC<StepRequestTypeProps> = ({
  requestTypes,
  selectedRequestType,
  onSelectType,
  loading,
  error,
}) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-700"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-cwc-lg text-sm font-medium">
        {error}
      </div>
    );
  }

  if (requestTypes.length <= 1) {
    // Single or no type — auto-selected, show a simple confirmation
    if (requestTypes.length === 1) {
      const type = requestTypes[0];
      return (
        <div className="pb-6">
          <div className={`p-5 rounded-cwc-xl border-2 border-brand-700 bg-brand-50/50`}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-cwc-md flex items-center justify-center bg-brand-700 text-white">
                <span className="material-symbols-outlined text-xl">{type.icon || 'mail'}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-text-primary mb-1">{type.name}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">{type.description}</p>
              </div>
              <span className="material-symbols-outlined text-brand-700">check_circle</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="pb-6">
      <label className="block text-sm font-bold text-text-primary mb-3">
        Select Request Type <span className="text-red-500">*</span>
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {requestTypes.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => onSelectType(type)}
            className={`p-5 rounded-cwc-xl border-2 text-left transition-all ${
              selectedRequestType?.id === type.id
                ? 'border-brand-700 bg-brand-50/50 shadow-cwc-md'
                : 'border-cwc-border hover:border-cwc-border-subtle hover:bg-surface-muted'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-cwc-md flex items-center justify-center ${
                selectedRequestType?.id === type.id
                  ? 'bg-brand-700 text-white'
                  : 'bg-surface-muted text-text-tertiary'
              }`}>
                <span className="material-symbols-outlined text-xl">{type.icon || 'mail'}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-text-primary mb-1">{type.name}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">{type.description}</p>
              </div>
              {selectedRequestType?.id === type.id && (
                <span className="material-symbols-outlined text-brand-700">check_circle</span>
              )}
            </div>
          </button>
        ))}
      </div>
      {!selectedRequestType && (
        <p className="mt-3 text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-cwc-md p-3">
          ⚠️ Please select a request type to continue
        </p>
      )}
    </div>
  );
};

export default StepRequestType;