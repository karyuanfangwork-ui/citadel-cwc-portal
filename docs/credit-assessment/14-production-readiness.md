# 14 — Production Readiness Checklist

A go-live cannot occur unless every item below is **GREEN** with documented evidence linked.

## A. Functional readiness
- [ ] All Phase-5 features pass UAT with zero P1/P2 defects open
- [ ] Edge-case test catalogue executed (≥ 95% pass)
- [ ] Critical journeys instrumented with feature flags and rollback toggles
- [ ] Data migration (if any) reconciled at row + checksum level
- [ ] User runbooks published and version-controlled

## B. Non-functional readiness
- [ ] Load test at 5× expected day-1 volume; p95 latencies within SLO
- [ ] Soak test 72h with no memory leak or queue depth growth
- [ ] Resilience tests: vendor outage, DB failover, Redis failover, S3 throttle, AV outage
- [ ] Capacity plan documented; cost guardrails for AI in effect
- [ ] Backup/restore drill passed within RTO/RPO

## C. Security readiness
- [ ] Pen-test: zero High/Critical findings open; Mediums on remediation plan
- [ ] SAST/DAST/SCA clean (high & critical zero)
- [ ] Secrets management audit
- [ ] MFA enforced for all credit users
- [ ] PAM in place for prod access; session recording on
- [ ] WAF/CDN/rate limit configured and tested
- [ ] Field-level encryption verified on sensitive columns
- [ ] DLP configured on exports
- [ ] DR runbook tested with live failover
- [ ] Vulnerability mgmt SLA in place

## D. Compliance readiness (BNM-aligned)
- [ ] DPIA approved
- [ ] Outsourcing register updated; BNM notification (if applicable) filed
- [ ] AML/CFT operating procedures published; staff trained
- [ ] Screening provider live and tested against golden hits
- [ ] Recordkeeping: WORM archive verified
- [ ] PDPA notices reviewed by legal
- [ ] Records of processing activities (RoPA) updated
- [ ] Retention schedules configured in system

## E. Operational readiness
- [ ] Runbooks: incident response, P1 escalation, AML hit surge, vendor failure
- [ ] On-call rota with PagerDuty/OpsGenie
- [ ] Monitoring dashboards published; alert thresholds tuned
- [ ] SLOs published; error budgets agreed
- [ ] Change Advisory Board signed off
- [ ] Service hours and support model published to users

## F. People & change readiness
- [ ] Training delivered to RMs, analysts, managers, committee, risk, compliance
- [ ] Certification of completion captured per user
- [ ] Quick-reference cards distributed
- [ ] Pilot retrospective actions closed
- [ ] Help desk briefed; KB articles published

## G. Governance readiness
- [ ] Credit Policy v1 approved
- [ ] Approval Matrix v1 loaded into system
- [ ] Scorecard v1 approved; validation report attached
- [ ] Risk Appetite Statement approved
- [ ] AI Acceptable Use & Model Risk Policies approved
- [ ] Sign-offs collected: Sponsor, Credit Head, Risk Head, CCO, CIO, CISO, Internal Audit (observer)

## H. Rollback & contingency
- [ ] Rollback procedure rehearsed end-to-end
- [ ] Legacy/manual path still operational and resourced for 60 days
- [ ] Communication template for outage / regression ready
- [ ] Vendor incident contacts current

## I. Day-2 operations
- [ ] Quarterly access review scheduled
- [ ] Quarterly backtest scheduled
- [ ] Quarterly DR test scheduled
- [ ] Annual pen test scheduled
- [ ] Annual model validation scheduled
- [ ] Continuous improvement backlog established

## J. AI-specific gates (per AI feature)
- [ ] Accuracy SLO met on golden set
- [ ] Shadow-mode period completed
- [ ] Explainability artefacts in UI
- [ ] Override capture verified
- [ ] Drift monitoring live
- [ ] Vendor contract: zero-retention, regional residency confirmed
- [ ] Feature-flagged with default-off in non-pilot tenants

---

**Final sign-off**: A go-live memo with all checklist evidence linked, signed by Sponsor + CIO + CISO + CCO + Risk Head + Credit Head, presented to Steering Committee.
