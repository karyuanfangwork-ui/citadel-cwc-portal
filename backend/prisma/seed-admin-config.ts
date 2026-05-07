// ═══════════════════════════════════════════════════════════════
// AUTO-GENERATED ADMIN CONFIG — DO NOT EDIT BY HAND
// Generated from local DB — preserves all admin console settings
// ═══════════════════════════════════════════════════════════════

// ── Notification Templates ────────────────────────────
export const SEED_NOTIFICATION_TEMPLATES = [
  {
    "name": "action_required",
    "eventType": "ACTION_REQUIRED",
    "emailSubject": "Action Required — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#f6ad55;'>Action Required</h2><p>Hello {{userName}},</p><p>Action is needed on request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#fff3e0;color:#e65100;border-radius:4px;font-weight:600;'>ACTION NEEDED</span></p><p>Please review and take the necessary steps.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#f6ad55;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Take Action</a></p>",
    "smsBody": null,
    "pushTitle": "Action Required",
    "pushBody": "Request {{requestId}} requires your action.",
    "isActive": true
  },
  {
    "name": "approval_required",
    "eventType": "APPROVAL_REQUIRED",
    "emailSubject": "{{approverRole}} Approval Needed — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Executive Approval Required</h2><p>Hello {{userName}},</p><p><strong>{{approverRole}}</strong> approval is required for request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Approval Level</td><td style='padding:8px 12px;border:1px solid #eee;'>{{approvalLevel}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#f6ad55;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Review &amp; Approve</a></p>",
    "smsBody": null,
    "pushTitle": "Approval Required",
    "pushBody": "Request #{{requestId}} needs {{approverRole}} approval.",
    "isActive": true
  },
  {
    "name": "comment_added",
    "eventType": "COMMENT_ADDED",
    "emailSubject": "New Comment on Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>New Comment</h2><p>Hello {{userName}},</p><p><strong>{{commenterName}}</strong> added a comment on request <strong>#{{requestId}} — {{requestTitle}}</strong>:</p><div style='background:#f4f5f7;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #1a1a2e;'>{{commentText}}</div><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
    "smsBody": null,
    "pushTitle": "New Comment",
    "pushBody": "New comment on {{referenceNumber}}.",
    "isActive": true
  },
  {
    "name": "finance_acknowledged",
    "eventType": "FINANCE_ACKNOWLEDGED",
    "emailSubject": "Finance Acknowledged — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Finance Acknowledged</h2><p>Hello {{userName}},</p><p>Your finance request <strong>#{{requestId}} — {{requestTitle}}</strong> has been acknowledged by the Finance team.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e3f2fd;color:#1565c0;border-radius:4px;font-weight:600;'>ACKNOWLEDGED</span></p><p>The request is being reviewed and will be routed to the appropriate approver.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
    "smsBody": null,
    "pushTitle": "Finance Request Acknowledged",
    "pushBody": "Finance request #{{requestId}} acknowledged.",
    "isActive": true
  },
  {
    "name": "finance_cfo_decision",
    "eventType": "FINANCE_CFO_DECISION",
    "emailSubject": "CFO Decision — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>CFO Decision</h2><p>Hello {{userName}},</p><p>The CFO has made a decision on finance request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Amount</td><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;'>{{currency}} {{amount}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Decision</a></p>",
    "smsBody": null,
    "pushTitle": "CFO Decision",
    "pushBody": "CFO reviewed request #{{requestId}}.",
    "isActive": true
  },
  {
    "name": "finance_group_ceo_decision",
    "eventType": "FINANCE_GROUP_CEO_DECISION",
    "emailSubject": "Group CEO Decision — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Group CEO Decision</h2><p>Hello {{userName}},</p><p>The Group CEO has made a decision on finance request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p>This request was escalated to Group CEO level due to the amount exceeding the CFO approval threshold.</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Amount</td><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;'>{{currency}} {{amount}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Decision</a></p>",
    "smsBody": null,
    "pushTitle": "Group CEO Decision",
    "pushBody": "Group CEO reviewed request #{{requestId}}.",
    "isActive": true
  },
  {
    "name": "finance_head_approval_requested",
    "eventType": "FINANCE_HEAD_APPROVAL_REQUESTED",
    "emailSubject": "Finance Head Approval Required — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Finance Head Approval Required</h2><p>Hello {{userName}},</p><p>Finance head approval is required for request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#f6ad55;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Review &amp; Approve</a></p>",
    "smsBody": null,
    "pushTitle": "Finance Head Approval Required",
    "pushBody": "Request {{requestId}} needs finance head approval.",
    "isActive": true
  },
  {
    "name": "finance_head_decision",
    "eventType": "FINANCE_HEAD_DECISION",
    "emailSubject": "Finance Head Decision — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Finance Head Decision</h2><p>Hello {{userName}},</p><p>The finance head has made a decision on request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Decision</a></p>",
    "smsBody": null,
    "pushTitle": "Finance Head Decision",
    "pushBody": "Finance head reviewed {{requestId}}: {{decision}}.",
    "isActive": true
  },
  {
    "name": "finance_manager_approval_requested",
    "eventType": "FINANCE_MANAGER_APPROVAL_REQUESTED",
    "emailSubject": "Finance Approval Required — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Finance Approval Required</h2><p>Hello {{userName}},</p><p>Your approval is required for finance request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#f6ad55;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Review &amp; Approve</a></p>",
    "smsBody": null,
    "pushTitle": "Finance Approval Required",
    "pushBody": "Request {{requestId}} needs finance manager approval.",
    "isActive": true
  },
  {
    "name": "finance_manager_decision",
    "eventType": "FINANCE_MANAGER_DECISION",
    "emailSubject": "Finance Manager Decision — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Finance Manager Decision</h2><p>Hello {{userName}},</p><p>The finance manager has made a decision on request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Decision</a></p>",
    "smsBody": null,
    "pushTitle": "Finance Manager Decision",
    "pushBody": "Finance manager reviewed {{requestId}}: {{decision}}.",
    "isActive": true
  },
  {
    "name": "finance_payment_complete",
    "eventType": "FINANCE_PAYMENT_COMPLETE",
    "emailSubject": "Payment Complete — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#2e7d32;'>Payment Complete</h2><p>Hello {{userName}},</p><p>Payment has been completed for finance request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Amount</td><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;'>{{currency}} {{amount}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Payment Ref</td><td style='padding:8px 12px;border:1px solid #eee;'>{{paymentRef}}</td></tr></table><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>PAID</span></p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
    "smsBody": null,
    "pushTitle": "Payment Complete",
    "pushBody": "Payment for request #{{requestId}} completed.",
    "isActive": true
  },
  {
    "name": "finance_payment_update",
    "eventType": "FINANCE_PAYMENT_UPDATE",
    "emailSubject": "Payment Update — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Payment Update</h2><p>Hello {{userName}},</p><p>There is a payment status update for finance request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
    "smsBody": null,
    "pushTitle": "Payment Update",
    "pushBody": "Payment update for {{requestId}}: {{paymentStatus}}.",
    "isActive": true
  },
  {
    "name": "finance_routed_cfo",
    "eventType": "FINANCE_ROUTED_CFO",
    "emailSubject": "CFO Review — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Routed to CFO</h2><p>Hello {{userName}},</p><p>Finance request <strong>#{{requestId}} — {{requestTitle}}</strong> has been routed to the Chief Financial Officer for approval.</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Amount</td><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;'>{{currency}} {{amount}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
    "smsBody": null,
    "pushTitle": "Routed to CFO",
    "pushBody": "Request #{{requestId}} routed to CFO.",
    "isActive": true
  },
  {
    "name": "finance_ticket_closed",
    "eventType": "FINANCE_TICKET_CLOSED",
    "emailSubject": "Closed — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#2e7d32;'>Request Closed</h2><p>Hello {{userName}},</p><p>Finance request <strong>#{{requestId}} — {{requestTitle}}</strong> has been formally closed.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>CLOSED</span></p><p>All approvals and payments for this request have been completed.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
    "smsBody": null,
    "pushTitle": "Request Closed",
    "pushBody": "Finance request #{{requestId}} closed.",
    "isActive": true
  },
  {
    "name": "hardware_delivered",
    "eventType": "HARDWARE_DELIVERED",
    "emailSubject": "Delivered — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#2e7d32;'>Delivered</h2><p>Hello {{userName}},</p><p>Your request <strong>#{{requestId}} — {{requestTitle}}</strong> has been fulfilled and delivered.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>DELIVERED</span></p><p>If you have any issues, please create a new support ticket.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
    "smsBody": null,
    "pushTitle": "Hardware Ready",
    "pushBody": "Hardware for {{requestId}} is ready for pickup.",
    "isActive": true
  },
  {
    "name": "hardware_ordered",
    "eventType": "HARDWARE_ORDERED",
    "emailSubject": "Hardware Ordered — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Hardware Ordered</h2><p>Hello {{userName}},</p><p>The hardware for request <strong>#{{requestId}} — {{requestTitle}}</strong> has been ordered.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e3f2fd;color:#1565c0;border-radius:4px;font-weight:600;'>ORDERED</span></p><p>You will be notified when the item is received.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
    "smsBody": null,
    "pushTitle": "Hardware Ordered",
    "pushBody": "Hardware for {{requestId}} has been ordered.",
    "isActive": true
  },
  {
    "name": "hardware_received",
    "eventType": "HARDWARE_RECEIVED",
    "emailSubject": "Hardware Received — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Hardware Received</h2><p>Hello {{userName}},</p><p>The hardware for request <strong>#{{requestId}} — {{requestTitle}}</strong> has been received and is being prepared for provisioning.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>RECEIVED</span></p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
    "smsBody": null,
    "pushTitle": "Hardware Arrived",
    "pushBody": "Hardware for {{requestId}} has arrived.",
    "isActive": true
  },
  {
    "name": "manager_approval_required",
    "eventType": "MANAGER_APPROVAL_REQUIRED",
    "emailSubject": "Approval Needed — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Approval Required</h2><p>Hello {{userName}},</p><p>Your approval is requested for the following IT support request:</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Title</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requestTitle}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Requester</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requesterName}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#f6ad55;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Review &amp; Approve</a></p>",
    "smsBody": null,
    "pushTitle": "Approval Required",
    "pushBody": "Request {{requestId}} needs your approval.",
    "isActive": true
  },
  {
    "name": "manager_approved",
    "eventType": "MANAGER_APPROVED",
    "emailSubject": "Request #{{requestId}} — Manager Approved",
    "emailBody": "<h2 style='margin:0 0 16px;color:#2e7d32;'>Manager Approved</h2><p>Hello {{userName}},</p><p>The manager has <strong>approved</strong> request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>APPROVED</span></p><p>The request will proceed to the next stage in the workflow.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
    "smsBody": null,
    "pushTitle": "Request Approved",
    "pushBody": "Your request {{requestId}} was approved.",
    "isActive": true
  },
  {
    "name": "manager_rejected",
    "eventType": "MANAGER_REJECTED",
    "emailSubject": "Request #{{requestId}} — Manager Rejected",
    "emailBody": "<h2 style='margin:0 0 16px;color:#e53e3e;'>Manager Rejected</h2><p>Hello {{userName}},</p><p>The manager has <strong>rejected</strong> request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#fde8e8;color:#e53e3e;border-radius:4px;font-weight:600;'>REJECTED</span></p><p>Reason: {{rejectionReason}}</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
    "smsBody": null,
    "pushTitle": "Request Declined",
    "pushBody": "Your request {{requestId}} was declined.",
    "isActive": true
  },
  {
    "name": "password_reset",
    "eventType": "PASSWORD_RESET",
    "emailSubject": "Password Reset Request — Citadel Help Center",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Password Reset</h2><p>Hello {{userName}},</p><p>You requested a password reset for your Citadel Help Center account.</p><p>Click the button below to reset your password. This link expires in <strong>15 minutes</strong>.</p><p style='margin:24px 0;'><a href='{{resetUrl}}' style='display:inline-block;padding:12px 24px;background:#e53e3e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Reset Password</a></p><p style='font-size:13px;color:#666;'>If the button doesn't work, copy and paste this URL into your browser:<br/><a href='{{resetUrl}}' style='color:#1a1a2e;word-break:break-all;'>{{resetUrl}}</a></p><p style='margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:13px;color:#999;'>If you did not request this, you can safely ignore this email. Your password will remain unchanged.</p>",
    "smsBody": null,
    "pushTitle": "Password Reset",
    "pushBody": "Password reset requested for your account.",
    "isActive": true
  },
  {
    "name": "procurement_initiated",
    "eventType": "PROCUREMENT_INITIATED",
    "emailSubject": "Procurement Started — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Procurement Initiated</h2><p>Hello {{userName}},</p><p>Procurement has been initiated for request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#fff3e0;color:#e65100;border-radius:4px;font-weight:600;'>PROCUREMENT IN PROGRESS</span></p><p>The IT team is now sourcing the required hardware/software.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
    "smsBody": null,
    "pushTitle": "Procurement Started",
    "pushBody": "Procurement for {{requestId}} has begun.",
    "isActive": true
  },
  {
    "name": "request_assigned",
    "eventType": "REQUEST_ASSIGNED",
    "emailSubject": "Request #{{requestId}} Assigned to You",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Request Assigned</h2><p>Hello {{userName}},</p><p>Request <strong>#{{requestId}} — {{requestTitle}}</strong> has been assigned to <strong>{{assigneeName}}</strong>.</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Title</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requestTitle}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Assignee</td><td style='padding:8px 12px;border:1px solid #eee;'>{{assigneeName}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
    "smsBody": null,
    "pushTitle": "New Assignment",
    "pushBody": "Request {{referenceNumber}} assigned to you.",
    "isActive": true
  },
  {
    "name": "request_created",
    "eventType": "REQUEST_CREATED",
    "emailSubject": "New Request #{{requestId}} — {{requestTitle}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>New Request Submitted</h2><p>Hello {{userName}},</p><p>A new request has been submitted by <strong>{{requesterName}}</strong>:</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Title</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requestTitle}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Category</td><td style='padding:8px 12px;border:1px solid #eee;'>{{categoryName}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Priority</td><td style='padding:8px 12px;border:1px solid #eee;'>{{priority}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
    "smsBody": null,
    "pushTitle": "Request Created",
    "pushBody": "Your request {{referenceNumber}} has been submitted.",
    "isActive": true
  },
  {
    "name": "request_rejected",
    "eventType": "REQUEST_REJECTED",
    "emailSubject": "Request #{{requestId}} — Rejected by {{approverRole}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#e53e3e;'>Request Rejected</h2><p>Hello {{userName}},</p><p>Request <strong>#{{requestId}} — {{requestTitle}}</strong> has been rejected by <strong>{{approverRole}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#fde8e8;color:#e53e3e;border-radius:4px;font-weight:600;'>REJECTED</span></p><p>Reason: {{rejectionReason}}</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
    "smsBody": null,
    "pushTitle": "Request Declined",
    "pushBody": "Request {{requestId}} was declined.",
    "isActive": true
  },
  {
    "name": "request_resolved",
    "eventType": "REQUEST_RESOLVED",
    "emailSubject": "Resolved — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#2e7d32;'>Request Resolved</h2><p>Hello {{userName}},</p><p>Request <strong>#{{requestId}} — {{requestTitle}}</strong> has been resolved.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>RESOLVED</span></p><p>If the issue persists, you can reopen this request within 7 days.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
    "smsBody": null,
    "pushTitle": "Request Resolved",
    "pushBody": "Request {{referenceNumber}} has been resolved.",
    "isActive": true
  },
  {
    "name": "sla_breached",
    "eventType": "SLA_BREACHED",
    "emailSubject": "⚠️ SLA Breach — Request #{{requestId}} [{{status}}]",
    "emailBody": "<h2 style=\"margin:0 0 16px;color:#e53e3e;\">SLA Breach Alert</h2><p>Hello {{userName}},</p><p>An SLA deadline has been breached on the following request:</p><table style=\"width:100%;border-collapse:collapse;margin:16px 0;\"><tr><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;\">Reference</td><td style=\"padding:8px 12px;border:1px solid #eee;\">#{{requestId}}</td></tr><tr><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;\">Title</td><td style=\"padding:8px 12px;border:1px solid #eee;\">{{requestTitle}}</td></tr><tr><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;\">Status</td><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;\">{{status}}</td></tr><tr><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;\">Priority</td><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;\">{{priority}}</td></tr><tr><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;\">Assigned To</td><td style=\"padding:8px 12px;border:1px solid #eee;\">{{assigneeName}}</td></tr><tr><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;\">Requested By</td><td style=\"padding:8px 12px;border:1px solid #eee;\">{{requesterName}}</td></tr><tr><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;\">Category</td><td style=\"padding:8px 12px;border:1px solid #eee;\">{{categoryName}}</td></tr><tr><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;\">Type</td><td style=\"padding:8px 12px;border:1px solid #eee;\">{{requestTypeName}}</td></tr><tr><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;\">SLA Deadline</td><td style=\"padding:8px 12px;border:1px solid #eee;color:#e53e3e;font-weight:600;\">{{slaDeadline}}</td></tr></table><p style=\"margin:24px 0 0;\"><a href=\"{{appUrl}}/#/requests/{{requestUuid}}\" style=\"display:inline-block;padding:12px 24px;background:#e53e3e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;\">Take Action</a></p>",
    "smsBody": null,
    "pushTitle": "SLA Breach",
    "pushBody": "Request {{referenceNumber}} has breached its SLA.",
    "isActive": true
  },
  {
    "name": "sla_escalated",
    "eventType": "SLA_ESCALATED",
    "emailSubject": "🚨 SLA Escalation — Request #{{requestId}} [{{status}}] assigned to {{assigneeName}}",
    "emailBody": "<h2 style=\"margin:0 0 16px;color:#c05621;\">SLA Escalation Alert</h2><p>Hello {{userName}},</p><p>The following request has exceeded its SLA deadline and is being escalated to your attention:</p><table style=\"width:100%;border-collapse:collapse;margin:16px 0;\"><tr><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;\">Reference</td><td style=\"padding:8px 12px;border:1px solid #eee;\">#{{requestId}}</td></tr><tr><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;\">Title</td><td style=\"padding:8px 12px;border:1px solid #eee;\">{{requestTitle}}</td></tr><tr><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;\">Status</td><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;\">{{status}}</td></tr><tr><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;\">Priority</td><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;\">{{priority}}</td></tr><tr><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;\">Assigned To</td><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;\">{{assigneeName}}</td></tr><tr><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;\">Requested By</td><td style=\"padding:8px 12px;border:1px solid #eee;\">{{requesterName}}</td></tr><tr><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;\">Category</td><td style=\"padding:8px 12px;border:1px solid #eee;\">{{categoryName}}</td></tr><tr><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;\">Type</td><td style=\"padding:8px 12px;border:1px solid #eee;\">{{requestTypeName}}</td></tr><tr style=\"background:#fff8f1;\"><td style=\"padding:8px 12px;border:1px solid #eee;font-weight:600;color:#c05621;\">⚡ Escalation</td><td style=\"padding:8px 12px;border:1px solid #eee;\"><strong>{{escalationHours}}h</strong> after SLA breach{{escalationLabel}} — notifying <strong>{{notifyRoles}}</strong></td></tr></table><p style=\"margin:24px 0 0;\"><a href=\"{{appUrl}}/#/requests/{{requestUuid}}\" style=\"display:inline-block;padding:12px 24px;background:#c05621;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;\">Review Request</a></p>",
    "smsBody": null,
    "pushTitle": "SLA Escalation",
    "pushBody": "Request #{{referenceNumber}} has been escalated due to SLA breach.",
    "isActive": true
  },
  {
    "name": "request_status_changed",
    "eventType": "STATUS_CHANGED",
    "emailSubject": "Request #{{requestId}} — Status Updated to {{newStatus}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Status Update</h2><p>Hello {{userName}},</p><p>The status of request <strong>#{{requestId}} — {{requestTitle}}</strong> has been updated:</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Previous</td><td style='padding:8px 12px;border:1px solid #eee;'>{{oldStatus}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Current</td><td style='padding:8px 12px;border:1px solid #eee;'><span style='display:inline-block;padding:4px 12px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>{{newStatus}}</span></td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Changed By</td><td style='padding:8px 12px;border:1px solid #eee;'>{{changedBy}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
    "smsBody": null,
    "pushTitle": "Status Updated",
    "pushBody": "Request {{referenceNumber}} is now {{newStatus}}.",
    "isActive": true
  },
  {
    "name": "vp_approval_required",
    "eventType": "VP_APPROVAL_REQUIRED",
    "emailSubject": "VP Approval Needed — Request #{{requestId}}",
    "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>VP Approval Required</h2><p>Hello {{userName}},</p><p>VICE PRESIDENT approval is required for this high-value IT request:</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Title</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requestTitle}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Requester</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requesterName}}</td></tr></table><p>This request requires VP-level authorization due to the estimated value.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#f6ad55;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Review &amp; Approve</a></p>",
    "smsBody": null,
    "pushTitle": "VP Approval Required",
    "pushBody": "Request {{requestId}} requires VP approval.",
    "isActive": true
  },
  {
    "name": "vp_approved",
    "eventType": "VP_APPROVED",
    "emailSubject": "Request #{{requestId}} — VP Approved",
    "emailBody": "<h2 style='margin:0 0 16px;color:#2e7d32;'>VP Approved</h2><p>Hello {{userName}},</p><p>The Vice President has <strong>approved</strong> request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>VP APPROVED</span></p><p>The request will now proceed to procurement or fulfillment.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
    "smsBody": null,
    "pushTitle": "VP Approved",
    "pushBody": "Request {{requestId}} VP approved.",
    "isActive": true
  },
  {
    "name": "vp_rejected",
    "eventType": "VP_REJECTED",
    "emailSubject": "Request #{{requestId}} — VP Rejected",
    "emailBody": "<h2 style='margin:0 0 16px;color:#e53e3e;'>VP Rejected</h2><p>Hello {{userName}},</p><p>The Vice President has <strong>rejected</strong> request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#fde8e8;color:#e53e3e;border-radius:4px;font-weight:600;'>VP REJECTED</span></p><p>Reason: {{rejectionReason}}</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestUuid}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
    "smsBody": null,
    "pushTitle": "VP Declined",
    "pushBody": "Request {{requestId}} was declined by VP.",
    "isActive": true
  }
];

// ── Request Status Definitions ────────────────────────
export const SEED_STATUS_DEFINITIONS = [
  {
    "code": "SUBMITTED",
    "label": "Submitted",
    "description": null,
    "category": "GENERAL",
    "displayOrder": 1,
    "isActive": true
  },
  {
    "code": "IN_REVIEW",
    "label": "In Review",
    "description": null,
    "category": "GENERAL",
    "displayOrder": 2,
    "isActive": true
  },
  {
    "code": "ACTION_REQUIRED",
    "label": "Action Required",
    "description": null,
    "category": "GENERAL",
    "displayOrder": 3,
    "isActive": true
  },
  {
    "code": "APPROVED",
    "label": "Approved",
    "description": null,
    "category": "GENERAL",
    "displayOrder": 4,
    "isActive": true
  },
  {
    "code": "REJECTED",
    "label": "Rejected",
    "description": null,
    "category": "GENERAL",
    "displayOrder": 5,
    "isActive": true
  },
  {
    "code": "RESOLVED",
    "label": "Resolved",
    "description": null,
    "category": "GENERAL",
    "displayOrder": 6,
    "isActive": true
  },
  {
    "code": "IN_PROGRESS",
    "label": "In Progress",
    "description": null,
    "category": "GENERAL",
    "displayOrder": 7,
    "isActive": true
  },
  {
    "code": "WAITING",
    "label": "Waiting",
    "description": null,
    "category": "GENERAL",
    "displayOrder": 8,
    "isActive": true
  },
  {
    "code": "COMPLETED",
    "label": "Completed",
    "description": null,
    "category": "GENERAL",
    "displayOrder": 9,
    "isActive": true
  },
  {
    "code": "PENDING_CEO_APPROVAL",
    "label": "Pending CEO Approval",
    "description": null,
    "category": "HR",
    "displayOrder": 10,
    "isActive": true
  },
  {
    "code": "CEO_APPROVED",
    "label": "CEO Approved",
    "description": null,
    "category": "HR",
    "displayOrder": 11,
    "isActive": true
  },
  {
    "code": "CEO_REJECTED",
    "label": "CEO Rejected",
    "description": null,
    "category": "HR",
    "displayOrder": 12,
    "isActive": true
  },
  {
    "code": "JOB_POSTED",
    "label": "Job Posted",
    "description": null,
    "category": "HR",
    "displayOrder": 13,
    "isActive": true
  },
  {
    "code": "PENDING_MANAGER_REVIEW",
    "label": "Pending Manager Review",
    "description": null,
    "category": "HR",
    "displayOrder": 14,
    "isActive": true
  },
  {
    "code": "MANAGER_APPROVED",
    "label": "Manager Approved",
    "description": null,
    "category": "HR",
    "displayOrder": 15,
    "isActive": true
  },
  {
    "code": "INTERVIEW_SCHEDULED",
    "label": "Interview Scheduled",
    "description": null,
    "category": "HR",
    "displayOrder": 16,
    "isActive": true
  },
  {
    "code": "INTERVIEW_FEEDBACK_PENDING",
    "label": "Interview Feedback Pending",
    "description": null,
    "category": "HR",
    "displayOrder": 17,
    "isActive": true
  },
  {
    "code": "CANDIDATE_REJECTED_INTERVIEW",
    "label": "Candidate Rejected (Interview)",
    "description": null,
    "category": "HR",
    "displayOrder": 18,
    "isActive": true
  },
  {
    "code": "HR_SCREENING",
    "label": "HR Screening",
    "description": null,
    "category": "HR",
    "displayOrder": 19,
    "isActive": true
  },
  {
    "code": "LOA_PENDING_APPROVAL",
    "label": "LOA Pending Approval",
    "description": null,
    "category": "HR",
    "displayOrder": 20,
    "isActive": true
  },
  {
    "code": "LOA_APPROVED",
    "label": "LOA Approved",
    "description": null,
    "category": "HR",
    "displayOrder": 21,
    "isActive": true
  },
  {
    "code": "LOA_ISSUED",
    "label": "LOA Issued",
    "description": null,
    "category": "HR",
    "displayOrder": 22,
    "isActive": true
  },
  {
    "code": "LOA_ACCEPTED",
    "label": "LOA Accepted",
    "description": null,
    "category": "HR",
    "displayOrder": 23,
    "isActive": true
  },
  {
    "code": "ONBOARDING_SUBMITTED",
    "label": "Onboarding Submitted",
    "description": null,
    "category": "ONBOARDING",
    "displayOrder": 30,
    "isActive": true
  },
  {
    "code": "ONBOARDING_PENDING_HR_APPROVAL",
    "label": "Pending HR Approval",
    "description": null,
    "category": "ONBOARDING",
    "displayOrder": 31,
    "isActive": true
  },
  {
    "code": "ONBOARDING_PRE_ARRIVAL_SETUP",
    "label": "Pre-Arrival Setup",
    "description": null,
    "category": "ONBOARDING",
    "displayOrder": 32,
    "isActive": true
  },
  {
    "code": "ONBOARDING_READY_FOR_DAY_1",
    "label": "Ready for Day 1",
    "description": null,
    "category": "ONBOARDING",
    "displayOrder": 33,
    "isActive": true
  },
  {
    "code": "ONBOARDING_DAY_1_ORIENTATION",
    "label": "Day 1 Orientation",
    "description": null,
    "category": "ONBOARDING",
    "displayOrder": 34,
    "isActive": true
  },
  {
    "code": "ONBOARDING_WEEK_1_INTEGRATION",
    "label": "Week 1 Integration",
    "description": null,
    "category": "ONBOARDING",
    "displayOrder": 35,
    "isActive": true
  },
  {
    "code": "OFFBOARDING_SUBMITTED",
    "label": "Offboarding Submitted",
    "description": null,
    "category": "OFFBOARDING",
    "displayOrder": 36,
    "isActive": true
  },
  {
    "code": "OFFBOARDING_NOTICE_PERIOD",
    "label": "Notice Period",
    "description": null,
    "category": "OFFBOARDING",
    "displayOrder": 37,
    "isActive": true
  },
  {
    "code": "OFFBOARDING_KNOWLEDGE_TRANSFER",
    "label": "Knowledge Transfer",
    "description": null,
    "category": "OFFBOARDING",
    "displayOrder": 38,
    "isActive": true
  },
  {
    "code": "ONBOARDING_COMPLETED",
    "label": "Onboarding Completed",
    "description": null,
    "category": "ONBOARDING",
    "displayOrder": 39,
    "isActive": true
  },
  {
    "code": "OFFBOARDING_FINAL_WEEK",
    "label": "Final Week",
    "description": null,
    "category": "OFFBOARDING",
    "displayOrder": 39,
    "isActive": true
  },
  {
    "code": "OFFBOARDING_EXIT_PROCEDURES",
    "label": "Exit Procedures",
    "description": null,
    "category": "OFFBOARDING",
    "displayOrder": 40,
    "isActive": true
  },
  {
    "code": "OFFBOARDING_COMPLETED",
    "label": "Offboarding Completed",
    "description": null,
    "category": "OFFBOARDING",
    "displayOrder": 41,
    "isActive": true
  },
  {
    "code": "PROCUREMENT_IN_PROGRESS",
    "label": "Procurement In Progress",
    "description": null,
    "category": "IT",
    "displayOrder": 46,
    "isActive": true
  },
  {
    "code": "HARDWARE_ORDERED",
    "label": "Hardware Ordered",
    "description": null,
    "category": "IT",
    "displayOrder": 47,
    "isActive": true
  },
  {
    "code": "HARDWARE_RECEIVED",
    "label": "Hardware Received",
    "description": null,
    "category": "IT",
    "displayOrder": 48,
    "isActive": true
  },
  {
    "code": "SOFTWARE_PROVISIONED",
    "label": "Software Provisioned",
    "description": null,
    "category": "IT",
    "displayOrder": 49,
    "isActive": true
  },
  {
    "code": "ACKNOWLEDGED_IT",
    "label": "Acknowledged (IT)",
    "description": null,
    "category": "IT",
    "displayOrder": 50,
    "isActive": true
  },
  {
    "code": "PENDING_CEO_APPROVAL_IT",
    "label": "Pending CEO Approval (IT)",
    "description": null,
    "category": "IT",
    "displayOrder": 51,
    "isActive": true
  },
  {
    "code": "CEO_APPROVED_IT",
    "label": "CEO Approved (IT)",
    "description": null,
    "category": "IT",
    "displayOrder": 52,
    "isActive": true
  },
  {
    "code": "CEO_REJECTED_IT",
    "label": "CEO Rejected (IT)",
    "description": null,
    "category": "IT",
    "displayOrder": 53,
    "isActive": true
  },
  {
    "code": "PENDING_CTO_APPROVAL_IT",
    "label": "Pending CTO Approval (IT)",
    "description": null,
    "category": "IT",
    "displayOrder": 54,
    "isActive": true
  },
  {
    "code": "CTO_APPROVED_IT",
    "label": "CTO Approved (IT)",
    "description": null,
    "category": "IT",
    "displayOrder": 55,
    "isActive": true
  },
  {
    "code": "CTO_REJECTED_IT",
    "label": "CTO Rejected (IT)",
    "description": null,
    "category": "IT",
    "displayOrder": 56,
    "isActive": true
  },
  {
    "code": "PENDING_INVOICE_IT",
    "label": "Pending Invoice (IT)",
    "description": null,
    "category": "IT",
    "displayOrder": 57,
    "isActive": true
  },
  {
    "code": "PENDING_CFO_APPROVAL_IT",
    "label": "Pending CFO Approval (IT)",
    "description": null,
    "category": "IT",
    "displayOrder": 58,
    "isActive": true
  },
  {
    "code": "CFO_APPROVED_IT",
    "label": "CFO Approved (IT)",
    "description": null,
    "category": "IT",
    "displayOrder": 59,
    "isActive": true
  },
  {
    "code": "CFO_REJECTED_IT",
    "label": "CFO Rejected (IT)",
    "description": null,
    "category": "IT",
    "displayOrder": 60,
    "isActive": true
  },
  {
    "code": "PAYMENT_PROCESSING_IT",
    "label": "Payment Processing (IT)",
    "description": null,
    "category": "IT",
    "displayOrder": 61,
    "isActive": true
  },
  {
    "code": "PAYMENT_DONE_IT",
    "label": "Payment Done (IT)",
    "description": null,
    "category": "IT",
    "displayOrder": 62,
    "isActive": true
  },
  {
    "code": "PENDING_DELIVERY_IT",
    "label": "Pending Delivery (IT)",
    "description": null,
    "category": "IT",
    "displayOrder": 63,
    "isActive": true
  },
  {
    "code": "FINANCE_PENDING_ACK",
    "label": "Pending Finance Acknowledgement",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 70,
    "isActive": true
  },
  {
    "code": "PENDING_MANAGER_APPROVAL_FIN",
    "label": "Pending Manager Approval (Finance)",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 70,
    "isActive": true
  },
  {
    "code": "MANAGER_APPROVED_FIN",
    "label": "Manager Approved (Finance)",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 71,
    "isActive": true
  },
  {
    "code": "FINANCE_ACKNOWLEDGED",
    "label": "Finance Acknowledged",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 71,
    "isActive": true
  },
  {
    "code": "MANAGER_REJECTED_FIN",
    "label": "Manager Rejected (Finance)",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 72,
    "isActive": true
  },
  {
    "code": "FINANCE_IN_PROGRESS",
    "label": "Finance In Progress",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 72,
    "isActive": true
  },
  {
    "code": "PENDING_FINANCE_HEAD_APPROVAL",
    "label": "Pending Finance Head Approval",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 73,
    "isActive": true
  },
  {
    "code": "PENDING_CFO_APPROVAL_FIN",
    "label": "Pending CFO Approval (Finance)",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 73,
    "isActive": true
  },
  {
    "code": "CFO_APPROVED_FIN",
    "label": "CFO Approved (Finance)",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 74,
    "isActive": true
  },
  {
    "code": "FINANCE_HEAD_APPROVED",
    "label": "Finance Head Approved",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 74,
    "isActive": true
  },
  {
    "code": "CFO_REJECTED_FIN",
    "label": "CFO Rejected (Finance)",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 75,
    "isActive": true
  },
  {
    "code": "FINANCE_HEAD_REJECTED",
    "label": "Finance Head Rejected",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 75,
    "isActive": true
  },
  {
    "code": "PENDING_GROUP_CEO_APPROVAL",
    "label": "Pending Group CEO Approval",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 76,
    "isActive": true
  },
  {
    "code": "PAYMENT_PROCESSING",
    "label": "Payment Processing",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 76,
    "isActive": true
  },
  {
    "code": "PAYMENT_COMPLETED",
    "label": "Payment Completed",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 77,
    "isActive": true
  },
  {
    "code": "GROUP_CEO_APPROVED",
    "label": "Group CEO Approved",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 77,
    "isActive": true
  },
  {
    "code": "REIMBURSEMENT_CLOSED",
    "label": "Reimbursement Closed",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 78,
    "isActive": true
  },
  {
    "code": "GROUP_CEO_REJECTED",
    "label": "Group CEO Rejected",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 78,
    "isActive": true
  },
  {
    "code": "PAYMENT_PROCESSING_FIN",
    "label": "Payment Processing Finance",
    "description": "",
    "category": "FINANCE",
    "displayOrder": 79,
    "isActive": true
  },
  {
    "code": "AWAITING_PAYMENT_CONFIRMATION",
    "label": "Awaiting Payment Confirmation",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 80,
    "isActive": true
  },
  {
    "code": "PAYMENT_CONFIRMED_FIN",
    "label": "Payment Confirmed (Finance)",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 81,
    "isActive": true
  },
  {
    "code": "TICKET_CLOSED_FIN",
    "label": "Ticket Closed (Finance)",
    "description": null,
    "category": "FINANCE",
    "displayOrder": 82,
    "isActive": true
  }
];

// ── Workflow Transitions ──────────────────────────────
export const SEED_WORKFLOW_TRANSITIONS = [
  {
    "fromStatus": "ACKNOWLEDGED_IT",
    "toStatus": "PENDING_CEO_APPROVAL_IT",
    "transitionLabel": "SUBMIT",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "ACTION_REQUIRED",
    "toStatus": "IN_PROGRESS",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "ACTION_REQUIRED",
    "toStatus": "IN_REVIEW",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "ACTION_REQUIRED",
    "toStatus": "REJECTED",
    "transitionLabel": "REJECT",
    "requiresComment": true,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "ACTION_REQUIRED",
    "toStatus": "RESOLVED",
    "transitionLabel": "CLOSE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "APPROVED",
    "toStatus": "RESOLVED",
    "transitionLabel": "CLOSE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "CANDIDATE_REJECTED_INTERVIEW",
    "toStatus": "JOB_POSTED",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "CEO_APPROVED",
    "toStatus": "JOB_POSTED",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "CEO_APPROVED_IT",
    "toStatus": "PENDING_CTO_APPROVAL_IT",
    "transitionLabel": "SUBMIT",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "CEO_REJECTED",
    "toStatus": "SUBMITTED",
    "transitionLabel": "RETURN",
    "requiresComment": true,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "CEO_REJECTED_IT",
    "toStatus": "REJECTED",
    "transitionLabel": "REJECT",
    "requiresComment": true,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "CFO_APPROVED_IT",
    "toStatus": "PAYMENT_PROCESSING_IT",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "CFO_REJECTED_IT",
    "toStatus": "REJECTED",
    "transitionLabel": "REJECT",
    "requiresComment": true,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "COMPLETED",
    "toStatus": "ONBOARDING_SUBMITTED",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "CTO_APPROVED_IT",
    "toStatus": "PENDING_INVOICE_IT",
    "transitionLabel": "SUBMIT",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "CTO_REJECTED_IT",
    "toStatus": "REJECTED",
    "transitionLabel": "REJECT",
    "requiresComment": true,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "FINANCE_HEAD_APPROVED",
    "toStatus": "PAYMENT_PROCESSING",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "FINANCE_HEAD_REJECTED",
    "toStatus": "SUBMITTED",
    "transitionLabel": "RETURN",
    "requiresComment": true,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "HARDWARE_ORDERED",
    "toStatus": "HARDWARE_RECEIVED",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "HARDWARE_RECEIVED",
    "toStatus": "SOFTWARE_PROVISIONED",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "HR_SCREENING",
    "toStatus": "LOA_PENDING_APPROVAL",
    "transitionLabel": "SUBMIT",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "INTERVIEW_FEEDBACK_PENDING",
    "toStatus": "CANDIDATE_REJECTED_INTERVIEW",
    "transitionLabel": "REJECT",
    "requiresComment": true,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "INTERVIEW_FEEDBACK_PENDING",
    "toStatus": "HR_SCREENING",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "INTERVIEW_SCHEDULED",
    "toStatus": "INTERVIEW_FEEDBACK_PENDING",
    "transitionLabel": "SUBMIT",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "IN_PROGRESS",
    "toStatus": "ACTION_REQUIRED",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "IN_PROGRESS",
    "toStatus": "REJECTED",
    "transitionLabel": "REJECT",
    "requiresComment": true,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "IN_PROGRESS",
    "toStatus": "RESOLVED",
    "transitionLabel": "CLOSE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "IN_PROGRESS",
    "toStatus": "WAITING",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "IN_REVIEW",
    "toStatus": "ACTION_REQUIRED",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "IN_REVIEW",
    "toStatus": "IN_PROGRESS",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "IN_REVIEW",
    "toStatus": "REJECTED",
    "transitionLabel": "REJECT",
    "requiresComment": true,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "IN_REVIEW",
    "toStatus": "RESOLVED",
    "transitionLabel": "CLOSE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "IN_REVIEW",
    "toStatus": "WAITING",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "JOB_POSTED",
    "toStatus": "PENDING_MANAGER_REVIEW",
    "transitionLabel": "SUBMIT",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "LOA_ACCEPTED",
    "toStatus": "COMPLETED",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "LOA_APPROVED",
    "toStatus": "LOA_ISSUED",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "LOA_ISSUED",
    "toStatus": "LOA_ACCEPTED",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "LOA_PENDING_APPROVAL",
    "toStatus": "LOA_APPROVED",
    "transitionLabel": "APPROVE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "LOA_PENDING_APPROVAL",
    "toStatus": "LOA_REJECTED",
    "transitionLabel": "REJECT",
    "requiresComment": true,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "MANAGER_APPROVED_FIN",
    "toStatus": "PENDING_FINANCE_HEAD_APPROVAL",
    "transitionLabel": "SUBMIT",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "MANAGER_REJECTED_FIN",
    "toStatus": "SUBMITTED",
    "transitionLabel": "RETURN",
    "requiresComment": true,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "OFFBOARDING_EXIT_PROCEDURES",
    "toStatus": "OFFBOARDING_COMPLETED",
    "transitionLabel": "CLOSE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "OFFBOARDING_FINAL_WEEK",
    "toStatus": "OFFBOARDING_EXIT_PROCEDURES",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "OFFBOARDING_KNOWLEDGE_TRANSFER",
    "toStatus": "OFFBOARDING_FINAL_WEEK",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "OFFBOARDING_NOTICE_PERIOD",
    "toStatus": "OFFBOARDING_KNOWLEDGE_TRANSFER",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "OFFBOARDING_SUBMITTED",
    "toStatus": "OFFBOARDING_NOTICE_PERIOD",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PAYMENT_COMPLETED",
    "toStatus": "REIMBURSEMENT_CLOSED",
    "transitionLabel": "CLOSE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PAYMENT_DONE_IT",
    "toStatus": "PENDING_DELIVERY_IT",
    "transitionLabel": "SUBMIT",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PAYMENT_PROCESSING",
    "toStatus": "PAYMENT_COMPLETED",
    "transitionLabel": "CLOSE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PAYMENT_PROCESSING_IT",
    "toStatus": "PAYMENT_DONE_IT",
    "transitionLabel": "CLOSE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PENDING_CEO_APPROVAL",
    "toStatus": "CEO_APPROVED",
    "transitionLabel": "APPROVE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PENDING_CEO_APPROVAL",
    "toStatus": "CEO_REJECTED",
    "transitionLabel": "REJECT",
    "requiresComment": true,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PENDING_CEO_APPROVAL_IT",
    "toStatus": "CEO_APPROVED_IT",
    "transitionLabel": "APPROVE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PENDING_CEO_APPROVAL_IT",
    "toStatus": "CEO_REJECTED_IT",
    "transitionLabel": "REJECT",
    "requiresComment": true,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PENDING_CFO_APPROVAL_IT",
    "toStatus": "CFO_APPROVED_IT",
    "transitionLabel": "APPROVE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PENDING_CFO_APPROVAL_IT",
    "toStatus": "CFO_REJECTED_IT",
    "transitionLabel": "REJECT",
    "requiresComment": true,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PENDING_CTO_APPROVAL_IT",
    "toStatus": "CTO_APPROVED_IT",
    "transitionLabel": "APPROVE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PENDING_CTO_APPROVAL_IT",
    "toStatus": "CTO_REJECTED_IT",
    "transitionLabel": "REJECT",
    "requiresComment": true,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PENDING_DELIVERY_IT",
    "toStatus": "RESOLVED",
    "transitionLabel": "CLOSE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PENDING_FINANCE_HEAD_APPROVAL",
    "toStatus": "FINANCE_HEAD_APPROVED",
    "transitionLabel": "APPROVE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PENDING_FINANCE_HEAD_APPROVAL",
    "toStatus": "FINANCE_HEAD_REJECTED",
    "transitionLabel": "REJECT",
    "requiresComment": true,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PENDING_INVOICE_IT",
    "toStatus": "PENDING_CFO_APPROVAL_IT",
    "transitionLabel": "SUBMIT",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PENDING_MANAGER_APPROVAL_FIN",
    "toStatus": "MANAGER_APPROVED_FIN",
    "transitionLabel": "APPROVE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PENDING_MANAGER_APPROVAL_FIN",
    "toStatus": "MANAGER_REJECTED_FIN",
    "transitionLabel": "REJECT",
    "requiresComment": true,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PENDING_MANAGER_REVIEW",
    "toStatus": "MANAGER_APPROVED",
    "transitionLabel": "APPROVE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "PROCUREMENT_IN_PROGRESS",
    "toStatus": "HARDWARE_ORDERED",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "SOFTWARE_PROVISIONED",
    "toStatus": "RESOLVED",
    "transitionLabel": "CLOSE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "SUBMITTED",
    "toStatus": "ACKNOWLEDGED_IT",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "SUBMITTED",
    "toStatus": "IN_PROGRESS",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "SUBMITTED",
    "toStatus": "IN_REVIEW",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "SUBMITTED",
    "toStatus": "PENDING_CEO_APPROVAL",
    "transitionLabel": "SUBMIT",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "SUBMITTED",
    "toStatus": "PENDING_MANAGER_APPROVAL_FIN",
    "transitionLabel": "SUBMIT",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "SUBMITTED",
    "toStatus": "REJECTED",
    "transitionLabel": "REJECT",
    "requiresComment": true,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "WAITING",
    "toStatus": "IN_PROGRESS",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "WAITING",
    "toStatus": "IN_REVIEW",
    "transitionLabel": "ADVANCE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  },
  {
    "fromStatus": "WAITING",
    "toStatus": "RESOLVED",
    "transitionLabel": "CLOSE",
    "requiresComment": false,
    "autoAssignRole": null,
    "autoAssignUserId": null,
    "isActive": true
  }
];

// ── Banner Config ─────────────────────────────────────
export const SEED_BANNER_CONFIGS = [
  {
    "role": "agent",
    "status": "CEO_APPROVED",
    "icon": "work",
    "title": "Next Step: Post the Job",
    "description": "CEO has approved. Mark the job as posted to proceed.",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "agent",
    "status": "INTERVIEW_FEEDBACK_PENDING",
    "icon": "play_arrow",
    "title": "Next Step: Start HR Screening",
    "description": "Interview feedback received. Begin background and reference checks.",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "agent",
    "status": "LOA_APPROVED",
    "icon": "send",
    "title": "Next Step: Issue LOA to Candidate",
    "description": "Hiring manager has approved the LOA. Issue it to the candidate.",
    "colorScheme": "emerald",
    "isActive": true
  },
  {
    "role": "agent",
    "status": "MANAGER_APPROVED",
    "icon": "calendar_month",
    "title": "Next Step: Schedule Interview",
    "description": "Hiring manager selected a candidate. Schedule the interview.",
    "colorScheme": "indigo",
    "isActive": true
  },
  {
    "role": "agent",
    "status": "PAYMENT_DONE_IT",
    "icon": "check_circle",
    "title": "Payment Completed",
    "description": "Payment has been made. Pending delivery.",
    "colorScheme": "green",
    "isActive": true
  },
  {
    "role": "agent",
    "status": "PAYMENT_PROCESSING_IT",
    "icon": "payments",
    "title": "Payment Processing",
    "description": "CFO has approved. Payment is being processed.",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "agent",
    "status": "PENDING_CEO_APPROVAL",
    "icon": "hourglass_top",
    "title": "Pending CEO Approval",
    "description": "{{assignedToName}} has routed this request to the CEO for approval.",
    "colorScheme": "purple",
    "isActive": true
  },
  {
    "role": "agent",
    "status": "PENDING_CFO_APPROVAL_IT",
    "icon": "approval",
    "title": "Pending CFO Approval",
    "description": "Invoice submitted. Awaiting CFO sign-off.",
    "colorScheme": "purple",
    "isActive": true
  },
  {
    "role": "agent",
    "status": "PENDING_INVOICE_IT",
    "icon": "receipt_long",
    "title": "Pending Invoice",
    "description": "Waiting for invoice to be submitted before processing.",
    "colorScheme": "amber",
    "isActive": true
  },
  {
    "role": "agent",
    "status": "SUBMITTED",
    "icon": "hourglass_top",
    "title": "Ticket Submitted ",
    "description": "please review and response",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "CEO_APPROVED",
    "icon": "hourglass_top",
    "title": "CEO Approved",
    "description": "CEO Approved",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "HR_SCREENING",
    "icon": "hourglass_top",
    "title": "HR Screening in progress",
    "description": "HR Screening in progress",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "INTERVIEW_SCHEDULED",
    "icon": "hourglass_top",
    "title": "Interview Scheduled",
    "description": "Interview Scheduled",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "JOB_POSTED",
    "icon": "hourglass_top",
    "title": "Job Posted",
    "description": "Job Posted",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "LOA_ISSUED",
    "icon": "hourglass_top",
    "title": "LOA Issued to candidate",
    "description": "LOA Issued to candidate",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "LOA_PENDING_APPROVAL",
    "icon": "hourglass_top",
    "title": "LOA Pending Approval",
    "description": "LOA Pending Approval",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "MANAGER_APPROVED",
    "icon": "hourglass_top",
    "title": "Pending to schedule interview",
    "description": "Pending to schedule interview",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "ONBOARDING_COMPLETED",
    "icon": "hourglass_top",
    "title": "Onboarding Completed",
    "description": "Onboarding Completed",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "ONBOARDING_PENDING_HR_APPROVAL",
    "icon": "hourglass_top",
    "title": "Pending HR acknowledgement",
    "description": "Pending HR acknowledgement",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "ONBOARDING_SUBMITTED",
    "icon": "hourglass_top",
    "title": "Onboarding Submitted",
    "description": "Onboarding Submitted",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "PAYMENT_PROCESSING",
    "icon": "hourglass_top",
    "title": "Payment Processing",
    "description": "Payment Processing",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "PAYMENT_PROCESSING_FIN",
    "icon": "hourglass_top",
    "title": "Payment Processing Finance",
    "description": "Payment Processing Finance",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "PAYMENT_PROCESSING_IT",
    "icon": "hourglass_top",
    "title": "Pending Payment Processing",
    "description": "Pending Payment Processing",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "PENDING_CEO_APPROVAL",
    "icon": "hourglass_top",
    "title": "Pending CEO Approval",
    "description": "Pending CEO Approval",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "PENDING_CEO_APPROVAL_IT",
    "icon": "hourglass_top",
    "title": "Pending CEO Approval",
    "description": "Pending CEO Approval",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "PENDING_CTO_APPROVAL_IT",
    "icon": "hourglass_top",
    "title": "Pending CTO Approval",
    "description": "Pending CTO Approval",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "PENDING_DELIVERY_IT",
    "icon": "hourglass_top",
    "title": "Pending Delivery",
    "description": "Your hardware request has been approved and is awaiting delivery by IT.",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "PENDING_INVOICE_IT",
    "icon": "hourglass_top",
    "title": "Pending Invoice",
    "description": "Pending Invoice",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "PENDING_MANAGER_REVIEW",
    "icon": "hourglass_top",
    "title": "Pending Manager Review ",
    "description": "Pending Manager Review",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "all",
    "status": "RESOLVED",
    "icon": "check_circle",
    "title": "Resolved",
    "description": "Your request has been completed.",
    "colorScheme": "green",
    "isActive": true
  },
  {
    "role": "ceo",
    "status": "PENDING_CEO_APPROVAL",
    "icon": "approval",
    "title": "Your Approval Required",
    "description": "This hiring request needs your approval to proceed. Review the details and make a decision.",
    "colorScheme": "purple",
    "isActive": true
  },
  {
    "role": "ceo",
    "status": "PENDING_MANAGER_APPROVAL_IT",
    "icon": "approval",
    "title": "Your Approval Required",
    "description": "This IT request has been routed to you for sign-off. Review the details and approve or reject.",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "hiring_manager",
    "status": "HR_SCREENING",
    "icon": "fact_check",
    "title": "In Progress: HR Screening",
    "description": "Background and reference checks are being conducted by HR.",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "hiring_manager",
    "status": "INTERVIEW_SCHEDULED",
    "icon": "feedback",
    "title": "Your Action: Submit Interview Feedback",
    "description": "The interview has been completed. Please submit your feedback and decision.",
    "colorScheme": "indigo",
    "isActive": true
  },
  {
    "role": "hiring_manager",
    "status": "LOA_PENDING_APPROVAL",
    "icon": "approval",
    "title": "Your Action: Approve / Reject LOA",
    "description": "Review the Letter of Acceptance and make an approval decision.",
    "colorScheme": "indigo",
    "isActive": true
  },
  {
    "role": "hiring_manager",
    "status": "PENDING_CEO_APPROVAL",
    "icon": "hourglass_top",
    "title": "Waiting: CEO Approval",
    "description": "Your hiring request is pending CEO approval. You will be notified when a decision is made.",
    "colorScheme": "purple",
    "isActive": true
  },
  {
    "role": "hiring_manager",
    "status": "PENDING_MANAGER_REVIEW",
    "icon": "rate_review",
    "title": "Your Action: Review Candidates",
    "description": "Candidate resumes are ready for your review. Select a candidate to proceed.",
    "colorScheme": "orange",
    "isActive": true
  },
  {
    "role": "staff",
    "status": "ACTION_REQUIRED",
    "icon": "warning",
    "title": "Action Required From You",
    "description": "The team needs more information. Please check the comments below.",
    "colorScheme": "orange",
    "isActive": true
  },
  {
    "role": "staff",
    "status": "COMPLETED",
    "icon": "check_circle",
    "title": "Resolved",
    "description": "Your request has been completed.",
    "colorScheme": "green",
    "isActive": true
  },
  {
    "role": "staff",
    "status": "IN_PROGRESS",
    "icon": "engineering",
    "title": "In Progress",
    "description": "{{assignedToName}} is working on your request.",
    "colorScheme": "blue",
    "isActive": true
  },
  {
    "role": "staff",
    "status": "IN_REVIEW",
    "icon": "visibility",
    "title": "Under Review",
    "description": "{{assignedToName}} is reviewing your request.",
    "colorScheme": "indigo",
    "isActive": true
  },
  {
    "role": "staff",
    "status": "RESOLVED",
    "icon": "check_circle",
    "title": "Resolved",
    "description": "Your request has been completed.",
    "colorScheme": "green",
    "isActive": true
  },
  {
    "role": "staff",
    "status": "SUBMITTED",
    "icon": "hourglass_top",
    "title": "Request Submitted",
    "description": "Your request has been received and is waiting to be picked up by our team.",
    "colorScheme": "blue",
    "isActive": true
  }
];

// ── Onboarding Task Templates ─────────────────────────
export const SEED_ONBOARDING_TEMPLATES = [
  {
    "taskName": "Create Active Directory Account",
    "taskDescription": "Set up AD account with appropriate permissions",
    "taskCategory": "IT",
    "priority": "CRITICAL",
    "dueDayOffset": -5,
    "displayOrder": 1,
    "isActive": true
  },
  {
    "taskName": "Setup Email Account",
    "taskDescription": "Create company email account and configure mailbox",
    "taskCategory": "IT",
    "priority": "CRITICAL",
    "dueDayOffset": -5,
    "displayOrder": 2,
    "isActive": true
  },
  {
    "taskName": "Provision Laptop/Desktop",
    "taskDescription": "Prepare and configure hardware with required software",
    "taskCategory": "IT",
    "priority": "HIGH",
    "dueDayOffset": -3,
    "displayOrder": 3,
    "isActive": true
  },
  {
    "taskName": "Create Access Badge",
    "taskDescription": "Prepare physical access badge for building entry",
    "taskCategory": "IT",
    "priority": "HIGH",
    "dueDayOffset": -2,
    "displayOrder": 4,
    "isActive": true
  },
  {
    "taskName": "Setup Desk/Workspace",
    "taskDescription": "Prepare workstation with necessary equipment",
    "taskCategory": "ADMIN",
    "priority": "MEDIUM",
    "dueDayOffset": -1,
    "displayOrder": 5,
    "isActive": true
  },
  {
    "taskName": "Complete EPF/KWSP Registration",
    "taskDescription": "Employee Provident Fund registration and statutory declarations",
    "taskCategory": "HR",
    "priority": "CRITICAL",
    "dueDayOffset": 0,
    "displayOrder": 6,
    "isActive": true
  },
  {
    "taskName": "Acknowledge Company Policies",
    "taskDescription": "Review and sign employee handbook",
    "taskCategory": "HR",
    "priority": "HIGH",
    "dueDayOffset": 0,
    "displayOrder": 8,
    "isActive": true
  },
  {
    "taskName": "Complete Security Training",
    "taskDescription": "Mandatory cybersecurity awareness training",
    "taskCategory": "TRAINING",
    "priority": "HIGH",
    "dueDayOffset": 7,
    "displayOrder": 9,
    "isActive": true
  },
  {
    "taskName": "Complete Compliance Training",
    "taskDescription": "Regulatory compliance and ethics training",
    "taskCategory": "TRAINING",
    "priority": "HIGH",
    "dueDayOffset": 7,
    "displayOrder": 10,
    "isActive": true
  },
  {
    "taskName": "Department Orientation",
    "taskDescription": "Introduction to team and department processes",
    "taskCategory": "TRAINING",
    "priority": "MEDIUM",
    "dueDayOffset": 7,
    "displayOrder": 11,
    "isActive": true
  },
  {
    "taskName": "Enroll in Benefits",
    "taskDescription": "Health insurance, EPF, and other benefits enrollment",
    "taskCategory": "HR",
    "priority": "HIGH",
    "dueDayOffset": 30,
    "displayOrder": 12,
    "isActive": true
  }
];

// ── Offboarding Task Templates ────────────────────────
export const SEED_OFFBOARDING_TEMPLATES = [
  {
    "taskName": "Fill in required form ",
    "taskDescription": "employee exit checklist , exit interview form",
    "taskCategory": "HR",
    "priority": "MEDIUM",
    "dueDayOffset": 0,
    "displayOrder": 0,
    "isActive": true
  },
  {
    "taskName": "Notify IT of Departure",
    "taskDescription": "Alert IT team of employee last working day to schedule account deactivation",
    "taskCategory": "HR",
    "priority": "HIGH",
    "dueDayOffset": -10,
    "displayOrder": 1,
    "isActive": true
  },
  {
    "taskName": "Schedule Exit Interview",
    "taskDescription": "Arrange exit interview with HR to gather feedback",
    "taskCategory": "HR",
    "priority": "HIGH",
    "dueDayOffset": -7,
    "displayOrder": 2,
    "isActive": true
  },
  {
    "taskName": "Revoke System Access",
    "taskDescription": "Disable all system accounts, VPN, and application access on last day",
    "taskCategory": "IT",
    "priority": "CRITICAL",
    "dueDayOffset": 0,
    "displayOrder": 4,
    "isActive": true
  },
  {
    "taskName": "Disable Email Account",
    "taskDescription": "Deactivate email and set up forwarding/out-of-office",
    "taskCategory": "IT",
    "priority": "CRITICAL",
    "dueDayOffset": 0,
    "displayOrder": 5,
    "isActive": true
  },
  {
    "taskName": "Collect Company Hardware",
    "taskDescription": "Collect laptop, phone, access badge, and other company equipment",
    "taskCategory": "IT",
    "priority": "HIGH",
    "dueDayOffset": 0,
    "displayOrder": 6,
    "isActive": true
  },
  {
    "taskName": "Process Final Payroll",
    "taskDescription": "Ensure final paycheck includes all outstanding pay, bonuses, and leave",
    "taskCategory": "HR",
    "priority": "CRITICAL",
    "dueDayOffset": 0,
    "displayOrder": 7,
    "isActive": true
  },
  {
    "taskName": "Conduct Exit Interview",
    "taskDescription": "Conduct and document exit interview with departing employee",
    "taskCategory": "HR",
    "priority": "MEDIUM",
    "dueDayOffset": -1,
    "displayOrder": 9,
    "isActive": true
  },
  {
    "taskName": "Return Physical Access Badge",
    "taskDescription": "Collect and deactivate physical building access badge",
    "taskCategory": "IT",
    "priority": "HIGH",
    "dueDayOffset": 0,
    "displayOrder": 12,
    "isActive": true
  }
];

// ── Escalation Rules ──────────────────────────────────
export const SEED_ESCALATION_RULES = [
  {
    "requestTypeCode": "INTERCOMPANY_CHARGEBACK",
    "triggerHoursAfterBreach": 2,
    "notifyRoles": [
      "ADMIN"
    ],
    "label": "Test escalation",
    "isActive": true
  },
  {
    "requestTypeCode": "GET_IT_HELP",
    "triggerHoursAfterBreach": 0,
    "notifyRoles": [
      "ADMIN"
    ],
    "label": null,
    "isActive": true
  }
];

// ── Entity Configuration (production approver assignments) ─────────────────
// These override the default seed entity values with admin-configured approvers,
// descriptions, and display ordering from the production system.
export const SEED_ENTITY_CONFIG = [
  { code: "CG", name: "Citadel Group Sdn. Bhd.", description: '', approverEmail: "alain.boey@citadelgroup.com.my", displayOrder: 10, isActive: true },
  { code: "CGT", name: "Citadel Group Technologies Sdn. Bhd.", description: '', approverEmail: "emily.chow@citadelgroup.com.my", displayOrder: 30, isActive: true },
  { code: "CWP", name: "Citadel Wealth Partners Sdn. Bhd.", description: '', approverEmail: "zac.ashari@citadelgroup.com.my", displayOrder: 20, isActive: true },
  { code: "CT360", name: "Citadel Tayyib 360 Sdn. Bhd.", description: '', approverEmail: "adly.mohamed@citadelgroup.com.my", displayOrder: 40, isActive: true },
  { code: "NIU", name: "NIU Trading Sdn. Bhd.", description: '', approverEmail: "alain.boey@citadelgroup.com.my", displayOrder: 50, isActive: true },
  { code: "COS", name: "Cosmospan Sdn. Bhd.", description: '', approverEmail: "rajna.anthony@citadelgroup.com.my", displayOrder: 60, isActive: true },
];

// ── Production Users (@citadelgroup.com.my) ────────────────────
// Real staff accounts with entity assignments, roles, and departments.
// Password default: Welcome@2026 (user should change on first login).
export const SEED_PRODUCTION_USERS = [
  { email: "adly.mohamed@citadelgroup.com.my", firstName: "Adly", lastName: "Mohamed", department: "Executive", jobTitle: 'Chief Executive Officer', executiveRole: "CEO", agentTeam: null, entityCode: "CT360", roles: ["NORMAL_STAFF", "CEO"], isActive: true },
  { email: "ahmad.zuhayri@citadelgroup.com.my", firstName: "Ahmad", lastName: "Zuhayri Mohamed", department: null, jobTitle: 'Business Development & Corporate Communication Executive', executiveRole: null, agentTeam: null, entityCode: "CT360", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "alain.boey@citadelgroup.com.my", firstName: "Alain", lastName: "Boey", department: "Executive", jobTitle: 'Deputy Chief Executive Officer', executiveRole: null, agentTeam: null, entityCode: "CG", roles: ["NORMAL_STAFF", "GROUP_CEO"], isActive: true },
  { email: "alan.ling@citadelgroup.com.my", firstName: "Alan", lastName: "Ling", department: "Executive", jobTitle: 'Managing Director- Kuching Office', executiveRole: null, agentTeam: null, entityCode: "CWP", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "cheehao.wong@citadelgroup.com.my", firstName: "Brandon", lastName: "Wong Chee Hao", department: "IT", jobTitle: 'Full Stack Developer', executiveRole: null, agentTeam: "IT", entityCode: "CGT", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "emily.chow@citadelgroup.com.my", firstName: "Emily", lastName: "Chow", department: "Executive", jobTitle: 'Chief Executive Officer', executiveRole: "CEO", agentTeam: null, entityCode: "CGT", roles: ["NORMAL_STAFF", "CEO"], isActive: true },
  { email: "fadhli.amran@citadelgroup.com.my", firstName: "Muhammad", lastName: "Fadhli Bin Amran", department: "Marketing", jobTitle: 'Marketing Coordinator Executive', executiveRole: null, agentTeam: null, entityCode: "CG", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "fangkhai.foo@citadelgroup.com.my", firstName: "Fang", lastName: "Khai Foo", department: "IT", jobTitle: 'Full Stack Developer (AI)', executiveRole: null, agentTeam: "IT", entityCode: "CGT", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "girling.liong@citadelgroup.com.my", firstName: "Girling", lastName: "Liong Mee Yee", department: "Admin", jobTitle: 'Receptionist & Admin Executive - Sibu Office', executiveRole: null, agentTeam: null, entityCode: "CWP", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "irina.kamarzan@citadelgroup.com.my", firstName: "Nor", lastName: "Irina Safiyyah Md Kamarzan", department: "Finance", jobTitle: 'Financial Analyst', executiveRole: null, agentTeam: "FINANCE", entityCode: "CG", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "j.medina@citadelgroup.com.my", firstName: "Dato' Jeff", lastName: "Medina", department: "Executive", jobTitle: 'Chairman & Group Chief Executive Officer', executiveRole: "GROUP_CEO", agentTeam: null, entityCode: "CG", roles: ["NORMAL_STAFF", "GROUP_CEO"], isActive: true },
  { email: "joyce.loh@citadelgroup.com.my", firstName: "Joyce", lastName: "Loh", department: "Admin", jobTitle: 'Head of Admin Operations', executiveRole: null, agentTeam: null, entityCode: "CWP", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "juliana.jalil@citadelgroup.com.my", firstName: "Juliana", lastName: "Abd Jalil", department: "Admin", jobTitle: 'Senior Admin Executive', executiveRole: null, agentTeam: null, entityCode: "CWP", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "kamilah.hanif@citadelgroup.com.my", firstName: "Nurul", lastName: "Kamilah Hanif Kondon", department: "Legal", jobTitle: 'Group Legal & Compliance Head', executiveRole: null, agentTeam: null, entityCode: "CG", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "karyuan.fang@citadelgroup.com.my", firstName: "Kar", lastName: "Yuan Fang", department: "IT", jobTitle: 'Lead Application Support', executiveRole: null, agentTeam: "IT", entityCode: "CGT", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "khaliesah.badruddin@citadelgroup.com.my", firstName: "Kha'liesah", lastName: "Badruddin", department: "Marketing", jobTitle: 'Marketing Executive cum Graphic Designer', executiveRole: null, agentTeam: null, entityCode: "CG", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "michelle.weng@citadelgroup.com.my", firstName: "Lee", lastName: "Foong Weng", department: "Admin", jobTitle: 'Receptionist', executiveRole: null, agentTeam: null, entityCode: "CG", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "mingkai.tham@citadelgroup.com.my", firstName: "Ming", lastName: "Kai Tham", department: "IT", jobTitle: 'Junior System Administrator', executiveRole: null, agentTeam: "IT", entityCode: "CGT", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "natalya.erika@citadelgroup.com.my", firstName: "Natalya", lastName: "Erika Martison", department: "Marketing", jobTitle: 'Investor Relations Officer', executiveRole: null, agentTeam: null, entityCode: "CG", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "natasha.dealwis@citadelgroup.com.my", firstName: "Natasha", lastName: "Kimberly De Alwis", department: "Marketing", jobTitle: 'Chief Marketing Officer', executiveRole: "CMO", agentTeam: null, entityCode: "CG", roles: ["NORMAL_STAFF", "CMO"], isActive: true },
  { email: "naveen.ahmad@citadelgroup.com.my", firstName: "Naveen", lastName: "Ahmad", department: "IT", jobTitle: 'Product Head', executiveRole: null, agentTeam: null, entityCode: "CGT", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "nick.tan@citadelgroup.com.my", firstName: "Nichollas", lastName: "Pi Huat Tan", department: "HR", jobTitle: 'Chief Human Resources Officer', executiveRole: "CHRO", agentTeam: "HR", entityCode: "CG", roles: ["AGENT", "NORMAL_STAFF", "HIRING_MANAGER"], isActive: true },
  { email: "nurnafisah.sharudin@citadelgroup.com.my", firstName: "Nurnafisah", lastName: "Najla Sharudin", department: "IT", jobTitle: 'Application Support Executive', executiveRole: null, agentTeam: "IT", entityCode: "CGT", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "rajna.anthony@citadelgroup.com.my", firstName: "Dr. Rajna", lastName: "Anthony", department: "Executive", jobTitle: 'Director', executiveRole: null, agentTeam: null, entityCode: "COS", roles: ["NORMAL_STAFF", "CEO"], isActive: true },
  { email: "raymond.kueh@citadelgroup.com.my", firstName: "Raymond", lastName: "Kueh Kian Peng", department: "Executive", jobTitle: 'Chief Technology Officer', executiveRole: "CTO", agentTeam: null, entityCode: "CGT", roles: ["NORMAL_STAFF", "CTO"], isActive: true },
  { email: "rohani.munir@citadelgroup.com.my", firstName: "Rohani", lastName: "Abdul Munir", department: "Admin", jobTitle: 'Executive Assistant', executiveRole: null, agentTeam: null, entityCode: "CWP", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "saravanan.ramaiah@citadelgroup.com.my", firstName: "Saravanan", lastName: "Ramaiah", department: "Finance", jobTitle: 'Chief Finance Officer', executiveRole: null, agentTeam: "Finance", entityCode: "CG", roles: ["AGENT", "NORMAL_STAFF", "CFO"], isActive: true },
  { email: "sasha.nair@citadelgroup.com.my", firstName: "Sasha", lastName: "Nair", department: "HR", jobTitle: 'Senior HR Executive', executiveRole: null, agentTeam: "HR", entityCode: "CG", roles: ["AGENT", "NORMAL_STAFF", "HIRING_MANAGER"], isActive: true },
  { email: "shah.musa@citadelgroup.com.my", firstName: "Shah", lastName: "Rezza Musa", department: "Finance", jobTitle: 'Group Senior Finance Executive', executiveRole: null, agentTeam: "FINANCE", entityCode: "CG", roles: ["AGENT", "NORMAL_STAFF"], isActive: true },
  { email: "shamsuria.shamsuri@citadelgroup.com.my", firstName: "Shamsuria", lastName: "Shamsuri", department: "Admin", jobTitle: 'Admin Executive', executiveRole: null, agentTeam: null, entityCode: "NIU", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "soraya.rozali@citadelgroup.com.my", firstName: "Soraya", lastName: "Rose Rozali", department: "Admin", jobTitle: 'Admin Executive', executiveRole: null, agentTeam: null, entityCode: "CWP", roles: ["NORMAL_STAFF"], isActive: true },
  { email: "zac.ashari@citadelgroup.com.my", firstName: "Zac", lastName: "Mohd Ashari", department: "Executive", jobTitle: 'Chief Executive Officer & Head of Sales', executiveRole: "CEO", agentTeam: null, entityCode: "CWP", roles: ["NORMAL_STAFF", "CEO"], isActive: true },
  { email: "zahidah.rashid@citadelgroup.com.my", firstName: "Zahidah", lastName: "Zainal Rashid", department: "Finance", jobTitle: 'Finance Manager', executiveRole: null, agentTeam: "FINANCE", entityCode: "CG", roles: ["AGENT", "NORMAL_STAFF"], isActive: true },
];
