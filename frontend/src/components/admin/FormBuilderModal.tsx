import React from 'react';
import FormBuilder from '../FormBuilder';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { parseFormConfig } from '../../utils/formConfig';

interface FormBuilderModalProps {
    isOpen: boolean;
    selectedType: any | null;
    onSave: (fields: any[]) => void;
    onClose: () => void;
}

export const FormBuilderModal: React.FC<FormBuilderModalProps> = ({
    isOpen,
    selectedType,
    onSave,
    onClose,
}) => {
    const containerRef = useFocusTrap(isOpen);
    useEscapeKey(isOpen ? onClose : () => {});

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="Configure Form Fields">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" ref={containerRef}>
                <FormBuilder
                    initialFields={parseFormConfig(selectedType?.formConfig)}
                    onSave={onSave}
                    onCancel={onClose}
                    title={`Configure Form: ${selectedType?.name}`}
                />
            </div>
        </div>
    );
};