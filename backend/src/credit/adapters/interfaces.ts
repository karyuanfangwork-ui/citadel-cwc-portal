// ============================================================================
// Credit Module — External Adapter Interfaces
// All external integrations are abstracted behind these interfaces.
// Placeholder implementations are used until real vendors are procured.
// ============================================================================

/** AML/KYC Screening result */
export interface ScreeningResult {
  status: 'CLEAR' | 'HIT' | 'ERROR';
  hits: ScreeningHit[];
  providerRef: string;
  screenedAt: Date;
}

export interface ScreeningHit {
  hitType: 'PEP' | 'SANCTION' | 'ADVERSE_MEDIA' | 'WATCHLIST';
  matchScore: number; // 0-100
  entityName: string;
  details: string;
  listSource: string;
}

/** AML/KYC/PEP/Sanctions screening provider */
export interface IAmlProvider {
  screenIndividual(params: {
    firstName: string;
    lastName: string;
    nricPassport?: string;
    dateOfBirth?: Date;
    nationality?: string;
  }): Promise<ScreeningResult>;

  screenCorporate(params: {
    companyName: string;
    registrationNumber?: string;
    country?: string;
  }): Promise<ScreeningResult>;

  rescreen(params: {
    entityType: 'INDIVIDUAL' | 'CORPORATE';
    entityId: string;
  }): Promise<ScreeningResult>;
}

/** OCR extraction result */
export interface OcrResult {
  status: 'SUCCESS' | 'UNSUPPORTED' | 'ERROR';
  extractedData: Record<string, any> | null;
  confidence: number; // 0-100
  providerRef: string;
  processedAt: Date;
}

/** OCR / Document AI provider */
export interface IOcrProvider {
  extractFinancials(params: {
    documentUrl: string;
    documentType: 'BALANCE_SHEET' | 'INCOME_STATEMENT' | 'CASH_FLOW' | 'BANK_STATEMENT' | 'OTHER';
  }): Promise<OcrResult>;

  classifyDocument(params: {
    documentUrl: string;
  }): Promise<{ documentType: string; confidence: number }>;
}

/** Credit bureau report */
export interface BureauReport {
  score: number | null;
  rating: string | null;
  providerRef: string;
  reportSummary: string | null;
  retrievedAt: Date;
}

/** Credit bureau provider (CTOS/CCRIS/RAM) */
export interface IBureauProvider {
  getIndividualReport(params: {
    nricPassport: string;
  }): Promise<BureauReport>;

  getCorporateReport(params: {
    registrationNumber: string;
  }): Promise<BureauReport>;
}

/** CBS handoff result */
export interface CbsHandoffResult {
  accepted: boolean;
  reference: string;
  message?: string;
  bookedAt?: Date;
}

/** Core Banking System provider */
export interface ICbsProvider {
  bookFacility(params: {
    applicationId: string;
    facilityType: string;
    amount: number;
    currency: string;
    tenorMonths: number;
    rate: number;
    borrowerId: string;
  }): Promise<CbsHandoffResult>;

  getFacilityStatus(params: {
    cbsReference: string;
  }): Promise<{ status: string; outstandingBalance?: number }>;
}

/** E-signature result */
export interface EsignResult {
  status: 'COMPLETED' | 'SKIPPED' | 'PENDING' | 'ERROR';
  sigRef: string | null;
  signingUrl?: string;
  completedAt?: Date;
}

/** E-signature provider (DocuSign/Adobe Sign) */
export interface IEsignProvider {
  createSignatureRequest(params: {
    documentUrl: string;
    signers: Array<{ name: string; email: string }>;
    message?: string;
  }): Promise<EsignResult>;

  getSignatureStatus(params: {
    sigRef: string;
  }): Promise<EsignResult>;
}