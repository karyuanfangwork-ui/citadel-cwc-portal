import { assertHrExecutiveTransition } from '../services/hrExecutiveTransitionPolicy';

const selected = {
  requestType: { code: 'NEW_HIRING' }, status: 'SUBMITTED',
  executiveApproverId: 'ceo-1', executiveApproverRole: 'CEO',
};

test('HR routing needs a matching saved choice and atomic approval insertion', () => {
  expect(() => assertHrExecutiveTransition(selected, 'PENDING_CEO_APPROVAL', 'agent', true)).not.toThrow();
  expect(() => assertHrExecutiveTransition(selected, 'PENDING_GROUP_DCEO_APPROVAL', 'agent', true)).toThrow();
  expect(() => assertHrExecutiveTransition(selected, 'PENDING_CEO_APPROVAL', 'agent', false)).toThrow();
  expect(() => assertHrExecutiveTransition({ ...selected, executiveApproverId: null }, 'PENDING_CEO_APPROVAL', 'agent', true)).toThrow();
});

test('only the selected executive can decide and no second gate follows', () => {
  const pending = { ...selected, status: 'PENDING_CEO_APPROVAL' };
  expect(() => assertHrExecutiveTransition(pending, 'CEO_APPROVED', 'ceo-1', true)).not.toThrow();
  expect(() => assertHrExecutiveTransition(pending, 'CEO_APPROVED', 'ceo-2', true)).toThrow();
  expect(() => assertHrExecutiveTransition(pending, 'CEO_REJECTED', 'ceo-1', false)).toThrow();
  expect(() => assertHrExecutiveTransition({ ...selected, status: 'CEO_APPROVED' }, 'PENDING_GROUP_DCEO_APPROVAL', 'agent', true)).toThrow();
  expect(() => assertHrExecutiveTransition({ ...selected, status: 'CEO_APPROVED' }, 'JOB_POSTED', 'agent', false)).not.toThrow();
});

test('DCEO route/decision works while Finance and ESM remain unaffected', () => {
  const dceo = { ...selected, executiveApproverId: 'dceo-1', executiveApproverRole: 'GROUP_DCEO' };
  expect(() => assertHrExecutiveTransition(dceo, 'PENDING_GROUP_DCEO_APPROVAL', 'agent', true)).not.toThrow();
  expect(() => assertHrExecutiveTransition({ ...dceo, status: 'PENDING_GROUP_DCEO_APPROVAL' }, 'GROUP_DCEO_APPROVED', 'dceo-1', true)).not.toThrow();
  for (const code of ['CWC_TRAVEL_REQUEST', 'PURCHASE_REQUISITION']) {
    expect(() => assertHrExecutiveTransition({ ...selected, requestType: { code }, status: 'CEO_APPROVED' }, 'PENDING_GROUP_DCEO_APPROVAL', 'agent', false)).not.toThrow();
  }
});
