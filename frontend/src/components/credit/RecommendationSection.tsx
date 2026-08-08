import React, { useEffect, useState, useCallback } from 'react';
import {
  CreditRecommendation,
  RecommendationDraftInput,
  RecommendationType,
} from '../../services/credit.service';
import { creditRecommendationApi } from '../../services/credit.service';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../utils/errorMessages';
import { formatDateTime } from '../../../pages/credit/creditUtils';
import {
  validateRecommendationDraft,
  canEditRecommendation,
  canSubmitRecommendation,
} from './recommendationRules';

interface Props {
  applicationId: string;
  applicationState: string;
  currentUserId: string;
  onChanged?: () => void;
}

const STATUS_BADGE: Record<string, { bg: string; text: string; icon: string }> = {
  DRAFT:       { bg: 'bg-gray-50',   text: 'text-gray-700',   icon: 'edit_note' },
  SUBMITTED:  { bg: 'bg-blue-50',   text: 'text-blue-700',   icon: 'send' },
  ACKNOWLEDGED: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'check_circle' },
  SUPERSEDED: { bg: 'bg-amber-50',  text: 'text-amber-700',  icon: 'history' },
};

const TYPE_BADGE: Record<string, string> = {
  APPROVE: 'bg-emerald-100 text-emerald-800',
  CONDITIONAL: 'bg-amber-100 text-amber-800',
  REJECT: 'bg-red-100 text-red-800',
};

const EMPTY_DRAFT: RecommendationDraftInput = {
  recommendationType: 'APPROVE',
  recommendedAmount: null,
  recommendedTenorMonths: null,
  pricingTerms: null,
  conditions: null,
  rationale: null,
};

const RecommendationSection: React.FC<Props> = ({ applicationId, applicationState, currentUserId, onChanged }) => {
  const [current, setCurrent] = useState<CreditRecommendation | null>(null);
  const [history, setHistory] = useState<CreditRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDraft, setEditDraft] = useState<RecommendationDraftInput | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const [cur, list] = await Promise.all([
        creditRecommendationApi.getCurrentRecommendation(applicationId),
        creditRecommendationApi.listRecommendations(applicationId),
      ]);
      setCurrent(cur);
      setHistory(list);
      // If there is a DRAFT by the current user, open the editor
      const myDraft = list.find(r => r.status === 'DRAFT' && r.authorId === currentUserId);
      if (myDraft) {
        setEditDraft({
          recommendationType: myDraft.recommendationType,
          recommendedAmount: myDraft.recommendedAmount ?? null,
          recommendedTenorMonths: myDraft.recommendedTenorMonths ?? null,
          conditions: myDraft.conditions ?? null,
          rationale: myDraft.rationale ?? null,
        });
      }
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to load recommendation'));
    } finally {
      setLoading(false);
    }
  }, [applicationId, currentUserId]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const canEdit = canEditRecommendation(current, currentUserId);
  const canSubmit = canSubmitRecommendation(current, currentUserId);
  const noSubmittedRec = !current || current.status === 'SUPERSEDED';
  const isEditing = editDraft !== null;

  const handleCreateDraft = async () => {
    setSaving(true);
    try {
      const rec = await creditRecommendationApi.createRecommendation(applicationId, {
        ...EMPTY_DRAFT,
        rationale: '',
      });
      setCurrent(rec);
      setEditDraft({
        recommendationType: rec.recommendationType,
        recommendedAmount: rec.recommendedAmount ?? null,
        recommendedTenorMonths: rec.recommendedTenorMonths ?? null,
        conditions: rec.conditions ?? null,
        rationale: rec.rationale ?? null,
      });
      onChanged?.();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to create recommendation'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!editDraft || !current) return;
    setSaving(true);
    try {
      const updated = await creditRecommendationApi.updateRecommendationDraft(
        applicationId,
        current.id,
        editDraft,
      );
      setCurrent(updated);
      toast.success('Draft saved');
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to save draft'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!editDraft || !current) return;
    const validationError = validateRecommendationDraft(editDraft);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    // Save first, then submit
    setSaving(true);
    try {
      await creditRecommendationApi.updateRecommendationDraft(applicationId, current.id, editDraft);
      const submitted = await creditRecommendationApi.submitRecommendation(applicationId, current.id);
      setCurrent(submitted);
      setEditDraft(null);
      toast.success('Recommendation submitted');
      onChanged?.();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to submit recommendation'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditDraft(null);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  const badge = current ? STATUS_BADGE[current.status] ?? STATUS_BADGE.DRAFT : undefined;
  const typeBadge = current ? TYPE_BADGE[current.recommendationType] ?? '' : '';

  return (
    <div className="space-y-4">
      {/* ── No submitted recommendation warning ──── */}
      {noSubmittedRec && (
        <div role="status" className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5">priority_high</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800 mb-1">Recommendation Required</p>
            <p className="text-xs text-amber-700">
              A submitted recommendation is required before this application can be sent to committee.
            </p>
          </div>
        </div>
      )}

      {/* ── Read-only view (SUBMITTED/ACKNOWLEDGED/SUPERSEDED) ──── */}
      {current && !isEditing && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge}`}>
                {current.recommendationType}
              </span>
              {badge && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                  <span className="material-symbols-outlined text-sm">{badge.icon}</span>
                  {current.status}
                </span>
              )}
            </div>
            {current.submittedAt && (
              <span className="text-xs text-gray-500">
                Submitted {formatDateTime(current.submittedAt)}
              </span>
            )}
          </div>

          {current.recommendedAmount != null && (
            <div className="text-sm text-gray-700">
              <span className="font-medium">Amount:</span> {Number(current.recommendedAmount).toLocaleString()}
            </div>
          )}
          {current.recommendedTenorMonths != null && (
            <div className="text-sm text-gray-700">
              <span className="font-medium">Tenor:</span> {current.recommendedTenorMonths} months
            </div>
          )}
          {current.conditions && (
            <div className="text-sm text-gray-700">
              <span className="font-medium">Conditions:</span> {current.conditions}
            </div>
          )}
          {current.rationale && (
            <div className="text-sm text-gray-700">
              <span className="font-medium">Rationale:</span> {current.rationale}
            </div>
          )}
        </div>
      )}

      {/* ── Draft editor ──── */}
      {isEditing && canEdit && (
        <div className="border border-blue-200 rounded-xl p-4 space-y-4">
          <h4 className="text-sm font-semibold text-gray-800">
            {current ? 'Edit Recommendation Draft' : 'New Recommendation'}
          </h4>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Recommendation Type *</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
              value={editDraft?.recommendationType ?? 'APPROVE'}
              onChange={e => setEditDraft(prev => prev ? { ...prev, recommendationType: e.target.value as RecommendationType } : prev)}
            >
              <option value="APPROVE">Approve</option>
              <option value="CONDITIONAL">Conditional Approve</option>
              <option value="REJECT">Reject</option>
            </select>
          </div>

          {/* Amount & Tenor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Recommended Amount</label>
              <input
                type="number"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                placeholder="e.g. 250000"
                value={editDraft?.recommendedAmount ?? ''}
                onChange={e => setEditDraft(prev => prev ? { ...prev, recommendedAmount: e.target.value ? Number(e.target.value) : null } : prev)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tenor (months)</label>
              <input
                type="number"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                placeholder="e.g. 36"
                value={editDraft?.recommendedTenorMonths ?? ''}
                onChange={e => setEditDraft(prev => prev ? { ...prev, recommendedTenorMonths: e.target.value ? Number(e.target.value) : null } : prev)}
              />
            </div>
          </div>

          {/* Conditions (CONDITIONAL only) */}
          {editDraft?.recommendationType === 'CONDITIONAL' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Conditions *</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                rows={3}
                placeholder="Describe the conditions for a conditional recommendation"
                value={editDraft?.conditions ?? ''}
                onChange={e => setEditDraft(prev => prev ? { ...prev, conditions: e.target.value || null } : prev)}
              />
            </div>
          )}

          {/* Rationale */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rationale * (min 20 characters)</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
              rows={3}
              placeholder="Explain the basis for this recommendation"
              value={editDraft?.rationale ?? ''}
              onChange={e => setEditDraft(prev => prev ? { ...prev, rationale: e.target.value } : prev)}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              onClick={handleSaveDraft}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? 'Submitting…' : 'Submit Recommendation'}
            </button>
            <button
              className="px-4 py-2 text-sm font-medium rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
              onClick={handleCancelEdit}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── No draft, non-author view ──── */}
      {current && current.status === 'DRAFT' && !canEdit && !isEditing && (
        <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <span className="material-symbols-outlined text-gray-400 text-xl mt-0.5">lock</span>
          <div className="flex-1">
            <p className="text-sm text-gray-700">
              Only the author can edit or submit this draft.
            </p>
          </div>
        </div>
      )}

      {/* ── Create button (no draft exists) ──── */}
      {!current && !isEditing && (
        <button
          className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          onClick={handleCreateDraft}
          disabled={saving}
        >
          {saving ? 'Creating…' : 'Create Recommendation'}
        </button>
      )}

      {/* ── History ──── */}
      {history.length > 1 && (
        <details className="mt-2">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
            Previous recommendations ({history.length - 1})
          </summary>
          <div className="mt-2 space-y-2">
            {history
              .filter(r => r.status === 'SUPERSEDED')
              .map(r => (
                <div key={r.id} className="text-xs text-gray-500 border-l-2 border-gray-200 pl-3 py-1">
                  <span className="font-medium">{r.recommendationType}</span>
                  {r.submittedAt && <> &middot; submitted {formatDateTime(r.submittedAt)}</>}
                  {r.rationale && <p className="mt-0.5 italic">{r.rationale}</p>}
                </div>
              ))}
          </div>
        </details>
      )}
    </div>
  );
};

export default RecommendationSection;