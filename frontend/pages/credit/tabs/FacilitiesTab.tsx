// FacilitiesTab is now a thin redirect to the canonical RequestsFacilitiesTab.
// The canonical implementation is in RequestsFacilitiesTab.tsx which this re-exports.
// This avoids a breaking import change in CreditApplicationDetail.tsx.
// Phase 2 (Sprint 2) will add CaMemoSection envelope + autosave wrapper here.

export { default } from './RequestsFacilitiesTab';