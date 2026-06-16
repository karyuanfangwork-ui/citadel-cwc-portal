import React from 'react';
import { Link } from 'react-router-dom';
import { CrmContact } from '../../services/crm.service';

// ── Design tokens (Kinetic Enterprise) ──────────────────────────────
const T = {
  teal: '#006a61',
  tealLight: '#86f2e4',
  tealDark: '#006f66',
  surface: '#f8f9ff',
  surfaceLow: '#eff4ff',
  white: '#ffffff',
  border: '#e2e8f0',
  textPrimary: '#0b1c30',
  textSecondary: '#45464d',
  textMuted: '#76777d',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ba1a1a',
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const maskNric = (s?: string | null) => s ? s.replace(/(.{3}).+(.{2})/, '$1****$2') : '—';

interface Props {
  contact: CrmContact;
  onEdit?: () => void;
}

const Contact360Profile: React.FC<Props> = ({ contact, onEdit }) => {
  // Derived: tenure
  const tenure = Math.floor((Date.now() - new Date(contact.createdAt).getTime()) / (365.25 * 86400000));

  // Derived: health score (simple heuristic for contacts)
  const activities = contact.activities ?? [];
  const lastActivityDate = activities.length > 0
    ? new Date(Math.max(...activities.map(a => new Date(a.createdAt).getTime())))
    : new Date(contact.updatedAt);
  const daysSince = Math.max(0, Math.floor((Date.now() - lastActivityDate.getTime()) / 86400000));
  const healthScore = Math.max(0, Math.min(100, 100 - Math.min(daysSince * 2, 60) + Math.min(activities.length * 3, 40)));

  const healthColor = healthScore >= 70 ? T.success : healthScore >= 40 ? T.warning : T.error;
  const healthLabel = healthScore >= 70 ? 'Healthy' : healthScore >= 40 ? 'Needs Attention' : 'At Risk';

  const fullName = `${contact.firstName} ${contact.lastName}`;
  const initials = `${contact.firstName[0]}${contact.lastName[0]}`;

  return (
    <div className="space-y-5">
      {/* ── Avatar + Name ────────────────────────────────────────── */}
      <div className="text-center pt-2">
        <div
          className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-[20px] font-bold"
          style={{ background: T.surfaceLow, color: T.teal, border: `2px solid ${T.teal}20` }}
        >
          {initials}
        </div>
        <h2 className="text-[15px] font-semibold mt-2 leading-snug" style={{ color: T.textPrimary }}>
          {fullName}
        </h2>
        {contact.isPrimary && (
          <span
            className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${T.teal}15`, color: T.teal }}
          >
            Primary Contact
          </span>
        )}
        {contact.jobTitle && (
          <p className="text-[12px] mt-1" style={{ color: T.textMuted }}>{contact.jobTitle}</p>
        )}
        {/* Health score */}
        <div className="flex items-center justify-center gap-2 mt-2">
          <div className="w-2 h-2 rounded-full" style={{ background: healthColor }} />
          <span className="text-[11px] font-semibold" style={{ color: healthColor }}>{healthLabel}</span>
          <span className="text-[11px]" style={{ color: T.textMuted }}>{healthScore}/100</span>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: `1px solid ${T.border}` }} />

      {/* ── Contact Details ───────────────────────────────────────── */}
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: T.textMuted }}>
          Contact Details
        </h3>
        <div className="space-y-2">
          {contact.email && (
            <InfoRow icon="mail" label="Email" value={contact.email} />
          )}
          {contact.phone && (
            <InfoRow icon="call" label="Phone" value={contact.phone} />
          )}
          {contact.mobile && (
            <InfoRow icon="smartphone" label="Mobile" value={contact.mobile} />
          )}
          {(contact as any).nricPassport && (
            <InfoRow icon="fingerprint" label="NRIC" value={maskNric((contact as any).nricPassport)} />
          )}
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: `1px solid ${T.border}` }} />

      {/* ── Personal Info ─────────────────────────────────────────── */}
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: T.textMuted }}>
          Personal Info
        </h3>
        <div className="space-y-2">
          {(contact as any).dateOfBirth && (
            <InfoRow icon="cake" label="Date of Birth" value={formatDate((contact as any).dateOfBirth)} />
          )}
          {contact.department && (
            <InfoRow icon="corporate_fare" label="Department" value={contact.department} />
          )}
          <InfoRow icon="calendar_today" label="Client Since" value={formatDate(contact.createdAt)} />
          <InfoRow icon="timelapse" label="Tenure" value={tenure > 0 ? `${tenure} yr${tenure !== 1 ? 's' : ''}` : '< 1 yr'} />
          <InfoRow icon="check_circle" label="Status" value={contact.isActive !== false ? 'Active' : 'Inactive'} />
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: `1px solid ${T.border}` }} />

      {/* ── Linked Account ────────────────────────────────────────── */}
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: T.textMuted }}>
          Linked Account
        </h3>
        {contact.account ? (
          <Link
            to={`/crm/accounts/${contact.account.id}`}
            className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:opacity-80"
            style={{ background: T.surfaceLow, textDecoration: 'none' }}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ color: T.teal }}>business</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold truncate" style={{ color: T.textPrimary }}>{contact.account.name}</p>
              {contact.account.industry && (
                <p className="text-[10px]" style={{ color: T.textMuted }}>{contact.account.industry}</p>
              )}
            </div>
            <span className="material-symbols-outlined text-[14px]" style={{ color: T.textMuted }}>chevron_right</span>
          </Link>
        ) : (
          <p className="text-[12px]" style={{ color: T.textMuted }}>No linked account</p>
        )}
      </div>

      {/* ── Edit button ──────────────────────────────────────────── */}
      {onEdit && (
        <button
          onClick={onEdit}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors"
          style={{ background: T.surfaceLow, color: T.teal, border: `1px solid ${T.teal}20`, cursor: 'pointer' }}
        >
          <span className="material-symbols-outlined text-[14px]">edit</span>
          Edit Contact
        </button>
      )}
    </div>
  );
};

// ── Info row ───────────────────────────────────────────────────────
const InfoRow: React.FC<{ icon: string; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-2">
    <span className="material-symbols-outlined text-[16px]" style={{ color: T.teal }}>{icon}</span>
    <span className="text-[11px] shrink-0 w-[72px]" style={{ color: T.textMuted }}>{label}</span>
    <span className="text-[12px] font-medium truncate" style={{ color: T.textPrimary }}>{value}</span>
  </div>
);

export default Contact360Profile;