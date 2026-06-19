import { resolveRequiredFields, RuleScope } from './creditRuleEngine.service';

function getByPath(obj: Record<string, any>, path: string): unknown {
  return path.split('.').reduce<any>((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

export async function checkRequiredFields(
  scope: RuleScope,
  payload: Record<string, any>,
): Promise<{ ok: boolean; missing: { fieldPath: string; label: string }[] }> {
  const fields = await resolveRequiredFields(scope);

  const missing = fields
    .filter((field) => field.isMandatory && isEmpty(getByPath(payload, field.fieldPath)))
    .map((field) => ({ fieldPath: field.fieldPath, label: field.label }));

  return { ok: missing.length === 0, missing };
}
