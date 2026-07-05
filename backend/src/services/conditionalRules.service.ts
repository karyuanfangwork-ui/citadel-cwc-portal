/**
 * P5-05: Conditional-field rule validation utilities.
 *
 * Validates showWhen rules on form config for:
 * - Self-references (field referencing itself)
 * - Circular dependencies (A depends on B depends on A)
 * - Empty/invalid field references
 */

import { formFieldSchema } from '../validators/serviceDesk.validator';

interface Condition {
    fieldId: string;
    operator: string;
    value?: unknown;
}

interface ConditionalRule {
    operator?: 'and' | 'or';
    conditions: Condition[];
}

interface FormField {
    id: string;
    label: string;
    type: string;
    required: boolean;
    options?: string[];
    showWhen?: ConditionalRule;
}

/**
 * Validate a form config array using Zod.
 * Returns parsed data or throws ZodError.
 */
export function validateFormConfig(config: unknown) {
    return formFieldSchema.array().safeParse(config);
}

/**
 * Check for self-references in showWhen rules.
 * A field must not reference its own fieldId in its conditions.
 */
export function findSelfReferences(fields: FormField[]): { fieldId: string; conditionFieldId: string }[] {
    const violations: { fieldId: string; conditionFieldId: string }[] = [];

    for (const field of fields) {
        if (!field.showWhen) continue;
        for (const condition of field.showWhen.conditions) {
            if (condition.fieldId === field.id) {
                violations.push({ fieldId: field.id, conditionFieldId: condition.fieldId });
            }
        }
    }

    return violations;
}

/**
 * Check for circular dependencies in showWhen rules.
 * A circular dependency exists when field A depends on B and B depends on A
 * (or longer cycles like A→B→C→A).
 *
 * Uses DFS cycle detection.
 */
export function findCircularDependencies(fields: FormField[]): string[][] {
    const adjacency = new Map<string, Set<string>>();

    // Build adjacency list: field → set of fields it depends on
    for (const field of fields) {
        if (!field.showWhen) continue;
        const deps = new Set<string>();
        for (const condition of field.showWhen.conditions) {
            if (condition.fieldId && condition.fieldId !== field.id) {
                deps.add(condition.fieldId);
            }
        }
        if (deps.size > 0) {
            adjacency.set(field.id, deps);
        }
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();

    function dfs(node: string, path: string[]): void {
        if (inStack.has(node)) {
            // Found a cycle — extract it
            const cycleStart = path.indexOf(node);
            if (cycleStart !== -1) {
                cycles.push([...path.slice(cycleStart), node]);
            }
            return;
        }
        if (visited.has(node)) return;

        visited.add(node);
        inStack.add(node);
        path.push(node);

        const deps = adjacency.get(node);
        if (deps) {
            for (const dep of deps) {
                dfs(dep, [...path]);
            }
        }

        inStack.delete(node);
    }

    for (const fieldId of adjacency.keys()) {
        if (!visited.has(fieldId)) {
            dfs(fieldId, []);
        }
    }

    return cycles;
}

/**
 * Validate that all field references in showWhen conditions point to existing fields.
 */
export function findInvalidReferences(fields: FormField[]): { fieldId: string; conditionFieldId: string }[] {
    const fieldIds = new Set(fields.map(f => f.id));
    const violations: { fieldId: string; conditionFieldId: string }[] = [];

    for (const field of fields) {
        if (!field.showWhen) continue;
        for (const condition of field.showWhen.conditions) {
            if (condition.fieldId && !fieldIds.has(condition.fieldId)) {
                violations.push({ fieldId: field.id, conditionFieldId: condition.fieldId });
            }
        }
    }

    return violations;
}

/**
 * Full validation of a form config with conditional rules.
 * Returns an object with isValid boolean and any errors.
 */
export function validateConditionalRules(fields: FormField[]): {
    isValid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    // Zod structural validation
    const zodResult = validateFormConfig(fields);
    if (!zodResult.success) {
        for (const issue of zodResult.error.errors) {
            errors.push(`Form config validation error: ${issue.message} at path ${issue.path.join('.')}`);
        }
    }

    // Self-reference check
    const selfRefs = findSelfReferences(fields);
    for (const ref of selfRefs) {
        errors.push(`Field "${ref.fieldId}" references itself in its showWhen condition.`);
    }

    // Circular dependency check
    const cycles = findCircularDependencies(fields);
    for (const cycle of cycles) {
        errors.push(`Circular dependency detected: ${cycle.join(' → ')}`);
    }

    // Invalid reference check
    const invalidRefs = findInvalidReferences(fields);
    for (const ref of invalidRefs) {
        errors.push(`Field "${ref.fieldId}" references non-existent field "${ref.conditionFieldId}" in its showWhen condition.`);
    }

    return { isValid: errors.length === 0, errors };
}