import React from 'react';
import { CreditApplication } from '../../../src/services/credit.service';
import CreditChecksTab from './CreditChecksTab';
import {
  AiCompliancePanel,
  AiAutoExceptionPanel,
  AiDuplicateAlert,
  AiRedFlagPanel,
} from '../../../src/components/credit-ai';

type Props = {
  application: CreditApplication;
  onUpdated: (next: CreditApplication) => void;
};

const panelStyle: React.CSSProperties = {
  backgroundColor: 'var(--cr-surface-container-lowest, #fff)',
  border: '1px solid var(--cr-outline-variant, #e2e8f0)',
  borderRadius: 'var(--cr-radius-lg, 8px)',
  padding: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  fontFamily: 'var(--cr-font-display)',
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--cr-on-surface, #0f172a)',
  borderBottom: '1px solid var(--cr-outline-variant, #e2e8f0)',
  paddingBottom: 8,
  marginBottom: 16,
};

const CreditBureauComplianceTab: React.FC<Props> = ({ application, onUpdated }) => {
  const checklist = (application as any).bureauChecklist;
  const statusItems = [
    { label: 'CCRIS uploaded', done: Boolean(checklist?.ccrisUploaded) },
    { label: 'CTOS uploaded', done: Boolean(checklist?.ctosUploaded) },
    { label: 'AML screening completed', done: Boolean(checklist?.amlScreeningDone) },
    {
      label: 'Adverse record cleared / exception documented',
      done: Boolean(checklist?.noAdverseRecord) || Boolean(checklist?.adverseExceptionReason),
    },
    { label: 'Second officer verification', done: Boolean(checklist?.verifiedById || checklist?.verifiedAt) },
  ];

  return (
    <div className="space-y-6">
      <section style={panelStyle}>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            fact_check
          </span>
          Bureau Checklist Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {statusItems.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border p-3"
              style={{
                borderColor: item.done ? 'rgba(22, 163, 74, 0.35)' : 'var(--cr-outline-variant, #e2e8f0)',
                backgroundColor: item.done ? 'rgba(22, 163, 74, 0.08)' : 'var(--cr-surface-container-low, #f8fafc)',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 18, color: item.done ? 'var(--cr-success, #16a34a)' : 'var(--cr-outline, #94a3b8)' }}
                >
                  {item.done ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span className="text-xs font-semibold" style={{ color: 'var(--cr-on-surface, #0f172a)' }}>
                  {item.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={panelStyle}>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            policy
          </span>
          CCRIS / CTOS / AML Review
        </h3>
        <CreditChecksTab application={application} onUpdated={onUpdated} />
      </section>

      <section style={panelStyle}>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            gpp_maybe
          </span>
          Compliance Intelligence
        </h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-center gap-2 mb-4">
          <span className="material-icons text-base">smart_toy</span>
          AI findings are advisory. Human officers remain responsible for AML, PEP, sanctions, and adverse-record clearance.
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AiCompliancePanel applicationId={application.id} />
          <AiAutoExceptionPanel applicationId={application.id} />
          <AiDuplicateAlert applicationId={application.id} />
          <AiRedFlagPanel applicationId={application.id} />
        </div>
      </section>
    </div>
  );
};

export default CreditBureauComplianceTab;
