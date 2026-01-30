const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateFinanceCurrencyFields() {
    try {
        console.log('💰 Updating Finance Purchase Request to use currency fields...\n');

        // Find the Finance desk
        const financeDesk = await prisma.serviceDesk.findUnique({
            where: { code: 'FINANCE' },
            include: {
                categories: {
                    where: { name: 'Purchase Requisition' },
                    include: {
                        requestTypes: {
                            where: { name: 'Purchase Request' }
                        }
                    }
                }
            }
        });

        if (!financeDesk || financeDesk.categories.length === 0) {
            console.log('❌ Purchase Requisition category not found');
            return;
        }

        const category = financeDesk.categories[0];
        const requestType = category.requestTypes[0];

        if (!requestType) {
            console.log('❌ Purchase Request type not found');
            return;
        }

        // Update the form config to use currency type for Unit Price and Total Amount
        const updatedFormConfig = [
            { id: 'vendor_name', label: 'Vendor Name', type: 'text', required: true },
            { id: 'item_description', label: 'Item/Service Description', type: 'textarea', required: true },
            { id: 'quantity', label: 'Quantity', type: 'number', required: true },
            { id: 'unit_price', label: 'Unit Price', type: 'currency', required: true },
            { id: 'total_amount', label: 'Total Amount', type: 'currency', required: true },
            { id: 'cost_center', label: 'Cost Center / Department', type: 'text', required: true },
            { id: 'budget_code', label: 'Budget Code', type: 'text', required: false },
            { id: 'business_justification', label: 'Business Justification', type: 'textarea', required: true },
            { id: 'delivery_date', label: 'Required Delivery Date', type: 'date', required: false },
            { id: 'quotation', label: 'Vendor Quotation', type: 'file', required: false }
        ];

        await prisma.requestType.update({
            where: { id: requestType.id },
            data: { formConfig: updatedFormConfig }
        });

        console.log('✅ Updated Purchase Request form config');
        console.log('\nUpdated fields:');
        console.log('  - Unit Price: text → currency (RM with 2 decimals)');
        console.log('  - Total Amount: text → currency (RM with 2 decimals)');

        console.log('\n📊 New form configuration:');
        updatedFormConfig.forEach((field, index) => {
            const required = field.required ? '✓' : ' ';
            console.log(`  ${index + 1}. [${required}] ${field.label} (${field.type})`);
        });

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

updateFinanceCurrencyFields();
