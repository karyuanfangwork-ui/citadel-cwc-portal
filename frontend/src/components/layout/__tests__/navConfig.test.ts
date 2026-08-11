import { describe, expect, it } from 'vitest';
import { buildNavLinks } from '../navConfig';

const user = (permissions: string[] = []) => ({
  id: 'user-1',
  email: 'officer@test.local',
  firstName: 'Credit',
  lastName: 'Officer',
  permissions,
});

describe('shared portal navigation', () => {
  it('shows ESM, CRM, and Credit as shared destinations when authorised', () => {
    const links = buildNavLinks(user(['crm:read', 'credit:read']));
    expect(links.find((link) => link.to === '/esm')).toMatchObject({
      label: 'Executive Services',
      group: 'service-desks',
      show: true,
    });
    expect(links.find((link) => link.to === '/crm')).toMatchObject({ show: true });
    expect(links.find((link) => link.to === '/credit')).toMatchObject({ show: true });
  });

  it('hides Credit without credit:read', () => {
    expect(buildNavLinks(user()).find((link) => link.to === '/credit')?.show).toBe(false);
  });

  it('does not put borrower actions in the global rail', () => {
    const paths = buildNavLinks(user(['credit:read', 'credit:create'])).map((link) => link.to);
    expect(paths).not.toContain('/credit/borrowers');
    expect(paths).not.toContain('/credit/borrowers/new');
  });

  it('keeps notifications out of the global rail because the header bell is the access point', () => {
    const paths = buildNavLinks(user()).map((link) => link.to);
    expect(paths).not.toContain('/inbox');
  });

  it('shows My Approvals only with credit:approve', () => {
    expect(buildNavLinks(user(['credit:read'])).find((link) => link.to === '/approvals')?.show).toBe(false);
    expect(buildNavLinks(user(['credit:approve'])).find((link) => link.to === '/approvals')?.show).toBe(true);
  });

  it('shows administration only with admin:access', () => {
    expect(buildNavLinks(user(['credit:read'])).find((link) => link.to === '/admin/settings')?.show).toBe(false);
    expect(buildNavLinks(user(['admin:access'])).find((link) => link.to === '/admin/settings')?.show).toBe(true);
  });
});
