/**
 * conditionEvaluator.service.ts
 *
 * P04 Task 16: Deterministic condition evaluator for approval policies.
 *
 * Evaluates a typed AST of approved operators and fields.
 * Arbitrary JavaScript is rejected — this is fail-closed.
 *
 * Supported operators:
 *   Leaf: EQ, NEQ, GT, GTE, LT, LTE, CONTAINS, STARTS_WITH, ENDS_WITH, IN, NOT_IN, IS_NULL, IS_NOT_NULL
 *   Composite: AND, OR, NOT
 *
 * Unknown operators cause a hard error (fail-closed).
 * Missing fields evaluate to false (fail-closed).
 */

export type ConditionOperator =
    | 'EQ' | 'NEQ'
    | 'GT' | 'GTE' | 'LT' | 'LTE'
    | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH'
    | 'IN' | 'NOT_IN'
    | 'IS_NULL' | 'IS_NOT_NULL'
    | 'AND' | 'OR' | 'NOT';

export interface ConditionAST {
    operator: ConditionOperator;
    /** Field path for leaf operators (e.g. 'amount', 'request.priority') */
    field?: string;
    /** Value for leaf operators */
    value?: unknown;
    /** Children for composite operators (AND, OR, NOT) */
    children?: ConditionAST[];
}

// Allowed operators for fail-closed validation
const ALLOWED_OPERATORS = new Set<ConditionOperator>([
    'EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE',
    'CONTAINS', 'STARTS_WITH', 'ENDS_WITH',
    'IN', 'NOT_IN', 'IS_NULL', 'IS_NOT_NULL',
    'AND', 'OR', 'NOT',
]);

const COMPOSITE_OPERATORS = new Set<ConditionOperator>(['AND', 'OR', 'NOT']);
const LEAF_OPERATORS = new Set<ConditionOperator>([
    'EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE',
    'CONTAINS', 'STARTS_WITH', 'ENDS_WITH',
    'IN', 'NOT_IN', 'IS_NULL', 'IS_NOT_NULL',
]);

/**
 * Validate that a condition AST uses only approved operators and structure.
 * Throws on unknown operators or structural errors.
 */
export function validateCondition(ast: ConditionAST): void {
    if (!ALLOWED_OPERATORS.has(ast.operator)) {
        throw new Error(`Unknown condition operator: ${ast.operator}. Only approved typed AST operators are allowed — arbitrary evaluation is rejected (fail-closed).`);
    }

    if (COMPOSITE_OPERATORS.has(ast.operator)) {
        if (!ast.children || ast.children.length === 0) {
            throw new Error(`Composite operator ${ast.operator} requires at least one child node.`);
        }
        for (const child of ast.children) {
            validateCondition(child);
        }
        if (ast.operator === 'NOT' && ast.children.length !== 1) {
            throw new Error('NOT operator requires exactly one child.');
        }
    } else if (LEAF_OPERATORS.has(ast.operator)) {
        if (ast.operator !== 'IS_NULL' && ast.operator !== 'IS_NOT_NULL' && ast.field === undefined) {
            throw new Error(`Leaf operator ${ast.operator} requires a field.`);
        }
    }
}

/**
 * Resolve a dotted field path from a context object.
 * Returns undefined for missing paths (fail-closed — conditions on missing fields evaluate to false).
 */
function resolveField(context: Record<string, unknown>, field: string): unknown {
    const parts = field.split('.');
    let current: unknown = context;

    for (const part of parts) {
        if (current === null || current === undefined || typeof current !== 'object') {
            return undefined;
        }
        current = (current as Record<string, unknown>)[part];
    }

    return current;
}

/**
 * Compare two values for ordering. Handles numbers, strings, and dates.
 */
function compareValues(a: unknown, b: unknown): number {
    if (a === null || a === undefined || b === null || b === undefined) {
        return 0;
    }
    if (typeof a === 'number' && typeof b === 'number') {
        return a - b;
    }
    if (a instanceof Date && b instanceof Date) {
        return a.getTime() - b.getTime();
    }
    const strA = String(a);
    const strB = String(b);
    return strA.localeCompare(strB);
}

/**
 * Evaluate a condition AST against a context object.
 * Fail-closed: unknown operators throw, missing fields evaluate to false.
 */
export function evaluateCondition(ast: ConditionAST, context: Record<string, unknown>): boolean {
    // Fail-closed: reject unknown operators
    if (!ALLOWED_OPERATORS.has(ast.operator)) {
        throw new Error(`Unknown condition operator: ${ast.operator}. Fail-closed: arbitrary evaluation is rejected.`);
    }

    // Composite operators
    if (ast.operator === 'AND') {
        return (ast.children ?? []).every(child => evaluateCondition(child, context));
    }
    if (ast.operator === 'OR') {
        return (ast.children ?? []).some(child => evaluateCondition(child, context));
    }
    if (ast.operator === 'NOT') {
        if (!ast.children || ast.children.length !== 1) {
            throw new Error('NOT operator requires exactly one child.');
        }
        return !evaluateCondition(ast.children[0], context);
    }

    // Leaf operators
    const fieldValue = ast.field ? resolveField(context, ast.field) : undefined;

    // Null checks — no value needed
    if (ast.operator === 'IS_NULL') {
        return fieldValue === null || fieldValue === undefined;
    }
    if (ast.operator === 'IS_NOT_NULL') {
        return fieldValue !== null && fieldValue !== undefined;
    }

    // Fail-closed: missing fields evaluate to false for all other operators
    if (fieldValue === undefined) {
        return false;
    }

    const expectedValue = ast.value;

    switch (ast.operator) {
        case 'EQ':
            return fieldValue === expectedValue;
        case 'NEQ':
            return fieldValue !== expectedValue;
        case 'GT':
            return compareValues(fieldValue, expectedValue) > 0;
        case 'GTE':
            return compareValues(fieldValue, expectedValue) >= 0;
        case 'LT':
            return compareValues(fieldValue, expectedValue) < 0;
        case 'LTE':
            return compareValues(fieldValue, expectedValue) <= 0;
        case 'CONTAINS': {
            if (typeof fieldValue !== 'string' || typeof expectedValue !== 'string') return false;
            return fieldValue.includes(expectedValue);
        }
        case 'STARTS_WITH': {
            if (typeof fieldValue !== 'string' || typeof expectedValue !== 'string') return false;
            return fieldValue.startsWith(expectedValue);
        }
        case 'ENDS_WITH': {
            if (typeof fieldValue !== 'string' || typeof expectedValue !== 'string') return false;
            return fieldValue.endsWith(expectedValue);
        }
        case 'IN': {
            if (!Array.isArray(expectedValue)) return false;
            return expectedValue.includes(fieldValue);
        }
        case 'NOT_IN': {
            if (!Array.isArray(expectedValue)) return false;
            return !expectedValue.includes(fieldValue);
        }
        default:
            // This should never be reached due to the earlier check, but fail-closed
            throw new Error(`Unhandled condition operator: ${ast.operator}. Fail-closed.`);
    }
}

/**
 * Safely parse and validate a JSON condition string.
 * Returns the validated AST or throws on invalid/unsafe input.
 */
export function parseCondition(json: string): ConditionAST {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new Error('Invalid condition JSON: parse error.');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Invalid condition: must be a single AST node object.');
    }
    const ast = parsed as ConditionAST;
    validateCondition(ast);
    return ast;
}