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

const RequestFormFields: React.FC<RequestFormFieldsProps> = ({ request, activities }) => {
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

        if (resolutionActivity) {
          return (
            <div className="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-full bg-green-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl text-white">check_circle</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-bold text-green-900">Resolution</h3>
                    <span className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-full">
                      RESOLVED
                    </span>
                  </div>
                  <div className="bg-white/80 rounded-lg p-4 mb-3 border border-green-200">
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {resolutionActivity.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-green-800">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">person</span>
                      <span>Resolved by: <span className="font-bold">{resolutionActivity.authorName}</span></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      <span>{formatDateTime(resolutionActivity.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}
    </>
  );
};

export default RequestFormFields;
