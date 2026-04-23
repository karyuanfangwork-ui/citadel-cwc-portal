import React from 'react';
import financeWorkflowService from '../../services/finance-workflow.service';

interface FinanceWorkflowPanelProps {
    requestId: string;
    status: string;
    userRoles: string[];
}

export const FinanceWorkflowPanel: React.FC<FinanceWorkflowPanelProps> = ({
    requestId,
    status,
    userRoles,
}) => {
    const isAdmin = userRoles.includes('ADMIN');

    const handleManagerSubmit = async () => {
        const mgrId = prompt('Enter manager UUID:');
        if (mgrId) {
            await financeWorkflowService.submitForManager(requestId, mgrId);
            window.location.reload();
        }
    };

    const handleManagerApprove = async () => {
        await financeWorkflowService.managerDecision(requestId, 'APPROVED');
        window.location.reload();
    };

    const handleManagerReject = async () => {
        const c = prompt('Reason:');
        if (c) {
            await financeWorkflowService.managerDecision(requestId, 'REJECTED', c);
            window.location.reload();
        }
    };

    const handleFinanceHeadSubmit = async () => {
        const fid = prompt('Enter Finance Head ID:');
        if (fid) {
            await financeWorkflowService.submitForFinanceHead(requestId, fid);
            window.location.reload();
        }
    };

    const handleFinanceHeadApprove = async () => {
        await financeWorkflowService.financeHeadDecision(requestId, 'APPROVED');
        window.location.reload();
    };

    const handleFinanceHeadReject = async () => {
        const c = prompt('Reason:');
        if (c) {
            await financeWorkflowService.financeHeadDecision(requestId, 'REJECTED', c);
            window.location.reload();
        }
    };

    const handleStartPayment = async () => {
        const ref = prompt('Payment reference (optional):');
        await financeWorkflowService.markPayment(requestId, {
            paymentStatus: 'PROCESSING',
            paymentReference: ref || undefined
        });
        window.location.reload();
    };

    const handleMarkPaymentDone = async () => {
        const ref = prompt('Reference:');
        await financeWorkflowService.markPayment(requestId, {
            paymentStatus: 'COMPLETED',
            paymentReference: ref || undefined
        });
        window.location.reload();
    };

    return (
        <section className="space-y-4">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                <span className="material-symbols-outlined text-[#0052cc]">payments</span>
                <h3 className="font-bold text-xl">Finance Workflow</h3>
            </div>

            {status === 'SUBMITTED' && isAdmin && (
                <button
                    onClick={handleManagerSubmit}
                    className="px-4 py-2 bg-[#0052cc] text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Submit for Manager Approval
                </button>
            )}

            {status === 'PENDING_MANAGER_APPROVAL_FIN' && (
                <div className="flex gap-3">
                    <button
                        onClick={handleManagerApprove}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        Approve
                    </button>
                    <button
                        onClick={handleManagerReject}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Reject
                    </button>
                </div>
            )}

            {status === 'MANAGER_APPROVED_FIN' && isAdmin && (
                <button
                    onClick={handleFinanceHeadSubmit}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    Submit for Finance Head
                </button>
            )}

            {status === 'PENDING_FINANCE_HEAD_APPROVAL' && (
                <div className="flex gap-3">
                    <button
                        onClick={handleFinanceHeadApprove}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        Approve
                    </button>
                    <button
                        onClick={handleFinanceHeadReject}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Reject
                    </button>
                </div>
            )}

            {status === 'FINANCE_HEAD_APPROVED' && isAdmin && (
                <button
                    onClick={handleStartPayment}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                >
                    Start Payment
                </button>
            )}

            {status === 'PAYMENT_PROCESSING' && isAdmin && (
                <button
                    onClick={handleMarkPaymentDone}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                    Mark Payment Done
                </button>
            )}
        </section>
    );
};
