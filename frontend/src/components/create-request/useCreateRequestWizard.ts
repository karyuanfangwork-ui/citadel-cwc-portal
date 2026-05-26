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

export interface WorkflowStepInfo {
  id: string;
  label: string;
  status: string;
  icon: string;
  displayOrder: number;
  isInitial: boolean;
  isFinal: boolean;
  slaPause: boolean;
}

export interface WorkflowInfo {
  id: string;
  code: string;
  name: string;
  steps: WorkflowStepInfo[];
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
  const [workflow, setWorkflow] = useState<WorkflowInfo | null>(null);

  const [formData, setFormData] = useState<FormData>({
    summary: '',
    description: '',
    urgency: 'MEDIUM',
    isConfidential: false,
    customFields: {},
  });

  const { user } = useAuth();

  // Auto-generate summary for hiring, offboarding, hardware, and IT help request types
  const isAutoSummary = useMemo(() => {
    if (!selectedRequestType) return false;
    const code = selectedRequestType.code || selectedRequestType.requestTypeCode || '';
    return code === 'NEW_HIRING' || code === 'EMPLOYEE_OFFBOARDING' || code === 'NEW_HARDWARE' || code === 'GET_IT_HELP' || code === 'REPORT_SYSTEM_PROBLEM' || code === 'SOFTWARE_INSTALLATION' || code === 'PURCHASE_REQUISITION' || code === 'EMAIL_MANAGEMENT' || code === 'INTERCOMPANY_CHARGEBACK';
  }, [selectedRequestType]);

  const autoSummary = useMemo(() => {
    if (!isAutoSummary) return '';

    const cf = formData.customFields;
    const code = selectedRequestType?.code || selectedRequestType?.requestTypeCode || '';

    if (code === 'EMPLOYEE_OFFBOARDING') {
      const empName = cf.employeeName || '';
      const reason = cf.reason || '';
      return empName ? `Offboard: ${empName}${reason ? ` (${reason})` : ''}` : '';
    }

    if (code === 'NEW_HARDWARE') {
      const hwName = cf.hardwareName || '';
      // Resolve field by label in case admin changed field IDs
      const formConfig = selectedRequestType?.formConfig || [];
      const resolveByLabel = (labelMatch: string): string => {
        for (const f of formConfig) {
          if (f.label && f.label.toLowerCase().includes(labelMatch.toLowerCase())) {
            if (cf[f.id]) return cf[f.id];
          }
        }
        return '';
      };
      const name = hwName || resolveByLabel('hardware name') || resolveByLabel('device type');
      if (!name) return '';
      return `Request new hardware: ${name}`;
    }

    if (code === 'SOFTWARE_INSTALLATION') {
      const formConfig = selectedRequestType?.formConfig || [];
      const resolveByLabel = (labelMatch: string): string => {
        for (const f of formConfig) {
          if (f.label && f.label.toLowerCase().includes(labelMatch.toLowerCase())) {
            if (cf[f.id]) return cf[f.id];
          }
        }
        return '';
      };
      const swName = cf.sw_name || resolveByLabel('software name') || resolveByLabel('software') || '';
      if (!swName) return '';
      const swVersion = cf.sw_version || resolveByLabel('version') || '';
      return swVersion ? `Install software: ${swName} v${swVersion}` : `Install software: ${swName}`;
    }

    if (code === 'GET_IT_HELP' || code === 'REPORT_SYSTEM_PROBLEM' || code === 'EMAIL_MANAGEMENT') {
      const desc = (formData.description || '').trim();
      if (!desc) {
        // For EMAIL_MANAGEMENT, also try building from custom fields if no description
        if (code === 'EMAIL_MANAGEMENT') {
          const formConfig = selectedRequestType?.formConfig || [];
          const resolveByLabel = (labelMatch: string): string => {
            for (const f of formConfig) {
              if (f.label && f.label.toLowerCase().includes(labelMatch.toLowerCase())) {
                if (cf[f.id]) return cf[f.id];
              }
            }
            return '';
          };
          const emailType = cf.field_email_request_type || resolveByLabel('request type') || '';
          const emailAddress = cf.field_email_address || resolveByLabel('email address') || '';
          if (!emailType && !emailAddress) return '';
          const parts = ['Email Management'];
          if (emailType) parts.push(emailType);
          if (emailAddress) parts.push(`(${emailAddress})`);
          return parts.join(': ').replace(/ \((.+)\)/, ' ($1)');
        }
        // For REPORT_SYSTEM_PROBLEM, build from form fields
        if (code === 'REPORT_SYSTEM_PROBLEM') {
          const systemName = (cf.field_system_name || '').toString().trim();
          const problemType = (cf.field_problem_type || '').toString().trim();
          if (!systemName && !problemType) return '';
          const parts = [systemName, problemType].filter(Boolean);
          return `System Problem: ${parts.join(' - ')}`;
        }
        return '';
      }
      const firstLine = desc.split('\n')[0].trim();
      const maxLen = 120;
      const prefixMap: Record<string, string> = { GET_IT_HELP: 'Get IT Help', REPORT_SYSTEM_PROBLEM: 'System Problem', EMAIL_MANAGEMENT: 'Email Management' };
      const prefix = prefixMap[code] || 'Request';
      // Reserve chars for prefix + ": "
      const summaryMaxLen = maxLen - prefix.length - 2;
      let shortSummary: string;
      if (firstLine.length <= summaryMaxLen) {
        shortSummary = firstLine;
      } else {
        const truncated = firstLine.substring(0, summaryMaxLen);
        const lastSpace = truncated.lastIndexOf(' ');
        shortSummary = lastSpace > summaryMaxLen * 0.6 ? truncated.substring(0, lastSpace) : truncated;
      }
      return `${prefix}: ${shortSummary}`;
    }

    if (code === 'PURCHASE_REQUISITION') {
      const formConfig = selectedRequestType?.formConfig || [];
      const resolveByLabel = (labelMatch: string): string => {
        for (const f of formConfig) {
          if (f.label && f.label.toLowerCase().includes(labelMatch.toLowerCase())) {
            if (cf[f.id]) return cf[f.id];
          }
        }
        return '';
      };
      const itemName = cf.itemName || resolveByLabel('item') || resolveByLabel('service name') || '';
      const estimatedCost = cf.estimatedCost || resolveByLabel('estimated cost') || '';
      if (!itemName) return '';
      const costStr = estimatedCost ? ` (RM${estimatedCost})` : '';
      return `Purchase: ${itemName}${costStr}`;
    }

    if (code === 'INTERCOMPANY_CHARGEBACK') {
      const formConfig = selectedRequestType?.formConfig || [];
      const resolveByLabel = (labelMatch: string): string => {
        for (const f of formConfig) {
          if (f.label && f.label.toLowerCase().includes(labelMatch.toLowerCase())) {
            if (cf[f.id]) return cf[f.id];
          }
        }
        return '';
      };
      const fromEntity = cf.chargeFromEntity || resolveByLabel('charge from entity') || '';
      const toEntity = cf.chargeToEntity || resolveByLabel('charge to entity') || '';
      const amount = cf.amount || resolveByLabel('amount') || '';
      if (!fromEntity && !toEntity) return '';
      // Resolve entity codes to names
      const fromName = entityOptions.find(e => e.code === fromEntity)?.name || fromEntity;
      const toName = entityOptions.find(e => e.code === toEntity)?.name || toEntity;
      const parts = ['Chargeback:'];
      if (fromName) parts.push(fromName);
      parts.push('→');
      if (toName) parts.push(toName);
      if (amount) parts.push(`(RM${Number(amount).toLocaleString()})`);
      return parts.join(' ');
    }

    // NEW_HIRING default
    const position = cf.position || '';
    const empType = cf.employmentType || '';
    const dept = cf.department || '';

    let parts: string[] = [];
    if (empType) parts.push(empType);
    if (position) parts.push(position);
    if (dept) {
      const entityName = entityOptions.find(e => e.code === dept)?.name || dept;
      parts.push(`(${entityName})`);
    }
    const summary = parts.join(' ').trim();
    return summary ? `New Hire: ${summary}` : '';
  }, [isAutoSummary, formData.customFields, entityOptions, selectedRequestType]);
  // Auto-set confidential for HR requests — all HR requests are confidential by default
  const isAutoConfidential = useMemo(() => deskType === 'hr', [deskType]);

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

    // Extract workflow if it comes embedded from the API
    if (type.workflow && type.workflow.steps && type.workflow.steps.length > 0) {
      setWorkflow({
        id: type.workflow.id,
        code: type.workflow.code,
        name: type.workflow.name,
        steps: type.workflow.steps
          .sort((a: any, b: any) => a.displayOrder - b.displayOrder)
          .map((s: any) => ({
            id: s.id,
            label: s.label,
            status: s.status,
            icon: s.icon || 'radio_button_checked',
            displayOrder: s.displayOrder,
            isInitial: s.isInitial,
            isFinal: s.isFinal,
            slaPause: s.slaPause ?? false,
          })),
      });
    } else {
      setWorkflow(null);
    }

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
      case 'details': return !!(formData.summary.trim() || isAutoSummary);
      case 'review': return true;
    }
  }, [step, selectedRequestType, formData, isAutoSummary]);

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
    autoSummary,
    isAutoSummary,
    isAutoConfidential,
    workflow,
  };
}