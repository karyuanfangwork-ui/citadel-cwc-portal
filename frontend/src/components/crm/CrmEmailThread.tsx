import React, { useState, useEffect, useCallback } from 'react';
import crmService from '../../services/crm.service';

interface SyncedEmail {
  id: string;
  providerMessageId: string;
  threadId: string | null;
  from: any;
  to: any;
  subject: string;
  bodyPreview: string | null;
  sentAt: string;
  isFromUs: boolean;
  matchedContactId: string | null;
  matchedLeadId: string | null;
}

interface Props {
  contactId?: string;
  leadId?: string;
  accountId?: string;
}

export default function CrmEmailThread({ contactId, leadId, accountId }: Props) {
  const [emails, setEmails] = useState<SyncedEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [emailBody, setEmailBody] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);

  const loadEmails = useCallback(async () => {
    try {
      setLoading(true);
      const result = await crmService.listSyncedEmails({ contactId, leadId, accountId, page, limit: 20 });
      setEmails(result.emails);
      setTotal(result.total);
    } catch { setEmails([]); } finally { setLoading(false); }
  }, [contactId, leadId, accountId, page]);

  useEffect(() => { loadEmails(); }, [loadEmails]);

  const openEmail = async (id: string) => {
    setSelectedId(id);
    try {
      const email = await crmService.getEmail(id);
      setEmailBody(email.bodyHtml || email.bodyPreview || '');
    } catch { setEmailBody('Failed to load email body'); }
  };

  const handleSend = async () => {
    if (!composeTo || !composeSubject || !composeBody) return;
    setSending(true);
    try {
      await crmService.sendEmail({
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
        contactId,
        leadId,
        accountId,
      });
      setShowCompose(false);
      setComposeTo(''); setComposeSubject(''); setComposeBody('');
      loadEmails();
    } catch { } finally { setSending(false); }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Emails ({total})</h3>
        <button onClick={() => setShowCompose(true)} style={{ padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          + Compose
        </button>
      </div>

      {showCompose && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <input value={composeTo} onChange={e => setComposeTo(e.target.value)} placeholder="To" style={{ width: '100%', padding: 8, marginBottom: 8, border: '1px solid #d1d5db', borderRadius: 4 }} />
          <input value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Subject" style={{ width: '100%', padding: 8, marginBottom: 8, border: '1px solid #d1d5db', borderRadius: 4 }} />
          <textarea value={composeBody} onChange={e => setComposeBody(e.target.value)} placeholder="Write your email..." rows={6} style={{ width: '100%', padding: 8, marginBottom: 8, border: '1px solid #d1d5db', borderRadius: 4, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSend} disabled={sending} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: sending ? 'not-allowed' : 'pointer' }}>
              {sending ? 'Sending...' : 'Send'}
            </button>
            <button onClick={() => setShowCompose(false)} style={{ padding: '8px 20px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Loading emails...</div>
      ) : emails.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>No synced emails yet. Connect your email account in Settings.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {emails.map(email => {
            const from = typeof email.from === 'object' ? (email.from as any).email || (email.from as any).name : String(email.from);
            const isSelected = selectedId === email.id;
            return (
              <div
                key={email.id}
                onClick={() => openEmail(email.id)}
                style={{
                  padding: '12px 16px',
                  border: `1px solid ${isSelected ? '#2563eb' : '#e5e7eb'}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: isSelected ? '#eff6ff' : email.isFromUs ? '#f9fafb' : '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: email.isFromUs ? 400 : 600, fontSize: 14 }}>
                    {email.isFromUs ? 'You' : from}
                  </span>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{new Date(email.sentAt).toLocaleDateString()}</span>
                </div>
                <div style={{ fontSize: 14, marginTop: 4 }}>{email.subject}</div>
                {email.bodyPreview && (
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {email.bodyPreview.substring(0, 120)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '4px 12px', border: '1px solid #d1d5db', borderRadius: 4, cursor: page === 1 ? 'not-allowed' : 'pointer' }}>Prev</button>
          <span style={{ padding: '4px 8px', fontSize: 14 }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '4px 12px', border: '1px solid #d1d5db', borderRadius: 4, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>Next</button>
        </div>
      )}

      {selectedId && emailBody && (
        <div style={{ marginTop: 16, border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
          <h4 style={{ margin: '0 0 8px' }}>Email Preview</h4>
          <div style={{ fontSize: 14, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: emailBody }} />
        </div>
      )}
    </div>
  );
}