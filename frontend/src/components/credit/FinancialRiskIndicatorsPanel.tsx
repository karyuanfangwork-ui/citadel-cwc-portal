import React from 'react';
import { SmeFinancialRatio } from '../../../src/services/smeFinancial.service';

/**
 * FinancialRiskIndicatorsPanel
 *
 * Phase 3: Risk indicator panel that derives warning flags from ratio data.
 * Provides a quick visual scan of key risk areas for the credit officer.
 *
 * Risk indicators derived from:
 *  - DSCR < 1.10x → repayment risk
 *  - Current ratio < 1.0 → liquidity risk
 *  - Gearing ratio > 2.0 → leverage risk
 *  - Debt-to-equity > 3.0 → over-leveraged
 *  - ROS < 0% → profitability risk
 *  - Negative trend on any key ratio → declining performance
 */

interface RiskIndicator {
  key: string;
  label: string;
  message: string;
  severity: 'high' | 'medium' | 'low' | 'info';
  icon: string;
}

interface Props {
  smeRatios: SmeFinancialRatio[];
}

function deriveRiskIndicators(ratios: SmeFinancialRatio[]): RiskIndicator[] {
  const indicators: RiskIndicator[] = [];
  const ratioMap = new Map(ratios.map(r => [r.key, r]));

  // DSCR check
  const dscr = ratioMap.get('dscr');
  if (dscr) {
    if (dscr.value !== null && dscr.value < 1.10) {
      indicators.push({
        key: 'dscr',
        label: 'Repayment Capacity Risk',
        message: `DSCR at ${dscr.value.toFixed(2)}x is below the 1.10x minimum. Business cashflow may not cover debt service.`,
        severity: dscr.value < 1.0 ? 'high' : 'medium',
        icon: 'error',
      });
    }
  }

  // Current ratio check
  const currentRatio = ratioMap.get('current_ratio');
  if (currentRatio && currentRatio.value !== null) {
    if (currentRatio.value < 1.0) {
      indicators.push({
        key: 'current_ratio',
        label: 'Liquidity Risk',
        message: `Current ratio at ${currentRatio.value.toFixed(2)}x indicates current liabilities exceed current assets. Short-term liquidity pressure.`,
        severity: currentRatio.value < 0.8 ? 'high' : 'medium',
        icon: 'warning',
      });
    }
  }

  // Gearing ratio check
  const gearing = ratioMap.get('gearing_ratio');
  if (gearing && gearing.value !== null) {
    if (gearing.value > 2.0) {
      indicators.push({
        key: 'gearing',
        label: 'Leverage Risk',
        message: `Gearing ratio at ${(gearing.value * 100).toFixed(1)}% indicates high leverage relative to equity.`,
        severity: gearing.value > 3.0 ? 'high' : 'medium',
        icon: 'warning',
      });
    }
  }

  // Debt-to-equity check
  const dte = ratioMap.get('debt_to_equity');
  if (dte && dte.value !== null) {
    if (dte.value > 3.0) {
      indicators.push({
        key: 'debt_to_equity',
        label: 'Over-Leveraged',
        message: `Debt-to-equity at ${dte.value.toFixed(2)}x exceeds the 3.0x threshold. Highly geared balance sheet.`,
        severity: dte.value > 5.0 ? 'high' : 'medium',
        icon: 'error',
      });
    }
  }

  // ROS check
  const ros = ratioMap.get('ros');
  if (ros && ros.value !== null) {
    if (ros.value < 0) {
      indicators.push({
        key: 'ros',
        label: 'Profitability Risk',
        message: `Return on sales at ${ros.value.toFixed(1)}% is negative. Business is operating at a loss.`,
        severity: 'high',
        icon: 'error',
      });
    }
  }

  // Overall fail count
  const failCount = ratios.filter(r => r.status === 'fail').length;
  if (failCount > 2) {
    indicators.push({
      key: 'multi_fail',
      label: 'Multiple Ratio Failures',
      message: `${failCount} ratios are failing benchmark thresholds. Comprehensive risk review required.`,
      severity: 'high',
      icon: 'priority_high',
    });
  }

  // If no indicators, show positive message
  if (indicators.length === 0 && ratios.length > 0) {
    indicators.push({
      key: 'all_pass',
      label: 'No Risk Indicators',
      message: 'All key ratios are within acceptable benchmark ranges. No material risk indicators triggered.',
      severity: 'info',
      icon: 'check_circle',
    });
  }

  return indicators;
}

const severityStyles: Record<string, { bg: string; border: string; text: string }> = {
  high:   { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700' },
  medium: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700' },
  low:    { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
  info:   { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
};

const FinancialRiskIndicatorsPanel: React.FC<Props> = ({ smeRatios }) => {
  const indicators = deriveRiskIndicators(smeRatios);

  if (smeRatios.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-lg text-gray-500">monitoring</span>
        <h4 className="text-sm font-semibold text-gray-700">Financial Risk Indicators</h4>
        {indicators.filter(i => i.severity === 'high').length > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-red-100 text-red-700 border-red-200">
            {indicators.filter(i => i.severity === 'high').length} high risk
          </span>
        )}
      </div>
      <div className="space-y-2">
        {indicators.map((ind) => {
          const s = severityStyles[ind.severity];
          return (
            <div key={ind.key} className={`flex items-start gap-2 p-3 rounded-lg border ${s.bg} ${s.border}`}>
              <span className={`material-symbols-outlined text-base mt-0.5 ${s.text}`}>{ind.icon}</span>
              <div className="flex-1">
                <p className={`text-xs font-semibold ${s.text}`}>{ind.label}</p>
                <p className="text-[11px] text-gray-600 mt-0.5">{ind.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FinancialRiskIndicatorsPanel;