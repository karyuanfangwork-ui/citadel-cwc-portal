import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const FINANCE_TENANT_ID = "00000000-0000-0000-0000-000000000001";
export const FINANCE_WORKFLOW_CODE = "FINANCE";

export type ScopedTransitionDefinition = {
  fromStatus: string;
  toStatus: string;
  transitionLabel: string;
  requiresComment: boolean;
  allowedRoles: string[];
  allowedExecutiveRoles: string[];
};

/** The Finance-scoped rows required for the CEO-first Purchase Requisition lane. */
export const FINANCE_RECTIFICATION_TRANSITIONS: readonly ScopedTransitionDefinition[] =
  [
    {
      fromStatus: "FINANCE_ACKNOWLEDGED",
      toStatus: "PENDING_CEO_APPROVAL_FIN",
      transitionLabel: "SUBMIT",
      requiresComment: false,
      allowedRoles: [],
      allowedExecutiveRoles: [],
    },
    {
      fromStatus: "PENDING_CEO_APPROVAL_FIN",
      toStatus: "PENDING_CFO_APPROVAL_FIN",
      transitionLabel: "ADVANCE",
      requiresComment: false,
      allowedRoles: [],
      allowedExecutiveRoles: ["CEO"],
    },
    {
      fromStatus: "PENDING_CEO_APPROVAL_FIN",
      toStatus: "CEO_REJECTED_FIN",
      transitionLabel: "REJECT",
      requiresComment: true,
      allowedRoles: [],
      allowedExecutiveRoles: [],
    },
  ];

export const EXISTING_CFO_BYPASS = {
  fromStatus: "FINANCE_ACKNOWLEDGED",
  toStatus: "PENDING_CFO_APPROVAL_FIN",
} as const;

export type ExistingTransition = Pick<
  ScopedTransitionDefinition,
  | "fromStatus"
  | "toStatus"
  | "requiresComment"
  | "allowedRoles"
  | "allowedExecutiveRoles"
> & { transitionLabel: string | null; isActive: boolean };

export type RectificationPlan = {
  actions: Array<{
    action: "CREATE" | "UPDATE" | "UNCHANGED";
    transition: ScopedTransitionDefinition;
  }>;
  bypass: {
    exists: boolean;
    active: boolean;
    retain: true;
    recommendation: "RETAIN_GLOBAL_FOR_OTHER_WORKFLOWS_FINANCE_SCOPED_ROUTE_TAKES_PRECEDENCE";
  };
};

export function planFinanceRectification(
  existing: ExistingTransition[],
  existingBypass?: { isActive: boolean } | null,
): RectificationPlan {
  const actions = FINANCE_RECTIFICATION_TRANSITIONS.map((transition) => {
    const row = existing.find(
      (candidate) =>
        candidate.fromStatus === transition.fromStatus &&
        candidate.toStatus === transition.toStatus,
    );
    if (!row) return { action: "CREATE" as const, transition };
    const unchanged =
      row.transitionLabel === transition.transitionLabel &&
      row.requiresComment === transition.requiresComment &&
      row.isActive &&
      JSON.stringify(row.allowedRoles) ===
        JSON.stringify(transition.allowedRoles) &&
      JSON.stringify(row.allowedExecutiveRoles) ===
        JSON.stringify(transition.allowedExecutiveRoles);
    return {
      action: unchanged ? ("UNCHANGED" as const) : ("UPDATE" as const),
      transition,
    };
  });

  return {
    actions,
    bypass: {
      exists: Boolean(existingBypass),
      active: Boolean(existingBypass?.isActive),
      // The global row is still used by ESM Travel. The Finance-scoped CEO
      // route takes precedence, so this rectification does not deactivate it.
      retain: true,
      recommendation:
        "RETAIN_GLOBAL_FOR_OTHER_WORKFLOWS_FINANCE_SCOPED_ROUTE_TAKES_PRECEDENCE",
    },
  };
}

async function main() {
  const writeMode = process.argv.includes("--write");
  const shadowMode = process.argv.includes("--shadow") || !writeMode;
  if (writeMode && !process.argv.includes("--approve-local-finance-rectification")) {
    throw new Error(
      "Refusing Finance transition writes. Re-run with --write --approve-local-finance-rectification after reviewing the shadow output.",
    );
  }
  if (writeMode && process.argv.includes("--shadow")) {
    throw new Error(
      "Choose exactly one mode: --shadow (or default) or --write",
    );
  }

  const workflowType = await prisma.workflowType.findUnique({
    where: { code: FINANCE_WORKFLOW_CODE },
    select: { id: true, code: true },
  });
  if (!workflowType)
    throw new Error(`${FINANCE_WORKFLOW_CODE} workflow type was not found`);

  const existingRows = await prisma.workflowTransition.findMany({
    where: {
      tenantId: FINANCE_TENANT_ID,
      workflowTypeId: workflowType.id,
      OR: FINANCE_RECTIFICATION_TRANSITIONS.map(({ fromStatus, toStatus }) => ({
        fromStatus,
        toStatus,
      })),
    },
    select: {
      fromStatus: true,
      toStatus: true,
      transitionLabel: true,
      requiresComment: true,
      allowedRoles: true,
      allowedExecutiveRoles: true,
      isActive: true,
    },
  });
  const existingBypasses = await prisma.workflowTransition.findMany({
    where: {
      fromStatus: EXISTING_CFO_BYPASS.fromStatus,
      toStatus: EXISTING_CFO_BYPASS.toStatus,
      OR: [
        { tenantId: FINANCE_TENANT_ID, workflowTypeId: workflowType.id },
        { tenantId: null, workflowTypeId: null },
      ],
    },
    select: { tenantId: true, workflowTypeId: true, isActive: true },
  });
  const existingBypass =
    existingBypasses.find(
      (row) =>
        row.tenantId === FINANCE_TENANT_ID &&
        row.workflowTypeId === workflowType.id,
    ) ??
    existingBypasses.find(
      (row) => row.tenantId === null && row.workflowTypeId === null,
    );
  const plan = planFinanceRectification(existingRows, existingBypass);

  console.log(
    JSON.stringify(
      {
        mode: writeMode ? "write" : shadowMode ? "shadow" : "shadow",
        writePerformed: false,
        tenantId: FINANCE_TENANT_ID,
        workflowType: workflowType.code,
        transitions: plan.actions,
        existingCfoBypass: {
          ...plan.bypass,
          pair: `${EXISTING_CFO_BYPASS.fromStatus} → ${EXISTING_CFO_BYPASS.toStatus}`,
          scope: existingBypass
            ? existingBypass.tenantId === null &&
              existingBypass.workflowTypeId === null
              ? "global"
              : "finance-scoped"
            : null,
        },
      },
      null,
      2,
    ),
  );

  if (!writeMode) return;

  await prisma.$transaction(async (tx) => {
    for (const transition of FINANCE_RECTIFICATION_TRANSITIONS) {
      const existing = await tx.workflowTransition.findFirst({
        where: {
          tenantId: FINANCE_TENANT_ID,
          workflowTypeId: workflowType.id,
          fromStatus: transition.fromStatus,
          toStatus: transition.toStatus,
        },
        select: { id: true },
      });
      const data = {
        transitionLabel: transition.transitionLabel,
        requiresComment: transition.requiresComment,
        allowedRoles: transition.allowedRoles,
        allowedExecutiveRoles: transition.allowedExecutiveRoles,
        isActive: true,
      };
      if (existing) {
        await tx.workflowTransition.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await tx.workflowTransition.create({
          data: {
            ...data,
            tenantId: FINANCE_TENANT_ID,
            workflowTypeId: workflowType.id,
            fromStatus: transition.fromStatus,
            toStatus: transition.toStatus,
          },
        });
      }
    }
  });

  console.log(
    "✅ Finance-scoped Purchase Requisition transitions rectified; existing CFO bypass was not changed.",
  );
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
}
