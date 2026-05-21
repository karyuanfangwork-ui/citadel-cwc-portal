import React from 'react';
import { CreditApplication } from '../../../src/services/credit.service';
import RequestsFacilitiesTab from './RequestsFacilitiesTab';

interface FacilitiesTabProps {
  application: CreditApplication;
}

const FacilitiesTab: React.FC<FacilitiesTabProps> = ({ application }) => {
  return <RequestsFacilitiesTab application={application} />;
};

export default FacilitiesTab;