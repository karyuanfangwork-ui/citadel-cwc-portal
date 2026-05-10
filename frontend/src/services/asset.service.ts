import api from './api';

// ── Types (matching Prisma enums exactly) ───────────────────────

export type AssetStatus =
  | 'IN_STOCK' | 'ASSIGNED' | 'RESERVED' | 'PENDING_RETURN'
  | 'IN_REPAIR' | 'RETIRED' | 'LOST' | 'STOLEN' | 'DISPOSED';

export type AssetCategory =
  | 'LAPTOP' | 'DESKTOP' | 'MONITOR' | 'PERIPHERAL'
  | 'PHONE' | 'NETWORK' | 'PRINTER' | 'SOFTWARE_LICENSE' | 'OTHER';

export interface Asset {
  id: string;
  assetTag: string;
  serialNumber: string | null;
  name: string;
  category: AssetCategory;
  brand: string | null;
  model: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  vendor: string | null;
  warrantyExpiry: string | null;
  status: AssetStatus;
  notes: string | null;
  sourceRequestId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; firstName: string; lastName: string; email: string };
  assignments?: AssetAssignment[];
  sourceRequest?: { id: string; summary: string; referenceNumber: string };
}

export interface AssetAssignment {
  id: string;
  assetId: string;
  userId: string;
  assignedById: string;
  assignedAt: string;
  returnedAt: string | null;
  reason: string | null;
  linkedRequestId: string | null;
  notes: string | null;
  user?: { id: string; firstName: string; lastName: string; email: string };
  assignedBy?: { id: string; firstName: string; lastName: string; email: string };
  asset?: Asset;
}

export interface ListAssetsParams {
  status?: AssetStatus;
  category?: AssetCategory;
  assignedTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ── Asset Service ──────────────────────────────────────────────

const assetService = {
  async listAssets(params: ListAssetsParams = {}) {
    const response = await api.get('/assets', { params });
    return response.data.data as { assets: Asset[]; total: number; page: number; limit: number };
  },

  async getAsset(id: string) {
    const response = await api.get(`/assets/${id}`);
    return response.data.data.asset as Asset;
  },

  async createAsset(data: Partial<Asset>) {
    const response = await api.post('/assets', data);
    return response.data.data.asset as Asset;
  },

  async updateAsset(id: string, data: Partial<Asset>) {
    const response = await api.patch(`/assets/${id}`, data);
    return response.data.data.asset as Asset;
  },

  async deleteAsset(id: string) {
    await api.delete(`/assets/${id}`);
  },

  async assignAsset(id: string, data: { userId: string; reason?: string; notes?: string; linkedRequestId?: string }) {
    const response = await api.post(`/assets/${id}/assign`, data);
    return response.data.data.assignment as AssetAssignment;
  },

  async returnAsset(id: string, data: { notes?: string; newStatus?: AssetStatus }) {
    await api.post(`/assets/${id}/return`, data);
  },

  async listActiveAssignments(params?: { search?: string; page?: number; limit?: number }) {
    const response = await api.get('/assets/assignments', { params });
    return response.data.data as {
      userAssignments: {
        user: { id: string; firstName: string; lastName: string; email: string; department: string | null };
        assignments: AssetAssignment[];
      }[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    };
  },

  async getAssetsByUser(userId: string) {
    const response = await api.get(`/assets/by-user/${userId}`);
    return response.data.data as {
      user: { id: string; firstName: string; lastName: string; email: string };
      assignments: AssetAssignment[];
    };
  },

  async importAssets(rows: Record<string, string>[]) {
    const response = await api.post('/assets/import', { rows });
    return response.data.data as { imported: number; warnings: string[]; errors: string[] };
  },

  /**
   * Upload a CSV/XLSX file for parsing and validation preview.
   * Returns column mapping, rows with validation status, and stats.
   */
  async importAssetsParse(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/assets/import/parse', formData, {
      timeout: 60000, // 60s for XLSX parse + DB validation
      headers: { 'Content-Type': 'multipart/form-data' }, // Axios will auto-set boundary
      transformRequest: [(data, headers) => {
        // Let the browser set the correct Content-Type with boundary for FormData
        delete headers['Content-Type'];
        return data;
      }],
    });
    return response.data.data as {
      columnMapping: Array<{ header: string; dbField: string; matched: boolean }>;
      rows: Record<string, string>[];
      stats: {
        totalRows: number;
        validRows: number;
        errorRows: number;
        errors: Array<{ row: string; field: string; message: string; severity: 'error' }>;
        warnings: Array<{ row: string; field: string; message: string; severity: 'warning' }>;
      };
    };
  },

  /**
   * Upload a CSV/XLSX file for parsing + auto-commit (single-step).
   * For backward compatibility with the old flow.
   */
  async importAssetsParseAndCommit(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    // Use the parse endpoint first, then commit manually
    const parseResult = await this.importAssetsParse(file);
    return parseResult;
  },

  /**
   * Commit validated rows from the preview step to the database.
   */
  async importAssetsCommit(rows: Record<string, string>[], assignUsers = true) {
    const response = await api.post('/assets/import/commit', { rows, assignUsers }, {
      timeout: 120000, // 120s for bulk DB inserts
    });
    return response.data.data as { imported: number; skipped: number; warnings: string[]; errors: string[] };
  },

  async exportAssetsCsv(params: ListAssetsParams = {}) {
    const response = await api.get('/assets/export', {
      params,
      responseType: 'blob',
    });
    // Trigger browser download
    const blob = new Blob([response.data as BlobPart], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assets_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

export default assetService;
