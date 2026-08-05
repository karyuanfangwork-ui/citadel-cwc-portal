import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rejectionApi } from '../../src/services/credit.service';

const REJECTION_REASON_LABELS: Record<string, string> = {
  INSUFFICIENT_INCOME: 'Insufficient Income',
  HIGH_EXISTING_OBLIGATIONS: 'High Existing Obligations',
  POOR_CREDIT_HISTORY: 'Poor Credit History',
  INADEQUATE_COLLATERAL: 'Inadequate Collateral',
  WEAK_BUSINESS_PERFORMANCE: 'Weak Business Performance',
  INCOMPLETE_DOCUMENTATION: 'Incomplete Documentation',
  AML_COMPLIANCE_ISSUE: 'AML / Compliance Issue',
  POLICY_BREACH: 'Policy Breach',
  CONCENTRATION_LIMIT: 'Concentration Limit',
  OTHER: 'Other',
};

interface Props {
  applicationId: string;
  state: string;
  rejectionReasonCode?: string | null;
  rejectionReason?: string | null;
  applicationNo?: string;
}

const RejectionBanner: React.FC<Props> = ({ applicationId, state, rejectionReasonCode, rejectionReason, applicationNo }) => {
  const navigate = useNavigate();
  const [cloning, setCloning] = useState(false);

  if (state !== 'REJECTED' && state !== 'KYC_REJECTED') return null;

  const codeLabel = rejectionReasonCode
    ? REJECTION_REASON_LABELS[rejectionReasonCode] ?? rejectionReasonCode
    : 'Not specified';

  const handleClone = async () => {
    setCloning(true);
    try {
      const result = await rejectionApi.cloneFromRejected(applicationId);
      navigate(`/credit/applications/${result.id}`);
    } catch (err) {
      console.error('Failed to clone application', err);
      alert('Failed to create new application. Please try again.');
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="border-l-4 border-red-500 bg-red-50 p-4 rounded-r-md mb-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-red-800">
            Application {applicationNo ?? applicationId.slice(0, 8)} Rejected
          </h3>
          <div className="mt-1 text-sm text-red-700">
            <span className="font-medium">Reason Code:</span> {codeLabel}
          </div>
          {rejectionReason && (
            <p className="mt-1 text-sm text-red-600 italic">"{rejectionReason}"</p>
          )}
        </div>
        <button
          onClick={handleClone}
          disabled={cloning}
          className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
        >
          {cloning ? 'Cloning…' : 'Copy to New Application'}
        </button>
      </div>
      <p className="mt-2 text-xs text-red-500">
        The borrower and RM have been notified. You can clone this application to start a new submission.
      </p>
    </div>
  );
};

export default RejectionBanner;