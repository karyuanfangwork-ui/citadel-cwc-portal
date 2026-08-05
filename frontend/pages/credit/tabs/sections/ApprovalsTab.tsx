import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import creditService, {
  CreditApplication,
  CreditApproval,
  policyLimitApi,
  PolicyEvaluationResult,
} from '../../../../src/services/credit.service';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../../../src/utils/errorMessages';
import CaMemoSection from '../../../../src/components/credit/CaMemoSection';
import ApprovalPackPreview from '../../../../src/components/credit/ApprovalPackPreview';
import ApprovalChainPanel from '../../../../src/components/credit/ApprovalChainPanel';
import LooSection from './LooSection';
import CommitteeWidget from '../../../../src/components/credit/CommitteeWidget';

interface ApprovalsTabProps {
  app: CreditApplication;
  onRefresh: () => void;
}

const ApprovalsTab: React.FC<ApprovalsTabProps> = ({ app, onRefresh }) => {
  const { id } = useParams<{ id: string }>();

  const [approvals, setApprovals] = useState<CreditApproval[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(true);
  const [showPackPreview, setShowPackPreview] = useState(false);

  // §3 — Fetch sign-off completion status to show advisory
  const [signoffsComplete, setSignoffsComplete] = useState<boolean | undefined>(undefined);
  const REQUIRED_SIGNOFF_ROLES = ['PREPARED_BY', 'REVIEWED_BY', 'CONCURRED_BY'] as const;

  // §6.2 — Policy limit evaluation
  const [policyResult, setPolicyResult] = useState<PolicyEvaluationResult | null>(null);

  const fetchApprovals = useCallback(async () => {
    if (!id) return;
    setLoadingApprovals(true);
    try {
      const data = await creditService.listApprovals(id);
      setApprovals(data);
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to load approvals'));
    } finally {
      setLoadingApprovals(false);
    }
  }, [id]);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  // Fetch sign-off status for the advisory in approval chain panel
  useEffect(() => {
    if (!id) return;
    import('../../../../src/services/credit.service').then(m => {
      m.signoffApi.list(id).then(signoffs => {
        const complete = REQUIRED_SIGNOFF_ROLES.every(role =>
          signoffs.some(s => s.role === role && s.signedAt),
        );
        setSignoffsComplete(complete);
      }).catch(() => {});
    });
  }, [id]);

  // §6.2 — Fetch policy limit evaluation
  useEffect(() => {
    if (!id) return;
    policyLimitApi.evaluate(id).then(setPolicyResult).catch(() => {});
  }, [id]);

  const handleActionComplete = () => {
    fetchApprovals();
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Header + preview button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Approvals</h3>
        <button
          onClick={() => setShowPackPreview(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">description</span>
          Preview Approval Pack
        </button>
      </div>

      {/* §6.2 — Policy Limit Banners */}
      {policyResult && policyResult.blocks.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
            <span className="material-symbols-outlined text-base">gpp_bad</span>
            Policy Limit Violations — Submission Blocked
          </div>
          {policyResult.blocks.map((b, i) => (
            <div key={i} className="text-xs text-red-700 pl-6">{b.message}</div>
          ))}
        </div>
      )}
      {policyResult && policyResult.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <span className="material-symbols-outlined text-base">warning</span>
            Policy Limit Warnings — Requires Justification
          </div>
          {policyResult.warnings.filter(w => w.message).map((w, i) => (
            <div key={i} className="text-xs text-amber-700 pl-6">{w.message}</div>
          ))}
        </div>
      )}

      {/* Approval chain */}
      <CaMemoSection title="Approval Chain" phase="S7">
        {loadingApprovals ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <ApprovalChainPanel
            application={app}
            approvals={approvals}
            signoffsComplete={signoffsComplete}
            onActionComplete={handleActionComplete}
          />
        )}
      </CaMemoSection>

      {/* Approval Pack Preview Modal */}
      {showPackPreview && id && (
        <ApprovalPackPreview
          applicationId={id}
          applicationNo={app.applicationNo ?? id}
          onClose={() => setShowPackPreview(false)}
        />
      )}

      {/* §2.3 — LOO (Letter of Offer) Section — always renders if LOO exists; generate/regen only in APPROVED/OFFER */}
      <LooSection applicationId={app.id} state={app.state} />

      {/* §P2-1 — Committee Meetings Widget (demoted from top-level nav) */}
      <CommitteeWidget applicationId={app.id} />
    </div>
  );
};

export default ApprovalsTab;
