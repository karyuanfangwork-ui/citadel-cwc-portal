import dotenv from 'dotenv';
import path from 'path';
import { randomUUID } from 'crypto';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const local = (value: string) => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname);
  if (!local(process.env.DATABASE_URL!) || !local(process.env.S3_ENDPOINT!) || new URL(process.env.S3_ENDPOINT!).port !== '8333') {
    throw new Error('This verification requires local database and SeaweedFS endpoints');
  }
  const { default: prisma } = await import('../src/utils/prisma');
  const accounts = await import('../src/services/crm-account-document.service');
  const leads = await import('../src/services/crm-lead-document.service');
  const { s3Service } = await import('../src/services/s3.service');
  const accountId = randomUUID();
  const leadId = randomUUID();
  const bytes = Buffer.from('%PDF-1.4\n% dedicated CRM storage verification\n%%EOF\n');
  const file = { originalname: 'local-storage-check.pdf', mimetype: 'application/pdf', size: bytes.length, buffer: bytes };
  const read = async (stream: AsyncIterable<Buffer>) => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    if (!Buffer.concat(chunks).equals(bytes)) throw new Error('Downloaded PDF differs');
  };
  try {
    const user = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true, tenantId: true } });
    if (!user) throw new Error('No local user available');
    await prisma.crmAccount.create({ data: { id: accountId, name: `[TEST] SeaweedFS ${accountId}`, ownerId: user.id, tenantId: user.tenantId } });
    const uploaded = await accounts.uploadAccountDocuments(accountId, user.id, [file], [user.id], user.tenantId);
    const doc = uploaded.documents[0];
    const listed = await accounts.listAccountDocuments(accountId, [user.id], { page: 1, limit: 20, skip: 0 }, user.tenantId);
    if (!listed.documents.some(item => item.id === doc.id)) throw new Error('Uploaded account document missing from list');
    await read((await accounts.getAccountDocumentStream(accountId, doc.id, [user.id], user.tenantId)).stream);
    await accounts.deleteAccountDocument(accountId, doc.id, [user.id], user.tenantId);
    const deleted = await prisma.crmAccountDocument.findUnique({ where: { id: doc.id } });
    if (!deleted?.deletedAt) throw new Error('Soft deletion failed');
    console.log('CRM_ACCOUNT_UPLOAD_LIST_DOWNLOAD_SOFT_DELETE=PASS');

    await prisma.crmLead.create({ data: { id: leadId, title: `[TEST] SeaweedFS ${leadId}`, ownerId: user.id, tenantId: user.tenantId } });
    const leadUpload = await leads.uploadLeadDocuments(leadId, user.id, [file], [user.id]);
    const leadDoc = leadUpload.documents[0];
    if (!(await leads.listLeadDocuments(leadId, [user.id])).documents.some(item => item.id === leadDoc.id)) throw new Error('Lead document missing');
    await read((await leads.getLeadDocumentStream(leadId, leadDoc.id, [user.id])).stream);
    await leads.deleteLeadDocument(leadId, leadDoc.id, [user.id]);
    console.log('CRM_LEAD_UPLOAD_LIST_DOWNLOAD_DELETE=PASS');
  } finally {
    // Exact randomly generated fixture IDs only; never touch pre-existing records.
    const accountObjects = await prisma.crmAccountDocument.findMany({ where: { accountId }, select: { storageKey: true } });
    const leadObjects = await prisma.crmLeadDocument.findMany({ where: { leadId }, select: { storageKey: true } });
    await Promise.all([...accountObjects, ...leadObjects].map(item => s3Service.deleteObject(item.storageKey)));
    await prisma.crmAccountDocument.deleteMany({ where: { accountId } });
    await prisma.crmLeadDocument.deleteMany({ where: { leadId } });
    await prisma.crmLead.deleteMany({ where: { id: leadId } });
    await prisma.crmAccount.deleteMany({ where: { id: accountId } });
    await prisma.$disconnect();
    console.log('DEDICATED_TEST_FIXTURES_CLEANED=YES');
  }
}
main().catch(error => { console.error('LOCAL_CRM_STORAGE_CHECK_FAILED=' + error.message); process.exitCode = 1; });
