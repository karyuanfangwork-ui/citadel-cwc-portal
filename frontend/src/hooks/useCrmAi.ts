import { useState, useCallback } from 'react';
import crmService from '../services/crm.service';

// ── Note Analyzer ─────────────────────────────────────────────────────────────
export type NoteAnalysis = {
  sentiment: 'positive' | 'neutral' | 'negative';
  nextAction: string;
  suggestedStatusChange: string | null;
  keyFacts: string[];
};

export function useAnalyzeNote() {
  const [results, setResults] = useState<Record<string, NoteAnalysis>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const analyze = useCallback(async (activityId: string) => {
    setLoadingId(activityId);
    try {
      const result = await crmService.analyzeActivityNote(activityId);
      setResults((prev) => ({ ...prev, [activityId]: result }));
    } catch { /* fail silently */ }
    finally { setLoadingId(null); }
  }, []);

  return { results, loadingId, analyze };
}

// ── Draft Message ─────────────────────────────────────────────────────────────
export type DraftResult = { subject: string | null; body: string };

export function useDraftMessage() {
  const [result, setResult] = useState<DraftResult | null>(null);
  const [loading, setLoading] = useState(false);

  const draftForLead = useCallback(async (
    leadId: string,
    payload: { channel: 'whatsapp' | 'email'; tone: 'formal' | 'friendly' },
  ) => {
    setLoading(true); setResult(null);
    try { setResult(await crmService.draftLeadMessage(leadId, payload)); }
    catch { /* fail silently */ }
    finally { setLoading(false); }
  }, []);

  const draftForContact = useCallback(async (
    contactId: string,
    payload: { channel: 'whatsapp' | 'email'; tone: 'formal' | 'friendly' },
  ) => {
    setLoading(true); setResult(null);
    try { setResult(await crmService.draftContactMessage(contactId, payload)); }
    catch { /* fail silently */ }
    finally { setLoading(false); }
  }, []);

  return { result, loading, draftForLead, draftForContact };
}

// ── Lead Summary ──────────────────────────────────────────────────────────────
export type LeadSummary = { statusSummary: string; keyFacts: string; recommendedNextStep: string };

export function useLeadSummary() {
  const [summary, setSummary] = useState<LeadSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (leadId: string) => {
    setLoading(true);
    try { setSummary(await crmService.getLeadSummary(leadId)); }
    catch { /* fail silently */ }
    finally { setLoading(false); }
  }, []);

  return { summary, loading, fetch };
}

// ── Lead Score ────────────────────────────────────────────────────────────────
export type LeadScore = { score: number; reason: string };

export function useLeadScore() {
  const [scoreData, setScoreData] = useState<LeadScore | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (leadId: string) => {
    setLoading(true);
    try { setScoreData(await crmService.getLeadScore(leadId)); }
    catch { /* fail silently */ }
    finally { setLoading(false); }
  }, []);

  return { scoreData, loading, fetch };
}

// ── Win Probability ───────────────────────────────────────────────────────────
export type WinProbability = { probability: number; confidence: 'high' | 'medium' | 'low'; reason: string };

export function useWinProbability() {
  const [data, setData] = useState<WinProbability | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (opportunityId: string) => {
    setLoading(true);
    try { setData(await crmService.getWinProbability(opportunityId)); }
    catch { /* fail silently */ }
    finally { setLoading(false); }
  }, []);

  return { data, loading, fetch };
}

// ── Daily Briefing ────────────────────────────────────────────────────────────
export type DailyBriefing = { headline: string; bullets: string[]; topPriority: string };

export function useDailyBriefing() {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setBriefing(await crmService.getDailyBriefing()); }
    catch { setError('Could not generate briefing'); }
    finally { setLoading(false); }
  }, []);

  return { briefing, loading, error, fetch };
}

// ── KYC Gap Detector ──────────────────────────────────────────────────────────
export type KycGaps = {
  gaps: Array<{ field: string; requirement: string; severity: 'required' | 'recommended' }>;
  complianceSummary: string;
  isCompliant: boolean;
};

export function useKycGaps() {
  const [data, setData] = useState<KycGaps | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (contactId: string) => {
    setLoading(true);
    try { setData(await crmService.getKycGaps(contactId)); }
    catch { /* fail silently */ }
    finally { setLoading(false); }
  }, []);

  return { data, loading, fetch };
}

// ── Risk Profile ──────────────────────────────────────────────────────────────
export type RiskProfile = { suggestedRiskTier: 'Low' | 'Medium' | 'High'; justification: string; regulatoryBasis: string };

export function useRiskProfile() {
  const [data, setData] = useState<RiskProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (contactId: string) => {
    setLoading(true);
    try { setData(await crmService.getRiskProfile(contactId)); }
    catch { /* fail silently */ }
    finally { setLoading(false); }
  }, []);

  return { data, loading, fetch };
}

// ── Document Checklist ────────────────────────────────────────────────────────
export type DocumentChecklist = {
  documents: Array<{ name: string; description: string; required: boolean }>;
  notes: string;
};

export function useDocumentChecklist() {
  const [data, setData] = useState<DocumentChecklist | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (trustProductId: string) => {
    setLoading(true);
    try { setData(await crmService.getDocumentChecklist(trustProductId)); }
    catch { /* fail silently */ }
    finally { setLoading(false); }
  }, []);

  return { data, loading, fetch };
}
