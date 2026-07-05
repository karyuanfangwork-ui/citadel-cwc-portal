/**
 * P5-05: Conditional-field rule evaluator for frontend runtime.
 *
 * Evaluates showWhen rules against current form values to determine
 * whether a field should be visible.
 */

interface Condition {
    fieldId: string;
    operator: 'eq' | 'neq' | 'contains' | 'startsWith' | 'gt' | 'gte' | 'lt' | 'lte' | 'empty' | 'notEmpty' | 'in';
    value?: string | number | boolean | string[];
}

interface ConditionalRule {
    operator?: 'and' | 'or';
    conditions: Condition[];
}

type FormValues = Record<string, unknown>;

/**
 * Evaluate a single condition against form values.
 */
function evaluateCondition(condition: Condition, values: FormValues): boolean {
    const fieldValue = values[condition.fieldId];

    switch (condition.operator) {
        case 'eq':
            return fieldValue === condition.value;
        case 'neq':
            return fieldValue !== condition.value;
        case 'contains':
            if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
                return fieldValue.includes(condition.value);
            }
            return false;
        case 'startsWith':
            if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
                return fieldValue.startsWith(condition.value);
            }
            return false;
        case 'gt':
            return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue > condition.value;
        case 'gte':
            return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue >= condition.value;
        case 'lt':
            return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue < condition.value;
        case 'lte':
            return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue <= condition.value;
        case 'empty':
            return fieldValue === undefined || fieldValue === null || fieldValue === '';
        case 'notEmpty':
            return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
        case 'in':
            if (Array.isArray(condition.value) && fieldValue !== undefined) {
                return condition.value.includes(String(fieldValue));
            }
            return false;
        default:
            return false;
    }
}

/**
 * Evaluate a conditional rule against form values.
 * Returns true if the field should be visible, false if it should be hidden.
 *
 * For 'and' operator: all conditions must be true.
 * For 'or' operator: at least one condition must be true.
 * Fields without showWhen are always visible (return true).
 */
export function evaluateShowWhen(rule: ConditionalRule | undefined, values: FormValues): boolean {
    if (!rule) return true; // No rule = always visible

    const { operator = 'and', conditions } = rule;

    if (conditions.length === 0) return true;

    if (operator === 'or') {
        return conditions.some(cond => evaluateCondition(cond, values));
    }

    // 'and' operator (default)
    return conditions.every(cond => evaluateCondition(cond, values));
}

/**
 * Filter form fields based on showWhen rules and current form values.
 * Returns only the fields that should be visible.
 */
export function filterVisibleFields<T extends { showWhen?: ConditionalRule }>(
    fields: T[],
    values: FormValues,
): T[] {
    return fields.filter(field => evaluateShowWhen(field.showWhen, values));
}

/**
 * Get field IDs that should be hidden based on showWhen rules and current values.
 * Useful for clearing hidden field values from form state.
 */
export function getHiddenFieldIds<T extends { id: string; showWhen?: ConditionalRule }>(
    fields: T[],
    values: FormValues,
): string[] {
    return fields
        .filter(field => !evaluateShowWhen(field.showWhen, values))
        .map(field => field.id);
}

export type { Condition, ConditionalRule, FormValues };