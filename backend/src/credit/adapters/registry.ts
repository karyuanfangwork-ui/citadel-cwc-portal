import { IAmlProvider, IOcrProvider, IBureauProvider, ICbsProvider, IEsignProvider } from './interfaces';
import { PlaceholderAmlProvider } from './aml.placeholder';
import { PlaceholderOcrProvider } from './ocr.placeholder';
import { NoopBureauProvider } from './bureau.noop';
import { PlaceholderCbsProvider } from './cbs.placeholder';
import { PlaceholderEsignProvider } from './esign.placeholder';
import { isFeatureEnabled } from '../middleware/featureFlag.middleware';
import { config } from '../../config';
import { logger } from '../../utils/logger';

/**
 * Adapter Registry — resolves the correct provider implementation based on config.
 * All providers default to placeholder/noop implementations.
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

let bureauGuardChecked = false;

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

export async function getBureauProvider(): Promise<IBureauProvider> {
  if (bureauProvider) return bureauProvider;

  const realProviderConfigured = !!process.env.BUREAU_PROVIDER;
  const flagOn = await isFeatureEnabled('credit:bureau_checks');
  const isProd = config.env === 'production';

  if (isProd && flagOn && !realProviderConfigured) {
    throw new Error(
      'BureauProvider misconfig: credit:bureau_checks=true in production but ' +
      'no BUREAU_PROVIDER env configured. Refusing to serve no-op bureau data. ' +
      'See docs/credit-assessment/27-implementation-plan §4.3.',
    );
  }

  if (isProd && !realProviderConfigured && !bureauGuardChecked) {
    logger.warn(
      '[credit] BureauProvider: no real vendor configured; using NoopBureauProvider. ' +
      'This is acceptable only while credit:bureau_checks=false.',
    );
    bureauGuardChecked = true;
  }

  bureauProvider = realProviderConfigured
    ? loadRealProvider(process.env.BUREAU_PROVIDER!)
    : new NoopBureauProvider();

  return bureauProvider;
}

/** Stub — real provider wiring is Wave 4.3 */
function loadRealProvider(_key: string): IBureauProvider {
  throw new Error('Real bureau provider not implemented — see Wave 4.3 (CTOS adapter)');
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
  bureauGuardChecked = false;
  cbsProvider = null;
  esignProvider = null;
}