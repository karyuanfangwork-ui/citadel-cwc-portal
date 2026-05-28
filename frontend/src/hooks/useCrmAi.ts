import { useState, useCallback } from 'react';
import crmService from '../services/crm.service';

// ── Note Analyzer ─────────────────────────────────────────────────────────────
export type NoteAnalysis = {
  sentiment: 'positive' | 'neutral' | 'negative';
  nextAction: string;
  suggestedStatusChange: string | null;
  keyFacts: string[];
  suggestedFollowUpDays?: number | null;
};

export function useAnalyzeNote() {
  const [results, setResults] = useState<Record<string, NoteAnalysis>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (activityId: string) => {
    setLoadingId(activityId);
    setError(null);
    try {
      const result = await crmService.analyzeActivityNote(activityId);
      setResults((prev) => ({ ...prev, [activityId]: result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI feature unavailable');
    } finally { setLoadingId(null); }
  }, []);

  return { results, loadingId, error, analyze };
}

// ── Draft Message ─────────────────────────────────────────────────────────────
export type DraftResult = { subject: string | null; body: string };

export function useDraftMessage() {
  const [result, setResult] = useState<DraftResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftForLead = useCallback(async (
    leadId: string,
    payload: { channel: 'whatsapp' | 'email'; tone: 'formal' | 'friendly' },
  ) => {
    setLoading(true); setResult(null); setError(null);
    try { setResult(await crmService.draftLeadMessage(leadId, payload)); }
    catch (err) { setError(err instanceof Error ? err.message : 'AI feature unavailable'); }
    finally { setLoading(false); }
  }, []);

  const draftForContact = useCallback(async (
    contactId: string,
    payload: { channel: 'whatsapp' | 'email'; tone: 'formal' | 'friendly' },
  ) => {
    setLoading(true); setResult(null); setError(null);
    try { setResult(await crmService.draftContactMessage(contactId, payload)); }
    catch (err) { setError(err instanceof Error ? err.message : 'AI feature unavailable'); }
    finally { setLoading(false); }
  }, []);

  return { result, loading, error, draftForLead, draftForContact };
}

// ── Lead Summary ──────────────────────────────────────────────────────────────
export type LeadSummary = { statusSummary: string; keyFacts: string; recommendedNextStep: string };

export function useLeadSummary() {
  const [summary, setSummary] = useState<LeadSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (leadId: string) => {
    setLoading(true); setError(null);
    try { setSummary(await crmService.getLeadSummary(leadId)); }
    catch (err) { setError(err instanceof Error ? err.message : 'AI feature unavailable'); }
    finally { setLoading(false); }
  }, []);

  return { summary, loading, error, fetch };
}

// ── Lead Score ────────────────────────────────────────────────────────────────
export type LeadScore = { score: number; reason: string };

export function useLeadScore() {
  const [scoreData, setScoreData] = useState<LeadScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (leadId: string) => {
    setLoading(true); setError(null);
    try { setScoreData(await crmService.getLeadScore(leadId)); }
    catch (err) { setError(err instanceof Error ? err.message : 'AI feature unavailable'); }
    finally { setLoading(false); }
  }, []);

  return { scoreData, loading, error, fetch };
}

// ── Win Probability ───────────────────────────────────────────────────────────
export type WinProbability = { probability: number; confidence: 'high' | 'medium' | 'low'; reason: string };

export function useWinProbability() {
  const [data, setData] = useState<WinProbability | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (opportunityId: string) => {
    setLoading(true); setError(null);
    try { setData(await crmService.getWinProbability(opportunityId)); }
    catch (err) { setError(err instanceof Error ? err.message : 'AI feature unavailable'); }
    finally { setLoading(false); }
  }, []);

  return { data, loading, error, fetch };
}

// ── Daily Briefing ────────────────────────────────────────────────────────────
export type DailyBriefing = { headline: string; bullets: string[]; topPriority: string };

const BRIEFING_CACHE_KEY = 'crm_daily_briefing_v1';

export function useDailyBriefing() {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    // Check sessionStorage cache for today
    try {
      const cached = sessionStorage.getItem(BRIEFING_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.date === new Date().toISOString().slice(0, 10)) {
          setBriefing(parsed.briefing);
          setLoading(false);
          return;
        }
      }
    } catch {}
    // Fetch from API
    try {
      const result = await crmService.getDailyBriefing();
      setBriefing(result);
      sessionStorage.setItem(BRIEFING_CACHE_KEY, JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        briefing: result,
      }));
    } catch { setError('Could not generate briefing'); }
    finally { setLoading(false); }
  }, []);

  return { briefing, loading, error, fetch };
}

// ── Win/Loss Debrief ─────────────────────────────────────────────────────────
export type WinLossDebrief = {
  outcome: 'WON' | 'LOST';
  summary: string;
  keyFactors: string[];
  lessonsLearned: string[];
  followOnActions: string[];
};

export function useWinLossDebrief() {
  const [data, setData] = useState<WinLossDebrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (opportunityId: string) => {
    setLoading(true); setError(null);
    try { setData(await crmService.getWinLossDebrief(opportunityId)); }
    catch (err) { setError(err instanceof Error ? err.message : 'AI feature unavailable'); }
    finally { setLoading(false); }
  }, []);

  return { data, loading, error, fetch };
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
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (contactId: string) => {
    setLoading(true); setError(null);
    try { setData(await crmService.getKycGaps(contactId)); }
    catch (err) { setError(err instanceof Error ? err.message : 'AI feature unavailable'); }
    finally { setLoading(false); }
  }, []);

  return { data, loading, error, fetch };
}

// ── Risk Profile ──────────────────────────────────────────────────────────────
export type RiskProfile = { suggestedRiskTier: 'Low' | 'Medium' | 'High'; justification: string; regulatoryBasis: string };

export function useRiskProfile() {
  const [data, setData] = useState<RiskProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (contactId: string) => {
    setLoading(true); setError(null);
    try { setData(await crmService.getRiskProfile(contactId)); }
    catch (err) { setError(err instanceof Error ? err.message : 'AI feature unavailable'); }
    finally { setLoading(false); }
  }, []);

  return { data, loading, error, fetch };
}

// ── Document Checklist ────────────────────────────────────────────────────────
export type DocumentChecklist = {
  documents: Array<{ name: string; description: string; required: boolean }>;
  notes: string;
};

export function useDocumentChecklist() {
  const [data, setData] = useState<DocumentChecklist | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (trustProductId: string) => {
    setLoading(true); setError(null);
    try { setData(await crmService.getDocumentChecklist(trustProductId)); }
    catch (err) { setError(err instanceof Error ? err.message : 'AI feature unavailable'); }
    finally { setLoading(false); }
  }, []);

  return { data, loading, error, fetch };
}

// ── Next Best Action ──────────────────────────────────────────────────────────
export type NextBestAction = {
  actions: Array<{ action: string; priority: 'high' | 'medium' | 'low'; reason: string }>;
};

export function useNextBestAction() {
  const [data, setData] = useState<NextBestAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (entityType: string, entityId: string) => {
    setLoading(true); setData(null); setError(null);
    try { setData(await crmService.getNextBestAction(entityType, entityId)); }
    catch (err) { setError(err instanceof Error ? err.message : 'AI feature unavailable'); }
    finally { setLoading(false); }
  }, []);

  return { data, loading, error, fetch };
}