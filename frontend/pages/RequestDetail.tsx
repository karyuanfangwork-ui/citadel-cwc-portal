import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { requestService } from '../src/services/request.service';
import { useAuth } from '../src/context/AuthContext';
import { STATUS_CONFIG } from '../constants';

interface Request {
  id: string;
  referenceNumber: string;
  summary: string;
  description: string | null;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  serviceDesk?: {
    id: string;
    name: string;
    code: string;
  };
  requester?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

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

const RequestDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [request, setRequest] = useState<Request | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchRequestData();
    }
  }, [id]);

  const fetchRequestData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [requestData, activitiesData] = await Promise.all([
        requestService.getRequestById(id!),
        requestService.getRequestActivities(id!),
      ]);

      setRequest(requestData);
      setActivities(activitiesData);
    } catch (err: any) {
      console.error('Error fetching request:', err);
      setError(err.message || 'Failed to load request');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !id) return;

    try {
      setSubmitting(true);
      const newActivity = await requestService.addActivity(id, comment, false);

      // Add the new activity to the list
      setActivities([...activities, newActivity]);
      setComment('');
    } catch (err: any) {
      console.error('Error adding comment:', err);
      alert('Failed to add comment: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusSteps = (currentStatus: string) => {
    const allSteps = [
      { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
      { label: 'In Review', status: 'IN_REVIEW', icon: 'radio_button_checked' },
      { label: 'In Progress', status: 'IN_PROGRESS', icon: 'radio_button_checked' },
      { label: 'Resolved', status: 'RESOLVED', icon: 'check_circle' },
    ];

    const statusOrder = ['SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'APPROVED', 'REJECTED'];
    const currentIndex = statusOrder.indexOf(currentStatus);

    return allSteps.map((step, idx) => ({
      ...step,
      active: statusOrder.indexOf(step.status) <= currentIndex,
    }));
  };

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 py-8">
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052cc]"></div>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          <p className="font-semibold">Error loading request</p>
          <p className="text-sm">{error || 'Request not found'}</p>
          <Link to="/my-requests" className="text-sm font-bold underline mt-2 inline-block">
            Back to My Requests
          </Link>
        </div>
      </div>
    );
  }

  const steps = getStatusSteps(request.status);

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <nav className="flex items-center gap-2 mb-6 text-sm font-medium text-[#5e718d]">
        <Link to="/" className="hover:text-[#0052cc]">
          Help Center
        </Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <Link to="/my-requests" className="hover:text-[#0052cc]">
          My Requests
        </Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-[#101418] font-bold">{request.referenceNumber}</span>
      </nav>

      {/* Status Progress */}
      <div className="mb-10 bg-white border border-gray-100 p-8 rounded-xl shadow-sm">
        <div className="flex items-center justify-between relative">
          {steps.map((step, idx) => (
            <React.Fragment key={step.label}>
              <div
                className={`flex flex-col items-center gap-2 z-10 ${step.active ? 'text-[#0052cc]' : 'text-[#8993a4]'
                  }`}
              >
                <span
                  className={`material-symbols-outlined !text-2xl ${!step.active ? 'opacity-30' : ''}`}
                >
                  {step.icon}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider">{step.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-grow mx-4 ${steps[idx + 1].active ? 'bg-[#0052cc]' : 'bg-gray-100'
                    }`}
                ></div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        <div className="flex-1 space-y-10">
          {/* Request Summary */}
          <section>
            <div className="mb-6">
              <span className="text-xs font-bold text-[#5e718d] uppercase tracking-widest">
                Case Summary
              </span>
              <h1 className="text-3xl font-bold text-[#101418] mt-1">{request.summary}</h1>
            </div>
            <div className="bg-[#f4f5f7] p-8 rounded-xl border border-gray-100">
              <span className="text-xs font-bold text-[#5e718d] uppercase tracking-widest block mb-4">
                Description
              </span>
              <p className="text-[#44546f] leading-relaxed text-lg">
                {request.description || 'No detailed description provided.'}
              </p>
            </div>
          </section>

          {/* Communication Timeline */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <span className="material-symbols-outlined text-[#0052cc]">encrypted</span>
              <h3 className="font-bold text-xl">Secure Communication</h3>
            </div>

            <div className="space-y-8">
              {activities.length === 0 ? (
                <div className="text-center py-8 text-[#5e718d]">
                  <p>No activities yet</p>
                </div>
              ) : (
                activities.map((activity, idx) => {
                  const isUser = activity.authorName === `${user?.firstName} ${user?.lastName}`;
                  return (
                    <div key={activity.id} className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
                      <div
                        className={`size-10 rounded-full flex items-center justify-center shrink-0 ${isUser
                            ? 'bg-[#0052cc]/10 text-[#0052cc]'
                            : 'bg-gray-100 text-[#5e718d]'
                          }`}
                      >
                        <span className="material-symbols-outlined">
                          {isUser ? 'person' : 'shield_person'}
                        </span>
                      </div>
                      <div className={`flex-1 max-w-xl ${isUser ? 'text-right' : ''}`}>
                        <div
                          className={`p-5 rounded-2xl shadow-sm border ${isUser
                              ? 'bg-blue-50 border-blue-100 rounded-tr-none'
                              : 'bg-white border-gray-100 rounded-tl-none'
                            }`}
                        >
                          <div className="flex justify-between items-center mb-2 gap-4">
                            <span className="text-xs font-bold text-[#0052cc]">
                              {activity.authorName}
                              {activity.authorRole && ` (${activity.authorRole})`}
                            </span>
                            <span className="text-[11px] text-[#5e718d]">
                              {formatDateTime(activity.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-[#44546f] leading-relaxed text-left">
                            {activity.message}
                          </p>
                          {activity.isSystemGenerated && (
                            <span className="text-[10px] text-[#5e718d] italic mt-2 block">
                              System generated
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Comment Form */}
            <form onSubmit={handleSubmitComment} className="mt-8">
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <label className="block text-sm font-bold text-[#101418] mb-3">Add a comment</label>
                <textarea
                  className="w-full p-4 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 outline-none resize-none"
                  rows={4}
                  placeholder="Type your message here..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={submitting}
                ></textarea>
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    className="px-6 py-2 text-sm font-bold text-[#44546f] hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => setComment('')}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-[#0052cc] text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!comment.trim() || submitting}
                  >
                    {submitting ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-80 space-y-6">
          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
            <h3 className="font-bold mb-6">Request Details</h3>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-[#5e718d] mb-1">Reference Number</dt>
                <dd className="font-mono font-bold text-[#0052cc]">{request.referenceNumber}</dd>
              </div>
              <div>
                <dt className="text-[#5e718d] mb-1">Status</dt>
                <dd>
                  <span
                    className={`inline-flex px-2 py-1 rounded text-[10px] font-bold ${STATUS_CONFIG[request.status]?.bg || 'bg-gray-100'
                      } ${STATUS_CONFIG[request.status]?.color || 'text-gray-600'}`}
                  >
                    {STATUS_CONFIG[request.status]?.label || request.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-[#5e718d] mb-1">Priority</dt>
                <dd className="font-semibold">{request.priority}</dd>
              </div>
              <div>
                <dt className="text-[#5e718d] mb-1">Service Desk</dt>
                <dd className="font-semibold">{request.serviceDesk?.name || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-[#5e718d] mb-1">Requester</dt>
                <dd className="font-semibold">
                  {request.requester
                    ? `${request.requester.firstName} ${request.requester.lastName}`
                    : 'N/A'}
                </dd>
              </div>
              {request.assignedTo && (
                <div>
                  <dt className="text-[#5e718d] mb-1">Assigned To</dt>
                  <dd className="font-semibold">
                    {request.assignedTo.firstName} {request.assignedTo.lastName}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-[#5e718d] mb-1">Created</dt>
                <dd className="font-semibold">{formatDateTime(request.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-[#5e718d] mb-1">Last Updated</dt>
                <dd className="font-semibold">{formatDateTime(request.updatedAt)}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
            <h3 className="font-bold mb-4">Actions</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-[#44546f] hover:bg-gray-50 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-lg">attach_file</span>
                Add Attachment
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-[#44546f] hover:bg-gray-50 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-lg">share</span>
                Share Request
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-[#44546f] hover:bg-gray-50 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-lg">print</span>
                Print Details
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default RequestDetail;
