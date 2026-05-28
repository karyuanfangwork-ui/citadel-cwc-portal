import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// EMAIL INTEGRATION SERVICE
// - OAuth token management, email sync, calendar sync, contact matching
// ============================================================================

interface OAuthConfig {
  GOOGLE: { authUrl: string; tokenUrl: string; scopes: string[]; clientIdEnv: string; clientSecretEnv: string };
  OUTLOOK: { authUrl: string; tokenUrl: string; scopes: string[]; clientIdEnv: string; clientSecretEnv: string };
}

const OAUTH_CONFIGS: OAuthConfig = {
  GOOGLE: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/calendar.readonly'],
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
  },
  OUTLOOK: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['Mail.Read', 'Mail.Send', 'Calendars.Read'],
    clientIdEnv: 'OUTLOOK_CLIENT_ID',
    clientSecretEnv: 'OUTLOOK_CLIENT_SECRET',
  },
};

const getEnvVar = (key: string): string => process.env[key] || '';

function getRedirectUri(provider: string): string {
  const baseUrl = process.env.API_URL || 'http://localhost:3000';
  return `${baseUrl}/api/v1/crm/integrations/${provider}/callback`;
}

export function getOAuthUrl(provider: 'GOOGLE' | 'OUTLOOK', state: string): string {
  const config = OAUTH_CONFIGS[provider];
  const clientId = getEnvVar(config.clientIdEnv);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(provider.toLowerCase()),
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${config.authUrl}?${params.toString()}`;
}

export async function handleOAuthCallback(provider: 'GOOGLE' | 'OUTLOOK', code: string, userId: string) {
  const config = OAUTH_CONFIGS[provider];
  const clientId = getEnvVar(config.clientIdEnv);
  const clientSecret = getEnvVar(config.clientSecretEnv);
  const redirectUri = getRedirectUri(provider.toLowerCase());

  const tokenRes = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!tokenRes.ok) throw new Error(`OAuth token exchange failed for ${provider}`);

  const tokens = await tokenRes.json() as any;
  const emailAddress = provider === 'GOOGLE'
    ? await getGoogleEmailAddress(tokens.access_token)
    : await getOutlookEmailAddress(tokens.access_token);

  // Upsert integration
  const integration = await prisma.crmEmailIntegration.upsert({
    where: { userId },
    create: {
      userId,
      provider,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      tokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
      emailAddress,
      syncEnabled: true,
      syncFrequency: '15min',
    },
    update: {
      provider,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      tokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
      emailAddress,
      syncEnabled: true,
    },
  });

  return integration;
}

async function getGoogleEmailAddress(accessToken: string): Promise<string> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as any;
    return data.email || '';
  } catch { return ''; }
}

async function getOutlookEmailAddress(accessToken: string): Promise<string> {
  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as any;
    return data.mail || data.userPrincipalName || '';
  } catch { return ''; }
}

export async function listIntegrations(userId: string) {
  return prisma.crmEmailIntegration.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function disconnectIntegration(id: string, userId: string) {
  const integration = await prisma.crmEmailIntegration.findFirst({ where: { id, userId } });
  if (!integration) throw new Error('Integration not found');
  await prisma.crmSyncedEmail.deleteMany({ where: { integrationId: id } });
  await prisma.crmSyncedEvent.deleteMany({ where: { integrationId: id } });
  return prisma.crmEmailIntegration.delete({ where: { id } });
}

export async function updateSyncPreferences(id: string, userId: string, data: { syncEnabled?: boolean; syncFrequency?: string }) {
  const integration = await prisma.crmEmailIntegration.findFirst({ where: { id, userId } });
  if (!integration) throw new Error('Integration not found');
  return prisma.crmEmailIntegration.update({
    where: { id },
    data: {
      ...(data.syncEnabled !== undefined && { syncEnabled: data.syncEnabled }),
      ...(data.syncFrequency && { syncFrequency: data.syncFrequency }),
    },
  });
}

// ============================================================================
// EMAIL SYNC (stubs — real implementation needs googleapis / @microsoft/microsoft-graph-client)
// ============================================================================

export async function syncEmails(integrationId: string): Promise<{ synced: number }> {
  const integration = await prisma.crmEmailIntegration.findUnique({ where: { id: integrationId } });
  if (!integration || !integration.syncEnabled) return { synced: 0 };

  // Stub: In production, this would call Gmail/Outlook APIs to fetch new messages
  // and match them against CRM contacts by email address.
  //
  // 1. Fetch messages since integration.lastSyncedAt
  // 2. For each message, extract from/to/cc
  // 3. Match against CrmContact/CrmLead/CrmAccount by email
  // 4. Create CrmSyncedEmail records
  // 5. Optionally create CrmActivity (type: EMAIL)
  // 6. Update integration.lastSyncedAt

  await prisma.crmEmailIntegration.update({
    where: { id: integrationId },
    data: { lastSyncedAt: new Date() },
  });

  return { synced: 0 };
}

export async function syncCalendarEvents(integrationId: string): Promise<{ synced: number }> {
  const integration = await prisma.crmEmailIntegration.findUnique({ where: { id: integrationId } });
  if (!integration || !integration.syncEnabled) return { synced: 0 };

  // Stub: In production, fetch calendar events and create CrmSyncedEvent + CrmActivity (type: MEETING)

  await prisma.crmEmailIntegration.update({
    where: { id: integrationId },
    data: { lastSyncedAt: new Date() },
  });

  return { synced: 0 };
}

// ============================================================================
// EMAIL QUERIES
// ============================================================================

export async function listSyncedEmails(userId: string, filters: {
  contactId?: string; leadId?: string; accountId?: string; page?: number; limit?: number;
}) {
  const integration = await prisma.crmEmailIntegration.findUnique({ where: { userId } });
  if (!integration) return { emails: [], total: 0, page: 1, limit: 20 };

  const where: any = { integrationId: integration.id };
  if (filters.contactId) where.matchedContactId = filters.contactId;
  if (filters.leadId) where.matchedLeadId = filters.leadId;
  if (filters.accountId) where.matchedAccountId = filters.accountId;

  const page = filters.page || 1;
  const limit = filters.limit || 20;

  const [emails, total] = await Promise.all([
    prisma.crmSyncedEmail.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.crmSyncedEmail.count({ where }),
  ]);

  return { emails, total, page, limit };
}

export async function getEmail(id: string) {
  return prisma.crmSyncedEmail.findUnique({ where: { id } });
}

export async function listSyncedEvents(userId: string, page = 1, limit = 20) {
  const integration = await prisma.crmEmailIntegration.findUnique({ where: { userId } });
  if (!integration) return { events: [], total: 0, page: 1, limit: 20 };

  const [events, total] = await Promise.all([
    prisma.crmSyncedEvent.findMany({
      where: { integrationId: integration.id },
      orderBy: { startTime: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.crmSyncedEvent.count({ where: { integrationId: integration.id } }),
  ]);

  return { events, total, page, limit };
}

export async function sendEmailFromCrm(userId: string, data: {
  to: string; subject: string; body: string; cc?: string; contactId?: string; leadId?: string; accountId?: string;
}) {
  const integration = await prisma.crmEmailIntegration.findUnique({ where: { userId } });
  if (!integration) throw new Error('No email integration found. Connect your Gmail or Outlook account first.');

  // Stub: In production, send via Gmail/Outlook API
  // For now, create a CrmSyncedEmail record marking it as outbound
  const email = await prisma.crmSyncedEmail.create({
    data: {
      integrationId: integration.id,
      providerMessageId: `crm-send-${Date.now()}`,
      threadId: null,
      from: JSON.stringify({ name: integration.emailAddress, email: integration.emailAddress }),
      to: JSON.stringify([{ email: data.to }]),
      cc: data.cc ? JSON.stringify([{ email: data.cc }]) : undefined,
      subject: data.subject,
      bodyPreview: data.body.substring(0, 200),
      bodyHtml: data.body,
      sentAt: new Date(),
      isFromUs: true,
      matchedContactId: data.contactId || null,
      matchedLeadId: data.leadId || null,
      matchedAccountId: data.accountId || null,
    },
  });

  // Create a CrmActivity (type: EMAIL) linked to this
  const activityData: Record<string, any> = {
    activityType: 'EMAIL',
    subject: data.subject,
    description: data.body.substring(0, 500),
    userId,
    scheduledAt: new Date(),
    completedAt: new Date(),
  };
  if (data.contactId) activityData.contactId = data.contactId;
  if (data.leadId) activityData.leadId = data.leadId;
  if (data.accountId) activityData.accountId = data.accountId;

  await prisma.crmActivity.create({ data: activityData as any });

  return email;
}

// ============================================================================
// CONTACT MATCHING
// ============================================================================

export async function matchEmailToContact(emailAddress: string): Promise<{ contactId?: string; leadId?: string; accountId?: string } | null> {
  const cleanEmail = emailAddress.toLowerCase().trim();

  // Try contact first
  const contact = await prisma.crmContact.findFirst({
    where: { email: { equals: cleanEmail, mode: 'insensitive' } },
    select: { id: true, accountId: true },
  });

  if (contact) {
    return { contactId: contact.id, accountId: contact.accountId || undefined };
  }

  // Try lead
  const lead = await prisma.crmLead.findFirst({
    where: { contactEmail: { equals: cleanEmail, mode: 'insensitive' } },
    select: { id: true, accountId: true },
  });

  if (lead) {
    return { leadId: lead.id, accountId: lead.accountId || undefined };
  }

  // Try account (if email matches a known account domain)
  const account = await prmAcountFindByEmailDomain(cleanEmail);
  if (account) {
    return { accountId: account.id };
  }

  return null;
}

async function prmAcountFindByEmailDomain(email: string) {
  const domain = email.split('@')[1];
  if (!domain) return null;
  return prisma.crmAccount.findFirst({
    where: { website: { contains: domain, mode: 'insensitive' } },
    select: { id: true },
  });
}

export default {
  getOAuthUrl,
  handleOAuthCallback,
  listIntegrations,
  disconnectIntegration,
  updateSyncPreferences,
  syncEmails,
  syncCalendarEvents,
  listSyncedEmails,
  getEmail,
  listSyncedEvents,
  sendEmailFromCrm,
  matchEmailToContact,
};