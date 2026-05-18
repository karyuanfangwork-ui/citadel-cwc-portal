import { Request, Response, NextFunction } from 'express';
import * as aiService from '../services/crm-ai.service';

const handle = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export const crmAiController = {
  analyzeNote: handle(async (req, res) => {
    const result = await aiService.analyzeActivityNote(req.params.id as string);
    res.json(result);
  }),

  draftMessage: handle(async (req, res) => {
    const { entityType, channel, tone } = req.body as {
      entityType: 'lead' | 'contact';
      channel: 'whatsapp' | 'email';
      tone: 'formal' | 'friendly';
    };
    const result = await aiService.draftFollowUpMessage(entityType, req.params.id as string, channel, tone);
    res.json(result);
  }),

  leadSummary: handle(async (req, res) => {
    const result = await aiService.summarizeLead(req.params.id as string);
    res.json(result);
  }),

  leadScore: handle(async (req, res) => {
    const result = await aiService.scoreLead(req.params.id as string);
    res.json(result);
  }),

  winProbability: handle(async (req, res) => {
    const result = await aiService.predictWinProbability(req.params.id as string);
    res.json(result);
  }),

  dailyBriefing: handle(async (req, res) => {
    const userId = (req as any).user.id as string;
    const result = await aiService.generateDailyBriefing(userId);
    res.json(result);
  }),

  kycGaps: handle(async (req, res) => {
    const result = await aiService.detectKycGaps(req.params.id as string);
    res.json(result);
  }),

  riskProfile: handle(async (req, res) => {
    const result = await aiService.classifyRiskProfile(req.params.id as string);
    res.json(result);
  }),

  documentChecklist: handle(async (req, res) => {
    const result = await aiService.generateDocumentChecklist(req.params.id as string);
    res.json(result);
  }),

  managerBriefing: handle(async (_req, res) => {
    const result = await aiService.generateManagerBriefing();
    res.json({ status: 'success', data: result });
  }),

  winLossDebrief: handle(async (req, res) => {
    const debrief = await aiService.generateWinLossDebrief(req.params.id as string);
    res.json({ status: 'success', data: debrief });
  }),
};
