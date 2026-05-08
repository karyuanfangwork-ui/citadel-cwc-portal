import { useState, useEffect, useMemo } from 'react';
import { serviceDeskService } from '../../services/serviceDesk.service';
import { entityService } from '../../services/entity.service';
import { friendlyMessage } from '../../utils/errorMessages';
import { useAuth } from '../../context/AuthContext';

export type WizardStep = 'type' | 'details' | 'review';

export interface FormData {
  summary: string;
  description: string;
  urgency: string;
  isConfidential: boolean;
  customFields: Record<string, any>;
}

export const URGENCY_OPTIONS = [
  { value: 'LOW', label: 'Low - General inquiry or minor issue' },
  { value: 'MEDIUM', label: 'Medium - Significant issue for a single user' },
  { value: 'HIGH', label: 'High - Significant issue for multiple users' },
  { value: 'CRITICAL', label: 'Critical - System wide issue or total work stoppage' },
];

export const KB_ARTICLES = [
  { title: 'How to reset your corporate VPN', excerpt: 'Follow these steps if you\'re unable to establish a secure connection or lost your credentials...' },
  { title: 'Setting up MFA for the first time', excerpt: 'Multi-factor authentication is required for all internal tools. Learn how to configure your...' },
  { title: 'Common connection error codes', excerpt: 'A glossary of common error codes (403, 502, etc.) and what they mean for your setup.' },
];

export function useCreateRequestWizard(deskId: string, categoryId: string, deskType: string) {
  const [step, setStep] = useState<WizardStep>('type');
  const [selectedRequestType, setSelectedRequestType] = useState<any>(null);
  const [category, setCategory] = useState<any>(null);
  const [requestTypes, setRequestTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [entityOptions, setEntityOptions] = useState<{ code: string; name: string }[]>([]);

  const [formData, setFormData] = useState<FormData>({
    summary: '',
    description: '',
    urgency: 'MEDIUM',
    isConfidential: false,
    customFields: {},
  });

  const { user } = useAuth();

  const isRoleBlocked = !!(
    selectedRequestType?.requiredRole &&
    !user?.roles?.includes(selectedRequestType.requiredRole)
  );

  // Fetch category and request types
  useEffect(() => {
    if (deskId && categoryId) {
      fetchData();
    }
  }, [deskId, categoryId]);

  // Fetch entity list for entity-type dropdown fields
  useEffect(() => {
    entityService.listActiveEntities()
      .then(setEntityOptions)
      .catch(() => setEntityOptions([]));
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const cats = await serviceDeskService.getCategories(deskId!);
      const currentCat = cats.find((c: any) => c.id === categoryId);
      setCategory(currentCat || null);

      const types = await serviceDeskService.getRequestTypes(deskId!, categoryId);

      if (types && types.length > 0) {
        setRequestTypes(types);

        // Auto-select first type if only one exists
        if (types.length === 1) {
          handleRequestTypeChange(types[0]);
        }
      } else {
        setError('No active request types found for this category.');
      }
    } catch (err: any) {
      console.error('Error fetching request data:', err);
      setError(friendlyMessage(err, 'Unable to load request form. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRequestTypeChange = (type: any) => {
    setSelectedRequestType(type);

    // Initialize custom fields for the selected type
    const initialCustom: any = {};
    if (type.formConfig) {
      type.formConfig.forEach((field: any) => {
        initialCustom[field.id] = '';
      });
    }
    setFormData(prev => ({
      ...prev,
      customFields: initialCustom,
      summary: '',
      description: '',
    }));
  };

  const handleCustomFieldChange = (fieldId: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        [fieldId]: value,
      },
    }));
  };

  const canProceed = useMemo(() => {
    switch (step) {
      case 'type': return !!selectedRequestType;
      case 'details': return !!formData.summary.trim();
      case 'review': return true;
    }
  }, [step, selectedRequestType, formData]);

  const next = () => {
    if (!canProceed) return;
    switch (step) {
      case 'type': setStep('details'); break;
      case 'details': setStep('review'); break;
    }
  };

  const back = () => {
    switch (step) {
      case 'details': setStep('type'); break;
      case 'review': setStep('details'); break;
    }
  };

  const getDeskName = () => {
    switch (deskType) {
      case 'it': return 'IT Support';
      case 'hr': return 'HR Services';
      case 'finance': return 'Group Finance';
      default: return 'Service Desk';
    }
  };

  return {
    step,
    setStep,
    canProceed,
    next,
    back,
    selectedRequestType,
    setSelectedRequestType: handleRequestTypeChange,
    formData,
    setFormData,
    requestTypes,
    category,
    loading,
    submitting,
    setSubmitting,
    error,
    setError,
    entityOptions,
    uploadingFields,
    setUploadingFields,
    isRoleBlocked,
    handleCustomFieldChange,
    getDeskName,
  };
}