import { IOcrProvider, OcrResult } from './interfaces';

/**
 * Placeholder OCR Provider — returns UNSUPPORTED for all requests.
 * Replace with real implementation (Azure Doc Intelligence / AWS Textract) when vendor is procured.
 */
export class PlaceholderOcrProvider implements IOcrProvider {
  async extractFinancials(): Promise<OcrResult> {
    return {
      status: 'UNSUPPORTED',
      extractedData: null,
      confidence: 0,
      providerRef: `MOCK-OCR-${Date.now()}`,
      processedAt: new Date(),
    };
  }

  async classifyDocument(): Promise<{ documentType: string; confidence: number }> {
    return {
      documentType: 'UNKNOWN',
      confidence: 0,
    };
  }
}