import React from 'react';
import { Link } from 'react-router-dom';
import { CreditApplication } from '../../../src/services/credit.service';
import EmptyState from '../../../src/components/EmptyState';

interface DocumentsTabProps {
  app: CreditApplication;
}

const DocumentsTab: React.FC<DocumentsTabProps> = ({ app }) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Documents</h3>
      </div>
      <EmptyState
        icon="folder_open"
        title="No Documents"
        description="Upload supporting documents for this application. Documents are managed on the Borrower Profile page."
        actionLabel="Go to Borrower Profile"
        onAction={() => { window.location.href = `/credit/borrowers/${app.borrowerProfileId}`; }}
      />
    </div>
  );
};

export default DocumentsTab;