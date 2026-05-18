import { IEsignProvider, EsignResult } from './interfaces';

/**
 * Placeholder E-sign Provider — returns SKIPPED for all requests.
 * Replace with real implementation (DocuSign/Adobe Sign) when vendor is procured.
 * Manual upload of signed documents is the fallback path.
 */
export class PlaceholderEsignProvider implements IEsignProvider {
  async createSignatureRequest(): Promise<EsignResult> {
    return {
      status: 'SKIPPED',
      sigRef: null,
    };
  }

  async getSignatureStatus(): Promise<EsignResult> {
    return {
      status: 'SKIPPED',
      sigRef: null,
    };
  }
}