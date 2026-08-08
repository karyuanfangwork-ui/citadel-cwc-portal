import { describe, expect, it } from 'vitest';
import { filterRequestTypes } from '../useAdminState';

describe('service catalog request type filters', () => {
    const services = [
        { name: 'Laptop Request', description: 'New device', code: 'LAP', isActive: true, lifecycleStatus: 'PUBLISHED' },
        { name: 'Laptop Return', description: 'Return device', code: 'RET', isActive: false, lifecycleStatus: 'RETIRED' },
        { name: 'Access Request', description: 'System access', code: 'ACC', isActive: true, lifecycleStatus: 'DRAFT' },
    ];

    it('filters by search, availability, and lifecycle together', () => {
        expect(filterRequestTypes(services, 'device', 'INACTIVE', 'RETIRED')).toEqual([services[1]]);
    });

    it('matches service codes and returns all services for all filters', () => {
        expect(filterRequestTypes(services, 'acc', 'ALL', 'ALL')).toEqual([services[2]]);
        expect(filterRequestTypes(services, '', 'ALL', 'ALL')).toEqual(services);
    });
});
