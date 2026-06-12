import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { committeeApi, CommitteeMeeting, MeetingStatus } from '../../services/credit.service';

const MEETING_TYPE_LABELS: Record<string, string> = {
  REGULAR: 'Regular',
  ADHOC: 'Ad-hoc',
};

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-green-50 text-green-700 border-green-200',
  CANCELLED: 'bg-gray-50 text-gray-500 border-gray-200',
};

const formatDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

interface CommitteeWidgetProps {
  /** If provided, only show meetings that have this application on their agenda. */
  applicationId?: string;
}

const CommitteeWidget: React.FC<CommitteeWidgetProps> = ({ applicationId }) => {
  const [meetings, setMeetings] = useState<CommitteeMeeting[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch recent meetings (limit 5 for the widget)
      const data = await committeeApi.listMeetings({ page: 1, limit: 5 });
      let filtered = data.meetings;

      // If an applicationId is provided, try to show only relevant meetings
      // (those with agenda items referencing this application). The list API
      // doesn't filter by application, so we do a best-effort client-side
      // filter if agenda items are present; otherwise show all.
      if (applicationId) {
        const relevant = filtered.filter(
          (m) =>
            m.agendaItems?.some((a) => a.applicationId === applicationId),
        );
        // If some meetings are relevant, show only those; otherwise show all
        // (the app may not be on any agenda yet).
        if (relevant.length > 0) {
          filtered = relevant;
        }
      }

      setMeetings(filtered);
    } catch (e) {
      console.error('CommitteeWidget: failed to load meetings', e);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-lg text-indigo-600">
            groups
          </span>
          <h4 className="text-sm font-semibold text-gray-700">
            Committee Meetings
          </h4>
        </div>
        <Link
          to="/credit/committee"
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          View All Meetings
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>

      {/* Content */}
      <div className="divide-y divide-gray-100">
        {loading ? (
          // Skeleton
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-4 py-3 animate-pulse">
              <div className="h-4 w-3/5 rounded bg-gray-200 mb-2" />
              <div className="h-3 w-4/5 rounded bg-gray-100" />
            </div>
          ))
        ) : meetings.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <span className="material-symbols-outlined text-4xl text-gray-300 block mb-2">
              event_busy
            </span>
            <p className="text-sm text-gray-500 font-medium">
              No committee meetings
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Meetings related to this application will appear here.
            </p>
          </div>
        ) : (
          meetings.map((m) => (
            <Link
              key={m.id}
              to={`/credit/committee/${m.id}`}
              className="block px-4 py-3 hover:bg-gray-50 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-gray-800 truncate group-hover:text-blue-700 transition-colors">
                      {m.title}
                    </span>
                    <span
                      className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                        STATUS_STYLES[m.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                    >
                      {m.status}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                      {MEETING_TYPE_LABELS[m.meetingType] ?? m.meetingType}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatDate(m.scheduledAt)}
                    {m.location ? ` · ${m.location}` : ''}
                    {` · Quorum ${m.quorumMin}`}
                    {m._count
                      ? ` · ${m._count.members} members · ${m._count.agendaItems} items`
                      : ''}
                  </p>
                </div>
                <span className="material-symbols-outlined text-base text-gray-400 group-hover:text-blue-600 transition-colors">
                  chevron_right
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

export default CommitteeWidget;