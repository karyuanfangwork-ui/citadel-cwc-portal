import React from 'react';
import { CreditApplication } from '../../../src/services/credit.service';
import { SmeFinancialAssessment, StatementTypeValidation } from '../../../src/services/smeFinancial.service';

/**
 * BusinessProfileSection
 *
 * Phase 3: Enhanced business profile panel replacing the old StatementTypeCard.
 * Shows: legal entity type, statement type/quality, fiscal year end, years trading,
 * annual turnover, SIC code, and statement type requirements.
 *
 * Data comes from the SmeFinancialAssessment API + borrower profile.
 */

interface Props {
  application: CreditApplication;
  assessment: SmeFinancialAssessment | null;
  validation: StatementTypeValidation | null;
}

function statementTypeLabel(type: string | null): string {
  switch (type) {
    case 'AUDITED': return 'Audited';
    case 'MANAGEMENT': return 'Management';
    case 'COMPILED': return 'Compiled';
    default: return 'Not specified';
  }
}

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return `RM ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const BusinessProfileSection: React.FC<Props> = ({ application, assessment, validation }) => {
  const borrowerType = application.borrowerProfile?.borrowerType;
  const entityTypeLabel = borrowerType === 'CORPORATE'
    ? 'Corporate (Sdn Bhd / Bhd)'
    : borrowerType === 'SOLE_PROPRIETOR'
      ? 'Sole Proprietor / Enterprise'
      : borrowerType ?? '—';

  const profileFields = [
    { label: 'Legal Entity Type', value: entityTypeLabel, icon: 'domain' },
    { label: 'Statement Type', value: assessment ? statementTypeLabel(assessment.smeFinancialStatementType) : '—', icon: 'description' },
    { label: 'Years Trading', value: assessment?.yearsTrading !== null && assessment?.yearsTrading !== undefined ? `${assessment.yearsTrading} years` : '—', icon: 'schedule' },
    { label: 'Annual Turnover', value: assessment ? formatCurrency(assessment.annualTurnover) : '—', icon: 'trending_up' },
    { label: 'SIC Code', value: assessment?.sicCode ?? '—', icon: 'category' },
    { label: 'Credit Risk Rating', value: application.borrowerProfile?.creditRiskRating ?? '—', icon: 'grade' },
  ];

  return (
    <div className="space-y-4">
      {/* Business Profile Grid */}
      <div className="bg-white border rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base text-gray-400">business</span>
          Business Profile
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {profileFields.map((f, idx) => (
            <div key={idx}>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-gray-400">{f.icon}</span>
                {f.label}
              </span>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{f.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Statement Quality Requirements */}
      {assessment && (
        <div className="bg-white border rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-gray-400">verified</span>
            Statement Quality Requirements
          </h4>
          <div className="flex gap-2 mb-3">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              assessment.requiresAudited ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
            }`}>
              {assessment.requiresAudited ? '⚠ Audited Required' : '✓ Audited Not Required'}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              assessment.acceptsManagement ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {assessment.acceptsManagement ? '✓ Management Accepted' : '⚠ Management Not Accepted'}
            </span>
          </div>
          {validation && (
            <div className={`text-xs p-2 rounded ${
              validation.acceptable ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}>
              {validation.reason}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BusinessProfileSection;