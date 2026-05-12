import React, { useState, useEffect } from 'react';

interface Candidate {
  id: string;
  name: string;
}

interface ExistingFeedback {
  candidateId: string | null;
  decision: string;
  feedback: string;
  overallRating: number | null;
  technicalSkills: number | null;
  culturalFit: number | null;
  communication: number | null;
}

interface InterviewFeedbackModalProps {
  isOpen: boolean;
  processingAction: boolean;
  onClose: () => void;
  onSubmit: (data: {
    candidateId: string;
    decision: string;
    feedback: string;
    overallRating: number;
    technicalSkills: number;
    culturalFit: number;
    communication: number;
  }) => Promise<void>;
  candidates?: Candidate[];
  existingFeedbacks?: ExistingFeedback[];
}

const InterviewFeedbackModal: React.FC<InterviewFeedbackModalProps> = ({
  isOpen,
  processingAction,
  onClose,
  onSubmit,
  candidates = [],
  existingFeedbacks = [],
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decision, setDecision] = useState('');
  const [feedback, setFeedback] = useState('');
  const [overallRating, setOverallRating] = useState(3);
  const [technicalSkills, setTechnicalSkills] = useState(3);
  const [culturalFit, setCulturalFit] = useState(3);
  const [communication, setCommunication] = useState(3);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      resetForm();
      const existing = new Set(existingFeedbacks.map(f => f.candidateId).filter(Boolean) as string[]);
      setSubmittedIds(existing);
    }
  }, [isOpen, existingFeedbacks]);

  const resetForm = () => {
    setDecision('');
    setFeedback('');
    setOverallRating(3);
    setTechnicalSkills(3);
    setCulturalFit(3);
    setCommunication(3);
  };

  if (!isOpen) return null;

  const activeCandidates = candidates.length > 0 ? candidates : [];
  const currentCandidate = activeCandidates[currentIndex];
  const isAlreadySubmitted = currentCandidate ? submittedIds.has(currentCandidate.id) : false;
  const existingFeedback = currentCandidate
    ? existingFeedbacks.find(f => f.candidateId === currentCandidate.id)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCandidate || !decision || !feedback) return;

    try {
      await onSubmit({
        candidateId: currentCandidate.id,
        decision,
        feedback,
        overallRating,
        technicalSkills,
        culturalFit,
        communication,
      });
      setSubmittedIds(prev => new Set([...prev, currentCandidate.id]));

      // If more candidates remain, advance to next
      if (currentIndex < activeCandidates.length - 1) {
        setCurrentIndex(currentIndex + 1);
        resetForm();
      } else {
        // All candidates done
        onClose();
      }
    } catch {
      // Error handled by parent
    }
  };

  const isLastCandidate = currentIndex === activeCandidates.length - 1;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-y-auto max-h-[90vh]">
        <div className="p-8">
          <h2 className="text-2xl font-bold mb-2">Interview Feedback</h2>

          {/* Candidate stepper */}
          {activeCandidates.length > 1 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                {activeCandidates.map((c, idx) => {
                  const isSubmitted = submittedIds.has(c.id);
                  const isCurrent = idx === currentIndex;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setCurrentIndex(idx); resetForm(); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        isCurrent
                          ? 'bg-indigo-600 text-white shadow-md'
                          : isSubmitted
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {isSubmitted && <span>✓</span>}
                      <span>{c.name || `Candidate ${idx + 1}`}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500">
                Feedback for candidate {currentIndex + 1} of {activeCandidates.length}
                {isAlreadySubmitted && ' — Already submitted'}
              </p>
            </div>
          )}

          {/* Show existing feedback if already submitted */}
          {isAlreadySubmitted && existingFeedback ? (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-green-800 mb-1">Feedback Already Submitted</p>
                <p className="text-sm text-green-700">
                  Decision: <strong>{existingFeedback.decision === 'PROCEED' ? 'Proceed' : 'Reject'}</strong>
                </p>
                <p className="text-sm text-gray-600 mt-1">{existingFeedback.feedback}</p>
              </div>
              {activeCandidates.length > 1 && currentIndex < activeCandidates.length - 1 && (
                <button
                  type="button"
                  onClick={() => { setCurrentIndex(currentIndex + 1); resetForm(); }}
                  className="w-full px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                >
                  Next Candidate →
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Candidate name display */}
                {currentCandidate && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-blue-800">
                      📋 Evaluating: {currentCandidate.name || `Candidate ${currentIndex + 1}`}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-[#44546f] mb-2">Final Decision *</label>
                  <select
                    value={decision}
                    onChange={e => setDecision(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  >
                    <option value="">Select decision...</option>
                    <option value="PROCEED">Proceed to Screening</option>
                    <option value="REJECT">Reject Candidate</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-[#44546f] mb-2">Technical Skills (1-5)</label>
                    <input
                      type="number"
                      value={technicalSkills}
                      onChange={e => setTechnicalSkills(parseInt(e.target.value) || 3)}
                      min="1" max="5"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#44546f] mb-2">Cultural Fit (1-5)</label>
                    <input
                      type="number"
                      value={culturalFit}
                      onChange={e => setCulturalFit(parseInt(e.target.value) || 3)}
                      min="1" max="5"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#44546f] mb-2">Overall Feedback *</label>
                  <textarea
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    required
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none"
                    placeholder="Share your assessment of this candidate..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={processingAction}
                  className="flex-1 px-6 py-3 text-sm font-bold text-[#44546f] bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                {!isLastCandidate ? (
                  <button
                    type="submit"
                    disabled={processingAction || !decision || !feedback}
                    className="flex-1 px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {processingAction ? 'Submitting...' : 'Submit & Next Candidate →'}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={processingAction || !decision || !feedback}
                    className="flex-1 px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {processingAction ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterviewFeedbackModal;