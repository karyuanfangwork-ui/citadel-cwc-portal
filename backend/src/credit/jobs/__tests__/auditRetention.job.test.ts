import prisma from '../../../utils/prisma';
import { AuditChainService } from '../../services/auditChain.service';
import { auditBrokenApplications, auditCheckSuccess, auditAlertDeliverySuccess } from '../../../middleware/metrics';
import { checkAuditRetention, runAuditRetentionCheck } from '../auditRetention.job';
import { sendEmail } from '../../../services/email.service';

jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditAuditEvent: { count: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    earlyWarningSignal: { findFirst: jest.fn(), create: jest.fn() },
  },
}));
jest.mock('../../services/auditChain.service', () => ({
  AuditChainService: { verifyChain: jest.fn() },
}));
jest.mock('../../../middleware/metrics', () => ({
  auditBrokenApplications: { set: jest.fn() },
  auditCheckSuccess: { set: jest.fn() },
  auditAlertDeliverySuccess: { set: jest.fn() },
}));
jest.mock('../../../services/email.service', () => ({ sendEmail: jest.fn() }));

const db = prisma as unknown as {
  creditAuditEvent: { count: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
  earlyWarningSignal: { findFirst: jest.Mock; create: jest.Mock };
};
const verify = AuditChainService.verifyChain as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.AUDIT_ALERT_EMAIL = 'oncall@example.test';
  (sendEmail as jest.Mock).mockResolvedValue(true);
  db.creditAuditEvent.count.mockResolvedValue(0);
  db.creditAuditEvent.findFirst.mockResolvedValue(null);
  db.creditAuditEvent.findMany.mockResolvedValue([{ applicationId: 'app-1' }, { applicationId: 'app-2' }]);
  db.earlyWarningSignal.findFirst.mockResolvedValue(null);
  db.earlyWarningSignal.create.mockResolvedValue({ id: 'signal-1' });
  verify.mockResolvedValue({ valid: true });
});
afterEach(() => { delete process.env.AUDIT_ALERT_EMAIL; });

describe('audit retention integrity monitoring', () => {
  it('counts first failures rather than all events in broken chains and deduplicates signals', async () => {
    db.creditAuditEvent.count.mockImplementation(async (args?: unknown) => args ? 0 : 13);
    verify.mockResolvedValueOnce({ valid: false, brokenAt: 'event-1' })
      .mockResolvedValueOnce({ valid: false, brokenAt: 'event-2' });
    db.earlyWarningSignal.findFirst.mockResolvedValueOnce({ id: 'existing' }).mockResolvedValueOnce(null);

    const report = await runAuditRetentionCheck();

    expect(report).toMatchObject({
      totalEvents: 13, applicationsWithBrokenChains: 2, firstBrokenEvents: 2,
      chainValid: false,
    });
    expect(db.creditAuditEvent.count).toHaveBeenCalledTimes(2);
    expect(db.earlyWarningSignal.create).toHaveBeenCalledTimes(1);
    expect(db.earlyWarningSignal.create.mock.calls[0][0].data.description).not.toMatch(/npm run audit:reseal/);
    expect(auditBrokenApplications.set).toHaveBeenCalledWith(2);
    expect(auditCheckSuccess.set).toHaveBeenCalledWith(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(auditAlertDeliverySuccess.set).toHaveBeenCalledWith(1);
    expect(sendEmail).toHaveBeenCalledWith('oncall@example.test', expect.stringContaining('BROKEN'),
      expect.stringContaining('2 applications'), expect.any(Object));
    expect(JSON.stringify((sendEmail as jest.Mock).mock.calls)).not.toContain('app-1');
  });

  it('clears aggregate on a subsequent intact run without closing incident signals', async () => {
    const report = await runAuditRetentionCheck();
    expect(report.chainValid).toBe(true);
    expect(auditBrokenApplications.set).toHaveBeenCalledWith(0);
    expect(db.earlyWarningSignal.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('marks a failed check unsuccessful and propagates the error without publishing a false zero', async () => {
    verify.mockRejectedValue(new Error('database unavailable'));
    await expect(runAuditRetentionCheck()).rejects.toThrow('database unavailable');
    expect(auditCheckSuccess.set).toHaveBeenCalledWith(0);
    expect(auditBrokenApplications.set).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledWith('oncall@example.test', expect.stringContaining('FAILED'),
      expect.stringContaining('did not complete'), expect.any(Object));
  });

  it('preserves the broken-chain report when alert delivery fails', async () => {
    verify.mockResolvedValueOnce({ valid: false, brokenAt: 'event-1' });
    (sendEmail as jest.Mock).mockResolvedValue(false);
    const report = await runAuditRetentionCheck();
    expect(report.chainValid).toBe(false);
    expect(auditBrokenApplications.set).toHaveBeenCalledWith(1);
    expect(auditAlertDeliverySuccess.set).toHaveBeenCalledWith(0);
  });

  it('does not send to an absent or invalid alert destination', async () => {
    verify.mockResolvedValueOnce({ valid: false, brokenAt: 'event-1' });
    delete process.env.AUDIT_ALERT_EMAIL;
    await runAuditRetentionCheck();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(auditAlertDeliverySuccess.set).toHaveBeenCalledWith(0);

    verify.mockResolvedValueOnce({ valid: false, brokenAt: 'event-1' });
    process.env.AUDIT_ALERT_EMAIL = 'not-an-email';
    await runAuditRetentionCheck();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does not report success if signal persistence fails', async () => {
    verify.mockResolvedValueOnce({ valid: false, brokenAt: 'event-1' });
    db.earlyWarningSignal.create.mockRejectedValue(new Error('signal store unavailable'));
    await expect(runAuditRetentionCheck()).rejects.toThrow('signal store unavailable');
    expect(auditCheckSuccess.set).toHaveBeenCalledWith(0);
  });
});
