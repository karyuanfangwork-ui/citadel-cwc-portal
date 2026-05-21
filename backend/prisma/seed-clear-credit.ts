/**
 * Seed: Clear all Credit Module data
 *
 * Deletes all credit-related records in FK-safe order.
 * Run: npx tsx prisma/seed-clear-credit.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing all Credit Module data...');

  // Delete in reverse-FK order (deepest children first)

  // --- Sprint 5: Monitoring ---
  console.log('  Deleting covenant tests...');
  const ct = await prisma.covenantTest.deleteMany({});
  console.log(`    ✅ ${ct.count} covenant tests deleted`);

  console.log('  Deleting covenant definitions...');
  const cd = await prisma.covenantDefinition.deleteMany({});
  console.log(`    ✅ ${cd.count} covenant definitions deleted`);

  console.log('  Deleting payment events...');
  const pe = await prisma.paymentEvent.deleteMany({});
  console.log(`    ✅ ${pe.count} payment events deleted`);

  console.log('  Deleting early warning signals...');
  const ew = await prisma.earlyWarningSignal.deleteMany({});
  console.log(`    ✅ ${ew.count} early warning signals deleted`);

  console.log('  Deleting facility health...');
  const fh = await prisma.facilityHealth.deleteMany({});
  console.log(`    ✅ ${fh.count} facility health records deleted`);

  // --- Sprint 4: Committee ---
  console.log('  Deleting committee votes...');
  const cv = await prisma.committeeVote.deleteMany({});
  console.log(`    ✅ ${cv.count} committee votes deleted`);

  console.log('  Deleting committee agenda items...');
  const ai = await prisma.committeeAgendaItem.deleteMany({});
  console.log(`    ✅ ${ai.count} agenda items deleted`);

  console.log('  Deleting committee members...');
  const cm = await prisma.committeeMember.deleteMany({});
  console.log(`    ✅ ${cm.count} committee members deleted`);

  console.log('  Deleting committee meetings...');
  const cmt = await prisma.committeeMeeting.deleteMany({});
  console.log(`    ✅ ${cmt.count} committee meetings deleted`);

  // --- Sprint 3: Scorecard ---
  console.log('  Deleting credit score runs...');
  const sr = await prisma.creditScoreRun.deleteMany({});
  console.log(`    ✅ ${sr.count} score runs deleted`);

  console.log('  Deleting credit scorecard versions...');
  const sv = await prisma.creditScorecardVersion.deleteMany({});
  console.log(`    ✅ ${sv.count} scorecard versions deleted`);

  console.log('  Deleting credit scorecards...');
  const sc = await prisma.creditScorecard.deleteMany({});
  console.log(`    ✅ ${sc.count} scorecards deleted`);

  // --- Financial statements ---
  console.log('  Deleting financial ratios...');
  const fr = await prisma.financialRatio.deleteMany({});
  console.log(`    ✅ ${fr.count} financial ratios deleted`);

  console.log('  Deleting financial line items...');
  const fl = await prisma.financialLineItem.deleteMany({});
  console.log(`    ✅ ${fl.count} financial line items deleted`);

  console.log('  Deleting financial statements...');
  const fs = await prisma.financialStatement.deleteMany({});
  console.log(`    ✅ ${fs.count} financial statements deleted`);

  // --- Approval matrix ---
  console.log('  Deleting credit approval matrix versions...');
  const mv = await prisma.creditApprovalMatrixVersion.deleteMany({});
  console.log(`    ✅ ${mv.count} matrix versions deleted`);

  console.log('  Deleting credit approval matrices...');
  const mx = await prisma.creditApprovalMatrix.deleteMany({});
  console.log(`    ✅ ${mx.count} approval matrices deleted`);

  // --- Application-level children (deepest first) ---
  console.log('  Deleting conditions...');
  const cond = await prisma.condition.deleteMany({});
  console.log(`    ✅ ${cond.count} conditions deleted`);

  console.log('  Deleting credit decisions...');
  const dec = await prisma.creditDecision.deleteMany({});
  console.log(`    ✅ ${dec.count} decisions deleted`);

  console.log('  Deleting credit audit events...');
  const ae = await prisma.creditAuditEvent.deleteMany({});
  console.log(`    ✅ ${ae.count} audit events deleted`);

  console.log('  Deleting document requirements...');
  const dr = await prisma.documentRequirement.deleteMany({});
  console.log(`    ✅ ${dr.count} document requirements deleted`);

  console.log('  Deleting credit document versions...');
  const dv = await prisma.creditDocumentVersion.deleteMany({});
  console.log(`    ✅ ${dv.count} document versions deleted`);

  console.log('  Deleting credit documents...');
  const doc = await prisma.creditDocument.deleteMany({});
  console.log(`    ✅ ${doc.count} documents deleted`);

  console.log('  Deleting application parties...');
  const ap = await prisma.applicationParty.deleteMany({});
  console.log(`    ✅ ${ap.count} application parties deleted`);

  // --- Collateral children then collateral ---
  console.log('  Deleting insurance covers...');
  const ic = await prisma.insuranceCover.deleteMany({});
  console.log(`    ✅ ${ic.count} insurance covers deleted`);

  console.log('  Deleting collateral liens...');
  const cl = await prisma.collateralLien.deleteMany({});
  console.log(`    ✅ ${cl.count} collateral liens deleted`);

  console.log('  Deleting collateral valuations...');
  const cvl = await prisma.collateralValuation.deleteMany({});
  console.log(`    ✅ ${cvl.count} collateral valuations deleted`);

  console.log('  Deleting guarantees...');
  const gu = await prisma.guarantee.deleteMany({});
  console.log(`    ✅ ${gu.count} guarantees deleted`);

  console.log('  deleting collaterals...');
  const col = await prisma.collateral.deleteMany({});
  console.log(`    ✅ ${col.count} collaterals deleted`);

  // --- Facilities ---
  console.log('  Deleting application facilities...');
  const af = await prisma.applicationFacility.deleteMany({});
  console.log(`    ✅ ${af.count} facilities deleted`);

  // --- Credit applications ---
  console.log('  Deleting credit applications...');
  const ca = await prisma.creditApplication.deleteMany({});
  console.log(`    ✅ ${ca.count} credit applications deleted`);

  // --- Borrower profile children ---
  console.log('  Deleting related party members...');
  const rpm = await prisma.relatedPartyMember.deleteMany({});
  console.log(`    ✅ ${rpm.count} related party members deleted`);

  console.log('  Deleting related party groups...');
  const rpg = await prisma.relatedPartyGroup.deleteMany({});
  console.log(`    ✅ ${rpg.count} related party groups deleted`);

  console.log('  Deleting ultimate beneficial owners...');
  const ubo = await prisma.ultimateBeneficialOwner.deleteMany({});
  console.log(`    ✅ ${ubo.count} UBOs deleted`);

  console.log('  Deleting shareholders...');
  const sh = await prisma.shareholder.deleteMany({});
  console.log(`    ✅ ${sh.count} shareholders deleted`);

  console.log('  Deleting directors...');
  const dir = await prisma.director.deleteMany({});
  console.log(`    ✅ ${dir.count} directors deleted`);

  // --- Borrower profiles (must come after their children) ---
  console.log('  Deleting borrower profiles...');
  const bp = await prisma.borrowerProfile.deleteMany({});
  console.log(`    ✅ ${bp.count} borrower profiles deleted`);

  // --- Credit app counter (reset) ---
  console.log('  Resetting credit app counter...');
  const cc = await prisma.creditAppCounter.deleteMany({});
  console.log(`    ✅ ${cc.count} counter(s) reset`);

  // --- PII read logs ---
  console.log('  Deleting PII read logs...');
  const pii = await prisma.piiReadLog.deleteMany({});
  console.log(`    ✅ ${pii.count} PII read logs deleted`);

  // --- Feature flags (keep — these are config, not demo data) ---
  // NOT deleting feature flags — they are admin config

  console.log('✅ All Credit Module data cleared!');
}

main()
  .catch((e) => {
    console.error('❌ Clear failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });