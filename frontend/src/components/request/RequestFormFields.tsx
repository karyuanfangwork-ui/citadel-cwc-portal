import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { stripHtml } from '@/src/utils/format';
import CustomFieldsPanel from '@/src/components/request-detail/CustomFieldsPanel';
import AssignAgentModal from '@/src/components/request-detail/AssignAgentModal';

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
    createdAt: string;
    updatedAt: string;
    completedAt?: string | null;
    resolvedAt?: string | null;
    customFields?: Record<string, any>;
    serviceDesk?: { code: string; name?: string };
    requestType?: { code?: string; name?: string; formConfig?: any };
    itHardwareRequest?: { serialNumber?: string | null; assetTag?: string | null } | null;
    requester?: { id: string; firstName: string; lastName: string; email: string } | null;
    assignedTo?: { id: string; firstName: string; lastName: string } | null;
    assignedTeam?: string | null;
    priority?: string;
  };
  activities: Activity[];
  canEditCustomFields?: boolean;
  canReassign?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  onReassigned?: () => void;
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

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  CRITICAL: { bg: 'bg-red-100', text: 'text-red-700', label: 'Critical' },
  HIGH:     { bg: 'bg-orange-100', text: 'text-orange-700', label: 'High' },
  MEDIUM:   { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Medium' },
  LOW:      { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Low' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  OPEN:                    { bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-500' },
  ACKNOWLEDGED:            { bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-500' },
  SUBMITTED:              { bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-500' },
  IN_PROGRESS:             { bg: 'bg-yellow-100',  text: 'text-yellow-800', dot: 'bg-yellow-500' },
  ASSIGNED:                { bg: 'bg-indigo-100',  text: 'text-indigo-800',  dot: 'bg-indigo-500' },
  PENDING_APPROVAL:        { bg: 'bg-amber-100',  text: 'text-amber-800',  dot: 'bg-amber-500' },
  MANAGER_APPROVED:         { bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500' },
  INTERVIEW_SCHEDULED:     { bg: 'bg-purple-100', text: 'text-purple-800',  dot: 'bg-purple-500' },
  INTERVIEW_FEEDBACK_PENDING: { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500' },
  HR_SCREENING:            { bg: 'bg-indigo-100', text: 'text-indigo-800',  dot: 'bg-indigo-500' },
  LOA_PENDING_APPROVAL:    { bg: 'bg-amber-100',  text: 'text-amber-800',  dot: 'bg-amber-500' },
  LOA_APPROVED:            { bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500' },
  LOA_ISSUED:              { bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500' },
  RESOLVED:                { bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500' },
  COMPLETED:               { bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500' },
  CLOSED:                  { bg: 'bg-gray-100',   text: 'text-gray-700',  dot: 'bg-gray-500' },
  CANCELLED:               { bg: 'bg-gray-100',   text: 'text-gray-600',  dot: 'bg-gray-400' },
  REJECTED:                { bg: 'bg-red-100',    text: 'text-red-800',   dot: 'bg-red-500' },
};

const formatStatusLabel = (status: string) =>
  status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const RequestFormFields: React.FC<RequestFormFieldsProps> = ({
  request,
  activities,
  canEditCustomFields = false,
  canReassign = false,
  currentUserId,
  currentUserName,
  onReassigned,
  onCustomFieldsSaved,
}) => {
  const [showAssignModal, setShowAssignModal] = useState(false);

  const priorityStyle = PRIORITY_STYLES[request.priority || ''] || PRIORITY_STYLES.MEDIUM;
  const statusStyle = STATUS_STYLES[request.status] || { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' };

  return (
    <>
      {/* Request Summary */}
      <section>
        <div className="mb-6">
          <span className="text-xs font-bold text-[#44546f] uppercase tracking-widest">
            Case Summary
          </span>
          <h1 className="text-3xl font-bold text-[#101418] mt-1">{stripHtml(request.summary)}</h1>
        </div>

        {/* ─── Request Metadata Card ─── */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 bg-white border border-gray-100 rounded-xl p-5 mb-6 shadow-sm">
          {/* Row: Status + Priority */}
          <div>
            <span className="text-[11px] font-semibold text-[#8993a4] uppercase tracking-wider">Status</span>
            <div className="mt-1">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusStyle.bg} ${statusStyle.text}`}>
                <span className={`size-1.5 rounded-full ${statusStyle.dot}`} />
                {formatStatusLabel(request.status)}
              </span>
            </div>
          </div>
          {request.priority && (
            <div>
              <span className="text-[11px] font-semibold text-[#8993a4] uppercase tracking-wider">Priority</span>
              <div className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${priorityStyle.bg} ${priorityStyle.text}`}>
                  {priorityStyle.label}
                </span>
              </div>
            </div>
          )}

          {/* Row: Requester + Assigned To */}
          <div>
            <span className="text-[11px] font-semibold text-[#8993a4] uppercase tracking-wider">Requester</span>
            <div className="mt-1 flex items-center gap-2">
              <div className="size-7 rounded-full bg-[#0052cc] flex items-center justify-center text-white text-xs font-bold shrink-0">
                {request.requester
                  ? `${request.requester.firstName?.[0] || ''}${request.requester.lastName?.[0] || ''}`
                  : '?'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#101418] truncate">
                  {request.requester
                    ? `${request.requester.firstName} ${request.requester.lastName}`
                    : '—'}
                </p>
                {request.requester?.email && (
                  <p className="text-xs text-[#8993a4] truncate">{request.requester.email}</p>
                )}
              </div>
            </div>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#8993a4] uppercase tracking-wider">
              {canReassign ? 'Assigned To' : 'Assigned To'}
            </span>
            <div className="mt-1">
              {canReassign ? (
                <button
                  type="button"
                  onClick={() => setShowAssignModal(true)}
                  className="group flex items-center gap-2 w-full text-left rounded-lg px-1.5 py-1 -mx-1.5 transition-colors hover:bg-[#f4f5f7]"
                  title={request.assignedTo ? 'Reassign this request' : 'Assign this request'}
                >
                  {request.assignedTo ? (
                    <>
                      <div className="size-7 rounded-full bg-[#6554c0] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {request.assignedTo.firstName?.[0] || ''}{request.assignedTo.lastName?.[0] || ''}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#101418] truncate">
                          {request.assignedTo.firstName} {request.assignedTo.lastName}
                        </p>
                        {request.assignedTeam && (
                          <p className="text-xs text-[#8993a4] truncate">{request.assignedTeam}</p>
                        )}
                      </div>
                      <span className="material-symbols-outlined text-[16px] text-[#8993a4] opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: '16px' }}>
                        swap_horiz
                      </span>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-[#0052cc] group-hover:underline">
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
                      <span className="text-sm font-semibold">Assign agent</span>
                    </div>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {request.assignedTo ? (
                    <>
                      <div className="size-7 rounded-full bg-[#6554c0] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {request.assignedTo.firstName?.[0] || ''}{request.assignedTo.lastName?.[0] || ''}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#101418] truncate">
                          {request.assignedTo.firstName} {request.assignedTo.lastName}
                        </p>
                        {request.assignedTeam && (
                          <p className="text-xs text-[#8993a4] truncate">{request.assignedTeam}</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-[#8993a4]">Unassigned</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Row: Service Desk + Request Type */}
          {request.serviceDesk?.name && (
            <div>
              <span className="text-[11px] font-semibold text-[#8993a4] uppercase tracking-wider">Service Desk</span>
              <p className="mt-1 text-sm font-medium text-[#101418]">{request.serviceDesk.name}</p>
            </div>
          )}
          {request.requestType?.name && (
            <div>
              <span className="text-[11px] font-semibold text-[#8993a4] uppercase tracking-wider">Request Type</span>
              <p className="mt-1 text-sm font-medium text-[#101418]">{request.requestType.name}</p>
            </div>
          )}

          {/* Row: Created + Completed/Resolved */}
          <div>
            <span className="text-[11px] font-semibold text-[#8993a4] uppercase tracking-wider">Created</span>
            <p className="mt-1 text-sm text-[#101418]">{formatDateTime(request.createdAt)}</p>
          </div>
          {(request.completedAt || request.resolvedAt) && (
            <div>
              <span className="text-[11px] font-semibold text-[#8993a4] uppercase tracking-wider">
                {request.completedAt ? 'Completed' : 'Resolved'}
              </span>
              <p className="mt-1 text-sm text-[#101418]">
                {formatDateTime(request.completedAt || request.resolvedAt!)}
              </p>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6 shadow-sm">
          <span className="text-[11px] font-semibold text-[#8993a4] uppercase tracking-wider block mb-2">
            Description
          </span>
          {request.serviceDesk?.code === 'IT' && request.description ? (
            <div
              className="text-[#101418] leading-relaxed text-sm tiptap-content"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(request.description, {
                  ALLOWED_TAGS: ['b', 'i', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'p', 'br'],
                  ALLOWED_ATTR: ['href', 'target', 'rel'],
                }),
              }}
            />
          ) : (
            <p className="text-[#101418] leading-relaxed text-sm">
              {request.description || 'No detailed description provided.'}
            </p>
          )}
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

      {/* Assign Agent Modal */}
      {canReassign && showAssignModal && request.id && currentUserId && (
        <AssignAgentModal
          requestId={request.id}
          currentAssigneeId={request.assignedTo?.id}
          currentUserId={currentUserId}
          currentUserName={currentUserName || ''}
          onSuccess={() => {
            setShowAssignModal(false);
            onReassigned?.();
          }}
          onClose={() => setShowAssignModal(false)}
        />
      )}
    </>
  );
};

export default RequestFormFields;
