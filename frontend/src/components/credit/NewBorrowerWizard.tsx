import React from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../ui/Modal';
import { Button } from '../ui/Button';

export interface NewBorrowerWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const NewBorrowerWizard: React.FC<NewBorrowerWizardProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const handOffToCanonicalCreation = () => {
    navigate('/credit/borrowers/new?returnTo=application');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Borrower"
      size="md"
      footer={(
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="arrow_forward" iconPosition="right" onClick={handOffToCanonicalCreation}>
            Continue to borrower creation
          </Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-3 text-sm text-text-secondary">
        <p className="font-semibold text-text-primary">Create the borrower in the full borrower workflow.</p>
        <p>
          The full workflow verifies identity, searches existing borrower records, and captures the information required before a credit application is started.
        </p>
      </div>
    </Modal>
  );
};

export default NewBorrowerWizard;
