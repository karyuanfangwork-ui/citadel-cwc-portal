import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Breadcrumbs from '../src/components/Breadcrumbs';
import { requestService } from '../src/services/request.service';
import { useToast } from '../src/context/ToastContext';
import { friendlyMessage } from '../src/utils/errorMessages';
import { useCreateRequestWizard, WizardStep } from '../src/components/create-request/useCreateRequestWizard';
import WizardStepper from '../src/components/create-request/WizardStepper';
import StepRequestType from '../src/components/create-request/StepRequestType';
import StepDetails from '../src/components/create-request/StepDetails';
import StepReview from '../src/components/create-request/StepReview';

const WIZARD_STEPS: { id: WizardStep; label: string; icon: string }[] = [
  { id: 'type', label: 'Request Type', icon: 'category' },
  { id: 'details', label: 'Details', icon: 'edit_note' },
  { id: 'review', label: 'Review & Submit', icon: 'task_alt' },
];

const CreateRequest = () => {
    const { deskId, categoryId, deskType } = useParams<{ deskId: string; categoryId: string; deskType: string }>();
    const navigate = useNavigate();
    const toast = useToast();

    const wizard = useCreateRequestWizard(deskId!, categoryId!, deskType!);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!deskId || !wizard.selectedRequestType) return;
        if (wizard.isRoleBlocked) return;

        try {
            wizard.setSubmitting(true);
            wizard.setError(null);

            const request = await requestService.createRequest({
                serviceDeskId: deskId,
                requestTypeId: wizard.selectedRequestType.id,
                summary: wizard.formData.summary,
                description: wizard.formData.description,
                priority: wizard.formData.urgency as any,
                customFields: wizard.formData.customFields,
                isConfidential: wizard.formData.isConfidential
            });

            navigate(`/request/${request.id}`);
            toast.success('Request Created', 'Your request has been submitted successfully.');
        } catch (err: any) {
            console.error('Error creating request:', err);
            wizard.setError(friendlyMessage(err, 'Failed to create request. Please try again.'));
        } finally {
            wizard.setSubmitting(false);
        }
    };

    if (wizard.loading) {
        return (
            <div className="max-w-[1240px] mx-auto px-6 py-12 flex justify-center items-center h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-700"></div>
            </div>
        );
    }

    const isUploading = Object.values(wizard.uploadingFields).some(Boolean);

    return (
        <div className="max-w-[1240px] mx-auto px-6 py-12">
            {/* Breadcrumbs */}
            <Breadcrumbs items={[
                { label: 'Home', to: '/' },
                { label: wizard.getDeskName(), to: `/${deskType}` },
                { label: wizard.category?.name || 'Category' },
                { label: 'New Request' },
            ]} />

            {/* Header */}
            <div className="mb-10">
                <h1 className="text-4xl font-bold text-text-primary mb-2">
                    {wizard.category?.name || 'Get help'}
                </h1>
                <p className="text-text-secondary text-lg">
                    Tell us what you need help with and we'll get back to you as soon as possible.
                </p>
            </div>

            <div>
                {/* Main Form Area */}
                <div className="w-full max-w-[800px]">
                    <div className="bg-white rounded-cwc-xl border border-cwc-border shadow-cwc-sm overflow-hidden border-t-4 border-t-brand-700/10">
                        {/* Wizard Stepper */}
                        <div className="px-8 pt-8">
                            <WizardStepper steps={WIZARD_STEPS} currentStep={wizard.step} />
                        </div>

                        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-8">
                            {/* Step Content */}
                            {wizard.step === 'type' && (
                                <StepRequestType
                                    requestTypes={wizard.requestTypes}
                                    selectedRequestType={wizard.selectedRequestType}
                                    onSelectType={wizard.setSelectedRequestType}
                                    loading={false}
                                    error={wizard.error}
                                />
                            )}

                            {wizard.step === 'details' && (
                                <StepDetails
                                    formData={wizard.formData}
                                    setFormData={wizard.setFormData}
                                    selectedRequestType={wizard.selectedRequestType}
                                    entityOptions={wizard.entityOptions}
                                    uploadingFields={wizard.uploadingFields}
                                    setUploadingFields={wizard.setUploadingFields}
                                    isRoleBlocked={wizard.isRoleBlocked}
                                    deskType={deskType!}
                                    submitting={wizard.submitting}
                                    error={wizard.error}
                                    setError={wizard.setError}
                                    handleCustomFieldChange={wizard.handleCustomFieldChange}
                                />
                            )}

                            {wizard.step === 'review' && (
                                <StepReview
                                    formData={wizard.formData}
                                    selectedRequestType={wizard.selectedRequestType}
                                    deskType={deskType!}
                                    entityOptions={wizard.entityOptions}
                                    isRoleBlocked={wizard.isRoleBlocked}
                                />
                            )}

                            {/* Navigation Buttons */}
                            <div className="pt-6 flex items-center gap-6 border-t border-cwc-border">
                                {wizard.step !== 'type' && (
                                    <button
                                        type="button"
                                        onClick={wizard.back}
                                        className="px-6 py-3 text-text-secondary font-bold hover:text-text-primary transition-colors flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-lg">arrow_back</span>
                                        Back
                                    </button>
                                )}

                                {wizard.step !== 'review' && (
                                    <button
                                        type="button"
                                        onClick={wizard.next}
                                        disabled={!wizard.canProceed}
                                        className="px-10 py-3 bg-brand-700 text-white font-bold rounded-cwc-md hover:bg-brand-900 transition-all shadow-cwc-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                    </button>
                                )}

                                {wizard.step === 'review' && (
                                    <button
                                        type="submit"
                                        disabled={wizard.submitting || wizard.isRoleBlocked || isUploading}
                                        className="px-10 py-3 bg-brand-700 text-white font-bold rounded-cwc-md hover:bg-brand-900 transition-all shadow-cwc-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {wizard.submitting ? 'Sending...' : isUploading ? 'Uploading...' : 'Send Request'}
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={() => navigate(-1)}
                                    className="px-6 py-3 text-text-secondary font-bold hover:text-text-primary transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateRequest;