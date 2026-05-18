import apiClient from './api';

// ── Credit Module Types ───────────────────────────────────────

export type BorrowerProfileStatus = 'DRAFT' | 'PENDING_REVIEW' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type CreditApplicationStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'DISBURSED' | 'CLOSED';
export type DocumentType = 'NRIC' | 'PASSPORT' | 'BUSINESS_REG' | 'TAX_RETURN' | 'BANK_STATEMENT' | 'FINANCIAL_STATEMENT' | 'UTILITY_BILL' | 'OTHER';
export type DocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface CreditUserRef {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
}

export interface BorrowerProfile {
  id: string;
  accountId: string;
  contactId: string | null;
  status: BorrowerProfileStatus;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  nricPassport: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  occupation: string | null;
  employerName: string | null;
  monthlyIncome: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  creditScore: number | null;
  riskRating: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  notes: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  account?: { id: string; name: string; industry: string | null };
  contact?: { id: string; firstName: string; lastName: string; email: string | null };
  owner?: CreditUserRef;
  documents?: CreditDocument[];
  applications?: CreditApplication[];
  _count?: { documents: number; applications: number };
}

export interface CreditDocument {
  id: string;
  borrowerProfileId: string;
  documentType: DocumentType;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  status: DocumentStatus;
  verifiedAt: string | null;
  verifiedBy: string | null;
  rejectionReason: string | null;
  uploadedAt: string;
  uploadedBy: string;
  uploader?: CreditUserRef;
  verifier?: CreditUserRef;
}

export interface CreditApplication {
  id: string;
  borrowerProfileId: string;
  productName: string;
  requestedAmount: number;
  currency: string;
  tenureMonths: number;
  purpose: string | null;
  status: CreditApplicationStatus;
  approvedAmount: number | null;
  interestRate: number | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  disbursedAt: string | null;
  createdAt: string;
  updatedAt: string;
  borrowerProfile?: BorrowerProfile;
  reviewer?: CreditUserRef;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ── Credit API Service ─────────────────────────────────────────

const creditService = {
  // Borrower Profiles
  async listBorrowerProfiles(params: Record<string, any> = {}) {
    const res = await apiClient.get('/credit/borrower-profiles', { params });
    return res.data.data as { profiles: BorrowerProfile[]; pagination: Pagination };
  },

  async getBorrowerProfile(id: string) {
    const res = await apiClient.get(`/credit/borrower-profiles/${id}`);
    return res.data.data.profile as BorrowerProfile;
  },

  async createBorrowerProfile(data: Partial<BorrowerProfile>) {
    const res = await apiClient.post('/credit/borrower-profiles', data);
    return res.data.data.profile as BorrowerProfile;
  },

  async updateBorrowerProfile(id: string, data: Partial<BorrowerProfile>) {
    const res = await apiClient.patch(`/credit/borrower-profiles/${id}`, data);
    return res.data.data.profile as BorrowerProfile;
  },

  async deleteBorrowerProfile(id: string) {
    await apiClient.delete(`/credit/borrower-profiles/${id}`);
  },

  // Documents
  async listDocuments(borrowerProfileId: string) {
    const res = await apiClient.get(`/credit/borrower-profiles/${borrowerProfileId}/documents`);
    return res.data.data.documents as CreditDocument[];
  },

  async uploadDocument(borrowerProfileId: string, formData: FormData) {
    const res = await apiClient.post(`/credit/borrower-profiles/${borrowerProfileId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data.document as CreditDocument;
  },

  async verifyDocument(documentId: string) {
    const res = await apiClient.post(`/credit/documents/${documentId}/verify`);
    return res.data.data.document as CreditDocument;
  },

  async rejectDocument(documentId: string, reason: string) {
    const res = await apiClient.post(`/credit/documents/${documentId}/reject`, { rejectionReason: reason });
    return res.data.data.document as CreditDocument;
  },

  async deleteDocument(documentId: string) {
    await apiClient.delete(`/credit/documents/${documentId}`);
  },

  // Credit Applications
  async listApplications(params: Record<string, any> = {}) {
    const res = await apiClient.get('/credit/applications', { params });
    return res.data.data as { applications: CreditApplication[]; pagination: Pagination };
  },

  async getApplication(id: string) {
    const res = await apiClient.get(`/credit/applications/${id}`);
    return res.data.data.application as CreditApplication;
  },

  async createApplication(data: Partial<CreditApplication>) {
    const res = await apiClient.post('/credit/applications', data);
    return res.data.data.application as CreditApplication;
  },

  async updateApplication(id: string, data: Partial<CreditApplication>) {
    const res = await apiClient.patch(`/credit/applications/${id}`, data);
    return res.data.data.application as CreditApplication;
  },

  async submitApplication(id: string) {
    const res = await apiClient.post(`/credit/applications/${id}/submit`);
    return res.data.data.application as CreditApplication;
  },

  async approveApplication(id: string, data: { approvedAmount?: number; interestRate?: number }) {
    const res = await apiClient.post(`/credit/applications/${id}/approve`, data);
    return res.data.data.application as CreditApplication;
  },

  async rejectApplication(id: string, reason: string) {
    const res = await apiClient.post(`/credit/applications/${id}/reject`, { rejectionReason: reason });
    return res.data.data.application as CreditApplication;
  },

  async deleteApplication(id: string) {
    await apiClient.delete(`/credit/applications/${id}`);
  },

  // Dashboard stats
  async getDashboard() {
    const res = await apiClient.get('/credit/dashboard');
    return res.data.data as {
      totalBorrowers: number;
      pendingReviews: number;
      approvedToday: number;
      totalDisbursed: number;
      recentActivities: Array<{ id: string; type: string; description: string; createdAt: string }>;
    };
  },
};

export default creditService;