import { IAmlProvider, IOcrProvider, IBureauProvider, ICbsProvider, IEsignProvider } from './interfaces';
import { PlaceholderAmlProvider } from './aml.placeholder';
import { PlaceholderOcrProvider } from './ocr.placeholder';
import { PlaceholderBureauProvider } from './bureau.placeholder';
import { PlaceholderCbsProvider } from './cbs.placeholder';
import { PlaceholderEsignProvider } from './esign.placeholder';

/**
 * Adapter Registry — resolves the correct provider implementation based on config.
 * All providers default to placeholder implementations.
 * To swap a real provider:
 * 1. Implement the interface (e.g. RefinitivAmlProvider implements IAmlProvider)
 * 2. Import it here
 * 3. Update the factory function to return it when config indicates
 * 4. No other code changes needed — business logic only depends on interfaces
 */

// Singleton instances (lazy-initialized)
let amlProvider: IAmlProvider | null = null;
let ocrProvider: IOcrProvider | null = null;
let bureauProvider: IBureauProvider | null = null;
let cbsProvider: ICbsProvider | null = null;
let esignProvider: IEsignProvider | null = null;

export function getAmlProvider(): IAmlProvider {
  if (!amlProvider) {
    // TODO: Add config check for real provider when available
    amlProvider = new PlaceholderAmlProvider();
  }
  return amlProvider;
}

export function getOcrProvider(): IOcrProvider {
  if (!ocrProvider) {
    ocrProvider = new PlaceholderOcrProvider();
  }
  return ocrProvider;
}

export function getBureauProvider(): IBureauProvider {
  if (!bureauProvider) {
    bureauProvider = new PlaceholderBureauProvider();
  }
  return bureauProvider;
}

export function getCbsProvider(): ICbsProvider {
  if (!cbsProvider) {
    cbsProvider = new PlaceholderCbsProvider();
  }
  return cbsProvider;
}

export function getEsignProvider(): IEsignProvider {
  if (!esignProvider) {
    esignProvider = new PlaceholderEsignProvider();
  }
  return esignProvider;
}

/** Reset all providers — useful for testing */
export function resetProviders(): void {
  amlProvider = null;
  ocrProvider = null;
  bureauProvider = null;
  cbsProvider = null;
  esignProvider = null;
}