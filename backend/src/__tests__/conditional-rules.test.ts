/**
 * P5-05: Conditional-field rule validation tests.
 */

import { describe, it, expect } from 'vitest';
import {
    findSelfReferences,
    findCircularDependencies,
    findInvalidReferences,
    validateConditionalRules,
} from '../services/conditionalRules.service';

describe('P5-05: Conditional-field rule validation', () => {
    describe('findSelfReferences', () => {
        it('should detect self-referencing conditions', () => {
            const fields = [
                { id: 'amount', label: 'Amount', type: 'number', required: false, showWhen: { conditions: [{ fieldId: 'amount', operator: 'gt' as const, value: 100 }] } },
                { id: 'name', label: 'Name', type: 'text', required: true },
            ];
            const refs = findSelfReferences(fields as any);
            expect(refs).toHaveLength(1);
            expect(refs[0]).toEqual({ fieldId: 'amount', conditionFieldId: 'amount' });
        });

        it('should return empty for valid cross-references', () => {
            const fields = [
                { id: 'type', label: 'Type', type: 'select', required: true, options: ['A', 'B'] },
                { id: 'detail', label: 'Detail', type: 'text', required: false, showWhen: { conditions: [{ fieldId: 'type', operator: 'eq' as const, value: 'A' }] } },
            ];
            const refs = findSelfReferences(fields as any);
            expect(refs).toHaveLength(0);
        });
    });

    describe('findCircularDependencies', () => {
        it('should detect direct circular dependency (A→B→A)', () => {
            const fields = [
                { id: 'a', label: 'A', type: 'text', required: false, showWhen: { conditions: [{ fieldId: 'b', operator: 'eq' as const, value: '1' }] } },
                { id: 'b', label: 'B', type: 'text', required: false, showWhen: { conditions: [{ fieldId: 'a', operator: 'eq' as const, value: '2' }] } },
            ];
            const cycles = findCircularDependencies(fields as any);
            expect(cycles.length).toBeGreaterThanOrEqual(1);
        });

        it('should return empty for non-circular dependencies', () => {
            const fields = [
                { id: 'type', label: 'Type', type: 'select', required: true },
                { id: 'detail', label: 'Detail', type: 'text', required: false, showWhen: { conditions: [{ fieldId: 'type', operator: 'eq' as const, value: 'A' }] } },
            ];
            const cycles = findCircularDependencies(fields as any);
            expect(cycles).toHaveLength(0);
        });

        it('should detect 3-node cycle (A→B→C→A)', () => {
            const fields = [
                { id: 'a', label: 'A', type: 'text', required: false, showWhen: { conditions: [{ fieldId: 'b', operator: 'eq' as const, value: '1' }] } },
                { id: 'b', label: 'B', type: 'text', required: false, showWhen: { conditions: [{ fieldId: 'c', operator: 'eq' as const, value: '2' }] } },
                { id: 'c', label: 'C', type: 'text', required: false, showWhen: { conditions: [{ fieldId: 'a', operator: 'eq' as const, value: '3' }] } },
            ];
            const cycles = findCircularDependencies(fields as any);
            expect(cycles.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('findInvalidReferences', () => {
        it('should detect references to non-existent fields', () => {
            const fields = [
                { id: 'name', label: 'Name', type: 'text', required: true, showWhen: { conditions: [{ fieldId: 'nonexistent', operator: 'eq' as const, value: 'x' }] } },
            ];
            const refs = findInvalidReferences(fields as any);
            expect(refs).toHaveLength(1);
            expect(refs[0].conditionFieldId).toBe('nonexistent');
        });

        it('should return empty for valid references', () => {
            const fields = [
                { id: 'type', label: 'Type', type: 'select', required: true },
                { id: 'detail', label: 'Detail', type: 'text', required: false, showWhen: { conditions: [{ fieldId: 'type', operator: 'eq' as const, value: 'A' }] } },
            ];
            const refs = findInvalidReferences(fields as any);
            expect(refs).toHaveLength(0);
        });
    });

    describe('validateConditionalRules', () => {
        it('should pass for valid config without showWhen', () => {
            const fields = [
                { id: 'name', label: 'Name', type: 'text', required: true },
            ];
            const result = validateConditionalRules(fields as any);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should pass for valid config with showWhen', () => {
            const fields = [
                { id: 'type', label: 'Type', type: 'select', required: true, options: ['A', 'B'] },
                { id: 'detail', label: 'Detail', type: 'text', required: false, showWhen: { conditions: [{ fieldId: 'type', operator: 'eq' as const, value: 'A' }] } },
            ];
            const result = validateConditionalRules(fields as any);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should fail for self-referencing showWhen', () => {
            const fields = [
                { id: 'amount', label: 'Amount', type: 'number', required: false, showWhen: { conditions: [{ fieldId: 'amount', operator: 'gt' as const, value: 100 }] } },
            ];
            const result = validateConditionalRules(fields as any);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('references itself'))).toBe(true);
        });

        it('should fail for invalid field reference', () => {
            const fields = [
                { id: 'name', label: 'Name', type: 'text', required: true, showWhen: { conditions: [{ fieldId: 'nonexistent', operator: 'eq' as const, value: 'x' }] } },
            ];
            const result = validateConditionalRules(fields as any);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('non-existent field'))).toBe(true);
        });
    });
});