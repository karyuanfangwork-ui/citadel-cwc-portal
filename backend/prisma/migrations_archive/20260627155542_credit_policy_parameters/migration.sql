-- G-12: Generic credit policy parameters for configurable thresholds.
CREATE TABLE IF NOT EXISTS "credit_policy_parameters" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" VARCHAR(150) NOT NULL,
  "value" JSONB NOT NULL,
  "category" VARCHAR(80) NOT NULL,
  "description" TEXT,
  "product_type" "CreditProductType",
  "lane" "ProcessingLane",
  "borrower_type" "BorrowerType",
  "effective_from" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effective_to" TIMESTAMP(6),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "credit_policy_parameters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "credit_policy_parameters_key_product_type_lane_borrower_type_effective_from_key"
  ON "credit_policy_parameters"("key", "product_type", "lane", "borrower_type", "effective_from");
CREATE INDEX IF NOT EXISTS "credit_policy_parameters_key_is_active_idx"
  ON "credit_policy_parameters"("key", "is_active");
CREATE INDEX IF NOT EXISTS "credit_policy_parameters_category_is_active_idx"
  ON "credit_policy_parameters"("category", "is_active");
CREATE INDEX IF NOT EXISTS "credit_policy_parameters_product_type_lane_borrower_type_idx"
  ON "credit_policy_parameters"("product_type", "lane", "borrower_type");

ALTER TABLE "credit_policy_parameters"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

INSERT INTO "credit_policy_parameters" ("key", "value", "category", "description", "updated_at")
SELECT seed."key", seed."value"::jsonb, seed."category", seed."description", CURRENT_TIMESTAMP
FROM (VALUES
  ('bureau.freshness_days', '90', 'bureau', 'Maximum age in days before a bureau report is stale'),
  ('bureau.cap.ccris_saa.max_rating', '"BBB"', 'bureau', 'Maximum rating when CCRIS SAA flag is present'),
  ('bureau.cap.ccris_missed_payments.threshold', '3', 'bureau', 'Missed payment count that triggers CCRIS missed-payment cap'),
  ('bureau.cap.ccris_missed_payments.max_rating', '"BB"', 'bureau', 'Maximum rating when CCRIS missed-payment threshold is met'),
  ('bureau.cap.ccris_legal_action.max_rating', '"B"', 'bureau', 'Maximum rating when CCRIS legal action flag is present'),
  ('bureau.cap.ccris_bankruptcy.max_rating', '"C"', 'bureau', 'Maximum rating when CCRIS bankruptcy flag is present'),
  ('bureau.cap.ctos_adverse.max_rating', '"BB"', 'bureau', 'Maximum rating when CTOS adverse flag is present'),
  ('bureau.cap.ctos_bankruptcy.max_rating', '"C"', 'bureau', 'Maximum rating when CTOS bankruptcy flag is present'),
  ('bureau.cap.ctos_score_lt_300.threshold', '300', 'bureau', 'CTOS score threshold for severe score cap'),
  ('bureau.cap.ctos_score_lt_300.max_rating', '"B"', 'bureau', 'Maximum rating when CTOS score is below severe threshold'),
  ('bureau.cap.ctos_score_lt_500.threshold', '500', 'bureau', 'CTOS score threshold for moderate score cap'),
  ('bureau.cap.ctos_score_lt_500.max_rating', '"BB"', 'bureau', 'Maximum rating when CTOS score is below moderate threshold'),

  ('readiness.retail.net_dsr.pass_max', '50', 'readiness', 'Net DSR maximum percentage for pass band'),
  ('readiness.retail.net_dsr.warn_max', '60', 'readiness', 'Net DSR maximum percentage for warning band'),
  ('readiness.retail.gross_dsr.pass_max', '60', 'readiness', 'Gross DSR maximum percentage for pass band'),
  ('readiness.retail.gross_dsr.warn_max', '70', 'readiness', 'Gross DSR maximum percentage for warning band'),
  ('readiness.dscr.fail_below', '1.0', 'readiness', 'Business DSCR below this value fails readiness'),
  ('readiness.dscr.warn_below', '1.1', 'readiness', 'Business DSCR below this value is warning band'),
  ('readiness.exposure.warning_utilisation_pct', '90', 'readiness', 'Exposure utilisation percentage that triggers warning'),

  ('sme.dscr.pass_min', '1.1', 'sme', 'SME DSCR minimum for pass status'),
  ('sme.dscr.warn_min', '1.0', 'sme', 'SME DSCR minimum for warning status'),
  ('sme.dsr.pass_max', '60', 'sme', 'SME owner DSR maximum for pass status'),
  ('sme.dsr.warn_max', '70', 'sme', 'SME owner DSR maximum for warning status'),
  ('sme.current_ratio.pass_min', '1.2', 'sme', 'SME current ratio minimum for pass status'),
  ('sme.current_ratio.warn_min', '1.0', 'sme', 'SME current ratio minimum for warning status'),
  ('sme.gearing.pass_max', '0.70', 'sme', 'SME gearing maximum for pass status'),
  ('sme.gearing.warn_max', '0.85', 'sme', 'SME gearing maximum for warning status'),
  ('sme.ros.pass_min', '0.03', 'sme', 'SME return-on-sales minimum for pass status'),
  ('sme.ros.warn_min', '0.01', 'sme', 'SME return-on-sales minimum for warning status'),
  ('sme.debt_to_equity.pass_max', '1.5', 'sme', 'SME debt-to-equity maximum for pass status'),
  ('sme.debt_to_equity.warn_max', '2.0', 'sme', 'SME debt-to-equity maximum for warning status'),
  ('sme.audited_accounts.years_trading_min', '3', 'sme', 'Years trading threshold for audited accounts requirement'),
  ('sme.audited_accounts.amount_min', '500000', 'sme', 'Amount threshold for audited accounts requirement'),

  ('scoring.financial_performance.ros.good', '0.15', 'scoring', 'ROS value that maps to full financial-performance score'),
  ('scoring.financial_performance.ros.bad', '0', 'scoring', 'ROS value that maps to zero financial-performance score'),
  ('scoring.financial_performance.roa.good', '0.10', 'scoring', 'ROA value that maps to full financial-performance score'),
  ('scoring.financial_performance.roa.bad', '0', 'scoring', 'ROA value that maps to zero financial-performance score'),
  ('scoring.financial_performance.roe.good', '0.15', 'scoring', 'ROE value that maps to full financial-performance score'),
  ('scoring.financial_performance.roe.bad', '0', 'scoring', 'ROE value that maps to zero financial-performance score'),
  ('scoring.leverage.debt_to_equity.good', '1.0', 'scoring', 'Debt-to-equity value that maps to full leverage score'),
  ('scoring.leverage.debt_to_equity.bad', '3.0', 'scoring', 'Debt-to-equity value that maps to zero leverage score'),
  ('scoring.leverage.debt_to_assets.good', '0.4', 'scoring', 'Debt-to-assets value that maps to full leverage score'),
  ('scoring.leverage.debt_to_assets.bad', '0.8', 'scoring', 'Debt-to-assets value that maps to zero leverage score'),
  ('scoring.liquidity.current_ratio.good', '2.0', 'scoring', 'Current ratio value that maps to full liquidity score'),
  ('scoring.liquidity.current_ratio.bad', '1.0', 'scoring', 'Current ratio value that maps to zero liquidity score'),
  ('scoring.liquidity.quick_ratio.good', '1.5', 'scoring', 'Quick ratio value that maps to full liquidity score'),
  ('scoring.liquidity.quick_ratio.bad', '0.5', 'scoring', 'Quick ratio value that maps to zero liquidity score'),
  ('scoring.cashflow.dscr.good', '2.0', 'scoring', 'DSCR value that maps to full cashflow score'),
  ('scoring.cashflow.dscr.bad', '1.0', 'scoring', 'DSCR value that maps to zero cashflow score'),
  ('scoring.cashflow.interest_coverage.good', '5.0', 'scoring', 'Interest coverage value that maps to full cashflow score'),
  ('scoring.cashflow.interest_coverage.bad', '1.5', 'scoring', 'Interest coverage value that maps to zero cashflow score'),
  ('scoring.retail_dsr.pass_max', '60', 'scoring', 'Retail DSR percentage at pass segment endpoint'),
  ('scoring.retail_dsr.warn_max', '70', 'scoring', 'Retail DSR percentage at warning segment endpoint'),
  ('scoring.retail_dsr.hard_fail_at', '80', 'scoring', 'Retail DSR percentage that maps to zero score'),
  ('scoring.retail_dsr.pass_score_floor', '80', 'scoring', 'Retail DSR score at pass segment endpoint'),
  ('scoring.retail_dsr.warn_score_floor', '20', 'scoring', 'Retail DSR score at warning segment endpoint'),

  ('collateral.ltv_cap.default_pct', '70', 'collateral', 'Default LTV cap percentage when no explicit cap is provided'),
  ('collateral.valuation.warning_months', '9', 'collateral', 'Collateral valuation age in months that triggers warning severity'),
  ('collateral.valuation.block_months', '12', 'collateral', 'Collateral valuation age in months that triggers high severity and transition block'),
  ('insurance.expiry.warning_days', '30', 'insurance', 'Insurance expiry lookahead window in days'),
  ('insurance.expiry.high_severity_days', '7', 'insurance', 'Insurance expiry days threshold for high severity'),

  ('missing_data.neutral_score', '50', 'missing_data', 'Score applied when a missing-data policy is NEUTRAL'),
  ('missing_data.financial_performance.policy', '"NEUTRAL"', 'missing_data', 'Missing-data policy for financial performance factor'),
  ('missing_data.financial_performance.penalty_score', '25', 'missing_data', 'Penalty score for missing financial performance factor'),
  ('missing_data.leverage.policy', '"NEUTRAL"', 'missing_data', 'Missing-data policy for leverage factor'),
  ('missing_data.leverage.penalty_score', '25', 'missing_data', 'Penalty score for missing leverage factor'),
  ('missing_data.liquidity.policy', '"NEUTRAL"', 'missing_data', 'Missing-data policy for liquidity factor'),
  ('missing_data.liquidity.penalty_score', '25', 'missing_data', 'Penalty score for missing liquidity factor'),
  ('missing_data.cashflow.policy', '"NEUTRAL"', 'missing_data', 'Missing-data policy for cashflow factor'),
  ('missing_data.cashflow.penalty_score', '25', 'missing_data', 'Penalty score for missing cashflow factor'),
  ('missing_data.management.policy', '"NEUTRAL"', 'missing_data', 'Missing-data policy for management factor'),
  ('missing_data.management.penalty_score', '25', 'missing_data', 'Penalty score for missing management factor'),
  ('missing_data.industry.policy', '"NEUTRAL"', 'missing_data', 'Missing-data policy for industry factor'),
  ('missing_data.industry.penalty_score', '25', 'missing_data', 'Penalty score for missing industry factor'),
  ('missing_data.collateral.policy', '"NEUTRAL"', 'missing_data', 'Missing-data policy for collateral factor'),
  ('missing_data.collateral.penalty_score', '25', 'missing_data', 'Penalty score for missing collateral factor'),
  ('missing_data.relationship.policy', '"NEUTRAL"', 'missing_data', 'Missing-data policy for relationship factor'),
  ('missing_data.relationship.penalty_score', '25', 'missing_data', 'Penalty score for missing relationship factor'),
  ('missing_data.market_conditions.policy', '"NEUTRAL"', 'missing_data', 'Missing-data policy for market conditions factor'),
  ('missing_data.market_conditions.penalty_score', '25', 'missing_data', 'Penalty score for missing market conditions factor')
) AS seed("key", "value", "category", "description")
WHERE NOT EXISTS (
  SELECT 1
  FROM "credit_policy_parameters" existing
  WHERE existing."key" = seed."key"
    AND existing."product_type" IS NULL
    AND existing."lane" IS NULL
    AND existing."borrower_type" IS NULL
);
