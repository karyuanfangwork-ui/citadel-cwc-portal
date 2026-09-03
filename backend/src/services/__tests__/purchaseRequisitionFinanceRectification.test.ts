import {
  EXISTING_CFO_BYPASS,
  FINANCE_RECTIFICATION_TRANSITIONS,
  planFinanceRectification,
} from "../../../prisma/rectify-purchase-requisition-finance-transitions";

describe("Finance Purchase Requisition transition rectification", () => {
  it("defines the CEO-first scoped transition additions", () => {
    expect(
      FINANCE_RECTIFICATION_TRANSITIONS.map(
        ({ fromStatus, toStatus }) => `${fromStatus}→${toStatus}`,
      ),
    ).toEqual([
      "FINANCE_ACKNOWLEDGED→PENDING_CEO_APPROVAL_FIN",
      "PENDING_CEO_APPROVAL_FIN→PENDING_CFO_APPROVAL_FIN",
      "PENDING_CEO_APPROVAL_FIN→CEO_REJECTED_FIN",
    ]);
    expect(FINANCE_RECTIFICATION_TRANSITIONS[2]).toEqual(
      expect.objectContaining({
        transitionLabel: "REJECT",
        requiresComment: true,
      }),
    );
  });

  it("is idempotent for already-canonical rows and reports the CFO bypass decision", () => {
    const existing = FINANCE_RECTIFICATION_TRANSITIONS.map((transition) => ({
      ...transition,
      isActive: true,
    }));
    const plan = planFinanceRectification(existing, { isActive: true });

    expect(plan.actions.every(({ action }) => action === "UNCHANGED")).toBe(
      true,
    );
    expect(plan.bypass).toEqual({
      exists: true,
      active: true,
      retain: true,
      recommendation:
        "RETAIN_GLOBAL_FOR_OTHER_WORKFLOWS_FINANCE_SCOPED_ROUTE_TAKES_PRECEDENCE",
    });
    expect(EXISTING_CFO_BYPASS).toEqual({
      fromStatus: "FINANCE_ACKNOWLEDGED",
      toStatus: "PENDING_CFO_APPROVAL_FIN",
    });
  });

  it("plans missing rows without writing or altering the existing bypass", () => {
    const plan = planFinanceRectification([], null);

    expect(plan.actions.map(({ action }) => action)).toEqual([
      "CREATE",
      "CREATE",
      "CREATE",
    ]);
    expect(plan.bypass).toEqual(
      expect.objectContaining({
        exists: false,
        active: false,
        retain: true,
      }),
    );
  });
});
