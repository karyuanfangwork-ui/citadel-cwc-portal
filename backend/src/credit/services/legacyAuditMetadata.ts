// Exact v2 write-site field order for the two documented historical event shapes.
// This is forensic compatibility only; never use it for new audit writes.
const MAPPING_KEYS = [
  'fieldKey', 'fieldLabel', 'sourceType', 'documentId', 'documentLabel',
  'note', 'autoPopulated', 'ocrExtracted', 'confidence',
] as const;

type LegacyEvent = {
  eventType: string;
  action: string;
  actorId: string | null;
  oldState: string | null;
  newState: string | null;
  metadata: unknown;
};

function plainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

/** Returns undefined for every unrecognized shape; no permutation search. */
export function legacyV2SourceMetadata(event: LegacyEvent): Record<string, unknown> | undefined {
  if (!plainObject(event.metadata) || event.oldState != null || event.newState != null) return undefined;
  const metadata = event.metadata;

  if (event.eventType === 'AML_RESCREEN_QUEUED' && event.action === 'aml_rescreen_queued' && event.actorId === null) {
    if (!exactKeys(metadata, ['provider', 'reason', 'rescreenIntervalDays']) ||
        metadata.provider !== 'AML_RESCREEN' || metadata.reason !== 'quarterly_rescreen' ||
        metadata.rescreenIntervalDays !== 90) return undefined;
    return { provider: metadata.provider, reason: metadata.reason, rescreenIntervalDays: metadata.rescreenIntervalDays };
  }

  if (event.eventType === 'EVIDENCE_MAPPING' && event.action === 'upsert_evidence_mapping' && event.actorId !== null) {
    if (!exactKeys(metadata, ['sourceSummary', 'mappings', 'version']) || metadata.version !== 1 ||
        !(metadata.sourceSummary === null || typeof metadata.sourceSummary === 'string') ||
        !Array.isArray(metadata.mappings) || metadata.mappings.length === 0) return undefined;
    const mappings: Record<string, unknown>[] = [];
    for (const mapping of metadata.mappings) {
      if (!plainObject(mapping) || !Object.keys(mapping).every((key) => MAPPING_KEYS.includes(key as typeof MAPPING_KEYS[number])) ||
          !['fieldKey', 'fieldLabel', 'sourceType'].every((key) => typeof mapping[key] === 'string') ||
          !['documentId', 'documentLabel', 'note'].every((key) =>
            !Object.hasOwn(mapping, key) || mapping[key] === null || typeof mapping[key] === 'string') ||
          !['autoPopulated', 'ocrExtracted'].every((key) =>
            !Object.hasOwn(mapping, key) || typeof mapping[key] === 'boolean') ||
          (Object.hasOwn(mapping, 'confidence') && typeof mapping.confidence !== 'string')) return undefined;
      mappings.push(Object.fromEntries(MAPPING_KEYS.filter((key) => Object.hasOwn(mapping, key)).map((key) => [key, mapping[key]])));
    }
    return { sourceSummary: metadata.sourceSummary, mappings, version: 1 };
  }
  return undefined;
}
