// ---------------------------------------------------------------------------
// Financial Statement Template Rows
// Auto-populated when a CORPORATE borrower creates a new financial statement.
// lineKey = stable identifier (used as unique key per statement)
// lineLabel = human-readable display label
// ---------------------------------------------------------------------------

export interface TemplateRow {
  lineKey: string;
  lineLabel: string;
  parentLineKey?: string;
}

// ── Balance Sheet ──────────────────────────────────────────────────────────

export const BALANCE_SHEET_ROWS: TemplateRow[] = [
  // Assets
  { lineKey: 'cash_and_cash_equivalents', lineLabel: 'Cash and Cash Equivalents', parentLineKey: 'current_assets' },
  { lineKey: 'short_term_investments', lineLabel: 'Short-Term Investments', parentLineKey: 'current_assets' },
  { lineKey: 'accounts_receivable', lineLabel: 'Accounts Receivable', parentLineKey: 'current_assets' },
  { lineKey: 'inventories', lineLabel: 'Inventories', parentLineKey: 'current_assets' },
  { lineKey: 'other_current_assets', lineLabel: 'Other Current Assets', parentLineKey: 'current_assets' },
  { lineKey: 'current_assets', lineLabel: 'Total Current Assets' },
  { lineKey: 'property_plant_equipment', lineLabel: 'Property, Plant & Equipment', parentLineKey: 'non_current_assets' },
  { lineKey: 'intangible_assets', lineLabel: 'Intangible Assets', parentLineKey: 'non_current_assets' },
  { lineKey: 'long_term_investments', lineLabel: 'Long-Term Investments', parentLineKey: 'non_current_assets' },
  { lineKey: 'other_non_current_assets', lineLabel: 'Other Non-Current Assets', parentLineKey: 'non_current_assets' },
  { lineKey: 'non_current_assets', lineLabel: 'Total Non-Current Assets' },
  { lineKey: 'total_assets', lineLabel: 'Total Assets' },

  // Liabilities
  { lineKey: 'accounts_payable', lineLabel: 'Accounts Payable', parentLineKey: 'current_liabilities' },
  { lineKey: 'short_term_borrowings', lineLabel: 'Short-Term Borrowings', parentLineKey: 'current_liabilities' },
  { lineKey: 'current_portion_ltd', lineLabel: 'Current Portion of Long-Term Debt', parentLineKey: 'current_liabilities' },
  { lineKey: 'other_current_liabilities', lineLabel: 'Other Current Liabilities', parentLineKey: 'current_liabilities' },
  { lineKey: 'current_liabilities', lineLabel: 'Total Current Liabilities' },
  { lineKey: 'long_term_debt', lineLabel: 'Long-Term Debt', parentLineKey: 'non_current_liabilities' },
  { lineKey: 'deferred_tax_liabilities', lineLabel: 'Deferred Tax Liabilities', parentLineKey: 'non_current_liabilities' },
  { lineKey: 'other_non_current_liabilities', lineLabel: 'Other Non-Current Liabilities', parentLineKey: 'non_current_liabilities' },
  { lineKey: 'non_current_liabilities', lineLabel: 'Total Non-Current Liabilities' },
  { lineKey: 'total_liabilities', lineLabel: 'Total Liabilities' },

  // Equity
  { lineKey: 'share_capital', lineLabel: 'Share Capital', parentLineKey: 'total_equity' },
  { lineKey: 'retained_earnings', lineLabel: 'Retained Earnings', parentLineKey: 'total_equity' },
  { lineKey: 'reserves', lineLabel: 'Reserves', parentLineKey: 'total_equity' },
  { lineKey: 'total_equity', lineLabel: 'Total Equity' },
  { lineKey: 'total_liabilities_and_equity', lineLabel: 'Total Liabilities and Equity' },
];

// ── Income Statement (Profit & Loss) ──────────────────────────────────────

export const INCOME_STATEMENT_ROWS: TemplateRow[] = [
  { lineKey: 'revenue', lineLabel: 'Revenue' },
  { lineKey: 'cost_of_goods_sold', lineLabel: 'Cost of Goods Sold', parentLineKey: 'gross_profit' },
  { lineKey: 'gross_profit', lineLabel: 'Gross Profit' },
  { lineKey: 'selling_expenses', lineLabel: 'Selling Expenses', parentLineKey: 'operating_expenses' },
  { lineKey: 'general_admin_expenses', lineLabel: 'General & Admin Expenses', parentLineKey: 'operating_expenses' },
  { lineKey: 'depreciation_amortisation', lineLabel: 'Depreciation & Amortisation', parentLineKey: 'operating_expenses' },
  { lineKey: 'operating_expenses', lineLabel: 'Total Operating Expenses' },
  { lineKey: 'operating_profit', lineLabel: 'Operating Profit (EBIT)' },
  { lineKey: 'interest_income', lineLabel: 'Interest Income', parentLineKey: 'finance_costs' },
  { lineKey: 'interest_expense', lineLabel: 'Interest Expense', parentLineKey: 'finance_costs' },
  { lineKey: 'finance_costs', lineLabel: 'Net Finance Costs' },
  { lineKey: 'profit_before_tax', lineLabel: 'Profit Before Tax' },
  { lineKey: 'income_tax_expense', lineLabel: 'Income Tax Expense', parentLineKey: 'net_profit' },
  { lineKey: 'net_profit', lineLabel: 'Net Profit' },
];

// ── Cash Flow Statement ───────────────────────────────────────────────────

export const CASH_FLOW_ROWS: TemplateRow[] = [
  { lineKey: 'cf_operating', lineLabel: 'Net Cash from Operating Activities' },
  { lineKey: 'cf_investing', lineLabel: 'Net Cash from Investing Activities' },
  { lineKey: 'cf_financing', lineLabel: 'Net Cash from Financing Activities' },
  { lineKey: 'cf_net_change', lineLabel: 'Net Change in Cash' },
];

// ── Template lookup by statement type ──────────────────────────────────────

const TEMPLATES: Record<string, TemplateRow[]> = {
  BS: BALANCE_SHEET_ROWS,
  PL: INCOME_STATEMENT_ROWS,
  CF: CASH_FLOW_ROWS,
};

export function getTemplateForType(statementType: string): TemplateRow[] {
  return TEMPLATES[statementType] ?? [];
}