import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Breadcrumbs from '../src/components/Breadcrumbs';
import { requestService } from '../src/services/request.service';
import { useToast } from '../src/context/ToastContext';
import { friendlyMessage } from '../src/utils/errorMessages';
import { useCreateRequestWizard, WizardStep, KB_ARTICLES } from '../src/components/create-request/useCreateRequestWizard';
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

            <div className="flex flex-col lg:flex-row gap-10">
                {/* Main Form Area */}
                <div className="flex-grow lg:max-w-[800px]">
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

                {/* Sidebar */}
                <div className="lg:w-[360px] space-y-8">
                    {/* Knowledge Base */}
                    <div className="bg-white rounded-cwc-xl border border-cwc-border shadow-cwc-sm p-6">
                        <div className="flex items-center gap-2 text-brand-700 mb-6">
                            <span className="material-symbols-outlined">menu_book</span>
                            <h3 className="font-bold text-lg text-text-primary">Knowledge Base</h3>
                        </div>

                        <div className="bg-brand-50/50 border border-brand-100 rounded-cwc-md p-4 mb-6">
                            <p className="text-sm text-brand-700 leading-relaxed">
                                Start typing your summary to see related help articles in real-time.
                            </p>
                        </div>

                        <div className="space-y-6">
                            {KB_ARTICLES.map((article, i) => (
                                <div key={i} className="group cursor-pointer">
                                    <h4 className="font-bold text-text-primary group-hover:text-brand-700 transition-colors mb-1">{article.title}</h4>
                                    <p className="text-xs text-text-secondary line-clamp-2 leading-normal">{article.excerpt}</p>
                                </div>
                            ))}
                        </div>

                        <button className="w-full mt-8 py-3 border border-cwc-border rounded-cwc-md text-sm font-bold text-text-primary hover:bg-surface-muted transition-colors">
                            Search full knowledge base
                        </button>
                    </div>

                    {/* Immediate Help */}
                    <div className="bg-brand-900 rounded-cwc-xl p-6 text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="font-bold text-lg mb-2">Need immediate help?</h3>
                            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                                Our IT support chat is available 24/7 for urgent technical issues.
                            </p>
                            <button className="w-full py-3 bg-white text-brand-900 font-bold rounded-cwc-md hover:bg-gray-100 transition-colors">
                                Start Live Chat
                            </button>
                        </div>
                        {/* Decorative element */}
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateRequest;