import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Credit Application Workflow — Steps & Transitions
// Mirrors the state machine defined in src/credit/services/creditApplication.service.ts
// ---------------------------------------------------------------------------

const WORKFLOW_CODE = 'CREDIT_APPLICATION';

interface StepDef {
  label: string;
  status: string;
  icon: string;
  isInitial?: boolean;
  isFinal?: boolean;
  slaPause?: boolean;
}

const STEPS: StepDef[] = [
  { label: 'Draft',            status: 'DRAFT',             icon: 'edit',              isInitial: true },
  { label: 'Submitted',        status: 'SUBMITTED',        icon: 'check_circle' },
  { label: 'KYC Review',       status: 'KYC_REVIEW',       icon: 'radio_button_checked', slaPause: true },
  { label: 'KYC Approved',     status: 'KYC_APPROVED',     icon: 'check_circle' },
  { label: 'KYC Rejected',     status: 'KYC_REJECTED',     icon: 'cancel' },
  { label: 'Underwriting',     status: 'UNDERWRITING',     icon: 'radio_button_checked', slaPause: true },
  { label: 'Credit Assessment',status: 'CREDIT_ASSESSMENT', icon: 'radio_button_checked', slaPause: true },
  { label: 'Committee Review', status: 'COMMITTEE_REVIEW', icon: 'radio_button_checked', slaPause: true },
  { label: 'Approved',         status: 'APPROVED',         icon: 'check_circle' },
  { label: 'Rejected',         status: 'REJECTED',         icon: 'cancel',            isFinal: true },
  { label: 'Offer',            status: 'OFFER',            icon: 'radio_button_checked' },
  { label: 'Accepted',         status: 'ACCEPTED',         icon: 'check_circle' },
  { label: 'Disbursed',       status: 'DISBURSED',         icon: 'radio_button_checked' },
  { label: 'Active',           status: 'ACTIVE',           icon: 'check_circle' },
  { label: 'Closed',           status: 'CLOSED',           icon: 'check_circle',       isFinal: true },
  { label: 'Withdrawn',        status: 'WITHDRAWN',         icon: 'cancel',            isFinal: true },
];

// Transition labels follow the existing convention: APPROVE | REJECT | SUBMIT | ADVANCE | RETURN | ESCALATE | CLOSE
interface TransitionDef {
  fromStatus: string;
  toStatus: string;
  transitionLabel: string;
  requiresComment: boolean;
}

const TRANSITIONS: TransitionDef[] = [
  // -- Happy path --
  { fromStatus: 'DRAFT',              toStatus: 'SUBMITTED',        transitionLabel: 'SUBMIT',   requiresComment: false },
  { fromStatus: 'SUBMITTED',         toStatus: 'KYC_REVIEW',       transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'KYC_REVIEW',        toStatus: 'KYC_APPROVED',     transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'KYC_REVIEW',        toStatus: 'KYC_REJECTED',     transitionLabel: 'REJECT',  requiresComment: true  },
  { fromStatus: 'KYC_APPROVED',      toStatus: 'UNDERWRITING',     transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'KYC_REJECTED',      toStatus: 'SUBMITTED',        transitionLabel: 'RETURN',  requiresComment: false }, // resubmit
  { fromStatus: 'UNDERWRITING',      toStatus: 'CREDIT_ASSESSMENT',transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'CREDIT_ASSESSMENT', toStatus: 'COMMITTEE_REVIEW', transitionLabel: 'SUBMIT',  requiresComment: false },
  { fromStatus: 'COMMITTEE_REVIEW', toStatus: 'APPROVED',         transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'COMMITTEE_REVIEW', toStatus: 'REJECTED',         transitionLabel: 'REJECT',  requiresComment: true  },
  { fromStatus: 'APPROVED',          toStatus: 'OFFER',            transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'OFFER',            toStatus: 'ACCEPTED',         transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'OFFER',            toStatus: 'REJECTED',         transitionLabel: 'REJECT',  requiresComment: true  }, // decline_offer
  { fromStatus: 'ACCEPTED',         toStatus: 'DISBURSED',         transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'DISBURSED',        toStatus: 'ACTIVE',           transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'ACTIVE',           toStatus: 'CLOSED',           transitionLabel: 'CLOSE',   requiresComment: false },

  // -- Withdraw from any non-terminal state --
  { fromStatus: 'DRAFT',              toStatus: 'WITHDRAWN',       transitionLabel: 'CLOSE',   requiresComment: true  },
  { fromStatus: 'SUBMITTED',         toStatus: 'WITHDRAWN',       transitionLabel: 'CLOSE',   requiresComment: true  },
  { fromStatus: 'KYC_REVIEW',        toStatus: 'WITHDRAWN',       transitionLabel: 'CLOSE',   requiresComment: true  },
  { fromStatus: 'KYC_APPROVED',      toStatus: 'WITHDRAWN',       transitionLabel: 'CLOSE',   requiresComment: true  },
  { fromStatus: 'KYC_REJECTED',      toStatus: 'WITHDRAWN',       transitionLabel: 'CLOSE',   requiresComment: true  },
  { fromStatus: 'UNDERWRITING',      toStatus: 'WITHDRAWN',       transitionLabel: 'CLOSE',   requiresComment: true  },
  { fromStatus: 'CREDIT_ASSESSMENT', toStatus: 'WITHDRAWN',       transitionLabel: 'CLOSE',   requiresComment: true  },
  { fromStatus: 'COMMITTEE_REVIEW',  toStatus: 'WITHDRAWN',       transitionLabel: 'CLOSE',   requiresComment: true  },
  { fromStatus: 'APPROVED',          toStatus: 'WITHDRAWN',       transitionLabel: 'CLOSE',   requiresComment: true  },
  { fromStatus: 'OFFER',            toStatus: 'WITHDRAWN',       transitionLabel: 'CLOSE',   requiresComment: true  },
  { fromStatus: 'ACCEPTED',         toStatus: 'WITHDRAWN',       transitionLabel: 'CLOSE',   requiresComment: true  },
];

async function main() {
  console.log('🏗️  Seeding credit application workflow...');

  // ── 1. Upsert WorkflowType ──────────────────────────────────────────────────
  const workflowType = await prisma.workflowType.upsert({
    where: { code: WORKFLOW_CODE },
    update: {
      name: 'Credit Application',
      description: 'Credit application lifecycle workflow — mirrors the state machine in creditApplication.service.ts',
      isActive: true,
      displayOrder: 20,
    },
    create: {
      name: 'Credit Application',
      code: WORKFLOW_CODE,
      description: 'Credit application lifecycle workflow — mirrors the state machine in creditApplication.service.ts',
      isActive: true,
      displayOrder: 20,
    },
  });
  console.log(`  ✅ WorkflowType [${WORKFLOW_CODE}] → ${workflowType.id}`);

  // ── 2. Sync WorkflowSteps ──────────────────────────────────────────────────
  const existingSteps = await prisma.workflowStep.findMany({
    where: { workflowTypeId: workflowType.id },
  });

  // Remove steps that no longer belong
  const seedStatuses = STEPS.map(s => s.status);
  const extraSteps = existingSteps.filter(s => !seedStatuses.includes(s.status));
  for (const step of extraSteps) {
    await prisma.workflowStep.delete({ where: { id: step.id } });
  }
  if (extraSteps.length > 0) {
    console.log(`  🧹 Pruned ${extraSteps.length} stale step(s): ${extraSteps.map(s => s.status).join(', ')}`);
  }

  // Upsert each step
  for (let i = 0; i < STEPS.length; i++) {
    const def = STEPS[i];
    const existing = existingSteps.find(s => s.status === def.status);

    const data = {
      label: def.label,
      icon: def.icon,
      displayOrder: i + 1,
      isInitial: def.isInitial ?? false,
      isFinal: def.isFinal ?? false,
      slaPause: def.slaPause ?? false,
    };

    if (existing) {
      await prisma.workflowStep.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.workflowStep.create({
        data: {
          workflowTypeId: workflowType.id,
          status: def.status,
          ...data,
        },
      });
    }
  }
  console.log(`  ✅ Synced ${STEPS.length} workflow steps`);

  // ── 3. Seed WorkflowTransitions ─────────────────────────────────────────────
  // Use upsert on the unique (fromStatus, toStatus) pair.
  // Never overwrites admin-edited transitions — only creates missing ones.
  let created = 0;
  let updated = 0;

  for (const t of TRANSITIONS) {
    const existing = await prisma.workflowTransition.findUnique({
      where: {
        fromStatus_toStatus: {
          fromStatus: t.fromStatus,
          toStatus: t.toStatus,
        },
      },
    });

    if (existing) {
      // Only refresh the label & requiresComment; don't touch isActive or auto-assign hints
      // that an admin may have customised.
      await prisma.workflowTransition.update({
        where: { id: existing.id },
        data: {
          transitionLabel: t.transitionLabel,
          requiresComment: t.requiresComment,
        },
      });
      updated++;
    } else {
      await prisma.workflowTransition.create({
        data: {
          fromStatus: t.fromStatus,
          toStatus: t.toStatus,
          transitionLabel: t.transitionLabel,
          requiresComment: t.requiresComment,
          isActive: true,
        },
      });
      created++;
    }
  }
  console.log(`  ✅ Transitions: ${created} created, ${updated} updated (${TRANSITIONS.length} total)`);

  console.log('✅ Credit application workflow seeded');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });