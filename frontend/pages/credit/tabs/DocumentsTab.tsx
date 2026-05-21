import React from 'react';
import { Link } from 'react-router-dom';
import { CreditApplication } from '../../../src/services/credit.service';
import EmptyState from '../../../src/components/EmptyState';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';

interface DocumentsTabProps {
  app: CreditApplication;
}

const DocumentsTab: React.FC<DocumentsTabProps> = ({ app }) => {
  return (
    <CaMemoSection title="Documents" phase="Meta" readOnly>
      <EmptyState
        icon="folder_open"
        title="No Documents"
        description="Upload supporting documents for this application. Documents are managed on the Borrower Profile page."
        actionLabel="Go to Borrower Profile"
        onAction={() => { window.location.href = `/credit/borrowers/${app.borrowerProfileId}`; }}
      />
    </CaMemoSection>
  );
};

export default DocumentsTab;