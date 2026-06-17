import React from 'react';
import ApplicationComments from '../../../src/components/credit/ApplicationComments';
import AuditTab from './AuditTab';

interface TimelineAuditTabProps {
  applicationId: string;
}

const sectionHeaderStyle: React.CSSProperties = {
  fontFamily: 'var(--cr-font-display)',
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--cr-on-surface, #0f172a)',
  borderBottom: '1px solid var(--cr-outline-variant, #e2e8f0)',
  paddingBottom: 8,
  marginBottom: 16,
};

const TimelineAuditTab: React.FC<TimelineAuditTabProps> = ({ applicationId }) => {
  return (
    <div className="space-y-8">
      <section>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            history
          </span>
          Timeline &amp; Comments
        </h3>
        <ApplicationComments applicationId={applicationId} />
      </section>

      <section>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            receipt_long
          </span>
          Audit Trail
        </h3>
        <AuditTab />
      </section>
    </div>
  );
};

export default TimelineAuditTab;