export function getPostCreateDestination(borrowerId: string, returnTo: string | null): string {
  if (returnTo === 'application') {
    return `/credit/applications/new?borrowerId=${borrowerId}`;
  }

  return `/credit/borrowers/${borrowerId}`;
}
