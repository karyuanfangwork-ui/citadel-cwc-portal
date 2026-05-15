import React from 'react';
import CustomFieldsPanel from '@/src/components/request-detail/CustomFieldsPanel';

interface Activity {
  id: string;
  activityType: string;
  message: string;
  authorName: string;
  authorRole: string | null;
  isSystemGenerated: boolean;
  isInternal: boolean;
  createdAt: string;
}

interface RequestFormFieldsProps {
  request: {
    id?: string;
    summary: string;
    description?: string | null;
    status: string;
    updatedAt: string;
    customFields?: Record<string, any>;
    serviceDesk?: { code: string };
    requestType?: { formConfig?: any[] };
    itHardwareRequest?: { serialNumber?: string | null; assetTag?: string | null } | null;
  };
  activities: Activity[];
  canEditCustomFields?: boolean;
  onCustomFieldsSaved?: (updatedCustomFields: Record<string, any>) => void;
}

const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const RequestFormFields: React.FC<RequestFormFieldsProps> = ({
  request,
  activities,
  canEditCustomFields = false,
  onCustomFieldsSaved,
}) => {
  return (
    <>
      {/* Request Summary */}
      <section>
        <div className="mb-6">
          <span className="text-xs font-bold text-[#44546f] uppercase tracking-widest">
            Case Summary
          </span>
          <h1 className="text-3xl font-bold text-[#101418] mt-1">{request.summary}</h1>
        </div>
        <div className="bg-[#f4f5f7] p-8 rounded-xl border border-gray-100">
          <span className="text-xs font-bold text-[#44546f] uppercase tracking-widest block mb-4">
            Description
          </span>
          <p className="text-[#44546f] leading-relaxed text-lg">
            {request.description || 'No detailed description provided.'}
          </p>
        </div>

        {/* Structured Custom Fields */}
        <CustomFieldsPanel
          customFields={{
            ...request.customFields,
            ...(request.itHardwareRequest?.assetTag ? { assetTag: request.itHardwareRequest.assetTag } : {}),
            ...(request.itHardwareRequest?.serialNumber ? { serialNumber: request.itHardwareRequest.serialNumber } : {}),
          }}
          serviceDeskCode={request.serviceDesk?.code || ''}
          formConfig={request.requestType?.formConfig}
          requestId={request.id}
          canEdit={canEditCustomFields}
          onFieldSaved={onCustomFieldsSaved}
        />
      </section>

      {/* Resolution Summary - Only show for RESOLVED/COMPLETED tickets */}
      {(request.status === 'RESOLVED' || request.status === 'COMPLETED') && (() => {
        // Find the most recent non-system comment before the status was changed to RESOLVED
        const resolutionActivity = activities
          .filter(a => !a.isSystemGenerated && a.activityType === 'COMMENT')
          .reverse()
          .find(a => {
            const activityDate = new Date(a.createdAt);
            const resolvedDate = request.updatedAt ? new Date(request.updatedAt) : new Date();
            return activityDate <= resolvedDate;
          });

        if (!resolutionActivity) return null;

        return (
          <section>
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-6">
              <span className="material-symbols-outlined text-[#16a34a]">task_alt</span>
              <h3 className="font-bold text-xl">Resolution</h3>
            </div>
            <div className="bg-green-50 p-6 rounded-xl border border-green-100">
              <p className="text-[#101418] leading-relaxed">{resolutionActivity.message}</p>
              <p className="text-xs text-[#8993a4] mt-3">
                Resolved by {resolutionActivity.authorName} &middot; {formatDateTime(resolutionActivity.createdAt)}
              </p>
            </div>
          </section>
        );
      })()}
    </>
  );
};

export default RequestFormFields;