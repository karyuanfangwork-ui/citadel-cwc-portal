# CWC 2.0 — Email Notification Template Seed Data

**Related:** EMAIL_NOTIFICATION_ANALYSIS.md
**Purpose:** All 27 NotificationTemplate seed rows with structured HTML body content
**Note:** Body fragments are inner content only — the `emailLayout()` wrapper in `email-layout.ts` provides the outer branded shell (header, footer, styling)

---

## Template Variables Reference

Each eventType uses specific `{{variables}}` that are passed by the controller calling `notify()`.

| Variable | Description | Used In |
|---|---|---|
| `{{requestId}}` | Request ticket ID | Most templates |
| `{{requestTitle}}` | Request title/subject | Most templates |
| `{{userName}}` | Recipient's name | Most templates |
| `{{requesterName}}` | Person who created the request | REQUEST_CREATED |
| `{{assigneeName}}` | Agent assigned to the request | REQUEST_ASSIGNED |
| `{{commenterName}}` | Person who added the comment | COMMENT_ADDED |
| `{{commentText}}` | Comment content preview | COMMENT_ADDED |
| `{{oldStatus}}` | Previous status | STATUS_CHANGED |
| `{{newStatus}}` | New status | STATUS_CHANGED |
| `{{changedBy}}` | Who changed the status | STATUS_CHANGED |
| `{{resetUrl}}` | Password reset link URL | PASSWORD_RESET |
| `{{approverRole}}` | Approver role (Manager/VP/CFO) | Approval templates |
| `{{approvalLevel}}` | Current approval level | APPROVAL_REQUIRED |
| `{{rejectionReason}}` | Reason for rejection | Rejection templates |
| `{{slaDeadline}}` | SLA deadline timestamp | SLA_BREACHED |
| `{{categoryName}}` | Service category name | REQUEST_CREATED |
| `{{priority}}` | Request priority | Various |
| `{{amount}}` | Monetary amount (if applicable) | Finance templates |
| `{{currency}}` | Currency code (MYR/etc.) | Finance templates |
| `{{vendorName}}` | Vendor/supplier name | Finance templates |
| `{{paymentRef}}` | Payment reference number | FINANCE_PAYMENT_COMPLETE |

---

## General Templates (6)

### 1. REQUEST_CREATED

```json
{
  "name": "New Request Created",
  "eventType": "REQUEST_CREATED",
  "emailSubject": "New Request #{{requestId}} — {{requestTitle}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>New Request Submitted</h2><p>Hello {{userName}},</p><p>A new request has been submitted by <strong>{{requesterName}}</strong>:</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Title</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requestTitle}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Category</td><td style='padding:8px 12px;border:1px solid #eee;'>{{categoryName}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Priority</td><td style='padding:8px 12px;border:1px solid #eee;'>{{priority}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>"
}
```

### 2. COMMENT_ADDED

```json
{
  "name": "Comment Added",
  "eventType": "COMMENT_ADDED",
  "emailSubject": "New Comment on Request #{{requestId}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>New Comment</h2><p>Hello {{userName}},</p><p><strong>{{commenterName}}</strong> added a comment on request <strong>#{{requestId}} — {{requestTitle}}</strong>:</p><div style='background:#f4f5f7;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #1a1a2e;'>{{commentText}}</div><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>"
}
```

### 3. REQUEST_ASSIGNED

```json
{
  "name": "Request Assigned",
  "eventType": "REQUEST_ASSIGNED",
  "emailSubject": "Request #{{requestId}} Assigned to You",
  "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Request Assigned</h2><p>Hello {{userName}},</p><p>Request <strong>#{{requestId}} — {{requestTitle}}</strong> has been assigned to <strong>{{assigneeName}}</strong>.</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Title</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requestTitle}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Assignee</td><td style='padding:8px 12px;border:1px solid #eee;'>{{assigneeName}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>"
}
```

### 4. STATUS_CHANGED

```json
{
  "name": "Status Changed",
  "eventType": "STATUS_CHANGED",
  "emailSubject": "Request #{{requestId}} — Status Updated to {{newStatus}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Status Update</h2><p>Hello {{userName}},</p><p>The status of request <strong>#{{requestId}} — {{requestTitle}}</strong> has been updated:</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Previous</td><td style='padding:8px 12px;border:1px solid #eee;'>{{oldStatus}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Current</td><td style='padding:8px 12px;border:1px solid #eee;'><span style='display:inline-block;padding:4px 12px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>{{newStatus}}</span></td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Changed By</td><td style='padding:8px 12px;border:1px solid #eee;'>{{changedBy}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>"
}
```

### 5. PASSWORD_RESET

```json
{
  "name": "Password Reset",
  "eventType": "PASSWORD_RESET",
  "emailSubject": "Password Reset Request — Citadel Help Center",
  "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Password Reset</h2><p>Hello {{userName}},</p><p>You requested a password reset for your Citadel Help Center account.</p><p>Click the button below to reset your password. This link expires in <strong>15 minutes</strong>.</p><p style='margin:24px 0;'><a href='{{resetUrl}}' style='display:inline-block;padding:12px 24px;background:#e53e3e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Reset Password</a></p><p style='font-size:13px;color:#666;'>If the button doesn't work, copy and paste this URL into your browser:<br/><a href='{{resetUrl}}' style='color:#1a1a2e;word-break:break-all;'>{{resetUrl}}</a></p><p style='margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:13px;color:#999;'>If you did not request this, you can safely ignore this email. Your password will remain unchanged.</p>"
}
```

### 6. SLA_BREACHED

```json
{
  "name": "SLA Breach Alert",
  "eventType": "SLA_BREACHED",
  "emailSubject": "⚠️ SLA Breach — Request #{{requestId}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#e53e3e;'>SLA Breach Alert</h2><p>Hello {{userName}},</p><p>An SLA deadline has been breached on the following request:</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Title</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requestTitle}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>SLA Deadline</td><td style='padding:8px 12px;border:1px solid #eee;color:#e53e3e;font-weight:600;'>{{slaDeadline}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#e53e3e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Take Action</a></p>"
}
```

---

## IT Support Templates (14)

### 7. MANAGER_APPROVAL_REQUIRED

```json
{
  "name": "Manager Approval Required",
  "eventType": "MANAGER_APPROVAL_REQUIRED",
  "emailSubject": "Approval Needed — Request #{{requestId}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Approval Required</h2><p>Hello {{userName}},</p><p>Your approval is requested for the following IT support request:</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Title</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requestTitle}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Requester</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requesterName}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#f6ad55;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Review & Approve</a></p>"
}
```

### 8. VP_APPROVAL_REQUIRED

```json
{
  "name": "VP Approval Required",
  "eventType": "VP_APPROVAL_REQUIRED",
  "emailSubject": "VP Approval Needed — Request #{{requestId}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>VP Approval Required</h2><p>Hello {{userName}},</p><p>VICE PRESIDENT approval is required for this high-value IT request:</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Title</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requestTitle}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Requester</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requesterName}}</td></tr></table><p>This request requires VP-level authorization due to the estimated value.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#f6ad55;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Review & Approve</a></p>"
}
```

### 9. MANAGER_APPROVED

```json
{
  "name": "Manager Approved",
  "eventType": "MANAGER_APPROVED",
  "emailSubject": "Request #{{requestId}} — Manager Approved",
  "emailBody": "<h2 style='margin:0 0 16px;color:#2e7d32;'>Manager Approved</h2><p>Hello {{userName}},</p><p>The manager has <strong>approved</strong> request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>APPROVED</span></p><p>The request will proceed to the next stage in the workflow.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>"
}
```

### 10. MANAGER_REJECTED

```json
{
  "name": "Manager Rejected",
  "eventType": "MANAGER_REJECTED",
  "emailSubject": "Request #{{requestId}} — Manager Rejected",
  "emailBody": "<h2 style='margin:0 0 16px;color:#e53e3e;'>Manager Rejected</h2><p>Hello {{userName}},</p><p>The manager has <strong>rejected</strong> request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#fde8e8;color:#e53e3e;border-radius:4px;font-weight:600;'>REJECTED</span></p><p>Reason: {{rejectionReason}}</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>"
}
```

### 11. VP_APPROVED

```json
{
  "name": "VP Approved",
  "eventType": "VP_APPROVED",
  "emailSubject": "Request #{{requestId}} — VP Approved",
  "emailBody": "<h2 style='margin:0 0 16px;color:#2e7d32;'>VP Approved</h2><p>Hello {{userName}},</p><p>The Vice President has <strong>approved</strong> request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>VP APPROVED</span></p><p>The request will now proceed to procurement or fulfillment.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>"
}
```

### 12. VP_REJECTED

```json
{
  "name": "VP Rejected",
  "eventType": "VP_REJECTED",
  "emailSubject": "Request #{{requestId}} — VP Rejected",
  "emailBody": "<h2 style='margin:0 0 16px;color:#e53e3e;'>VP Rejected</h2><p>Hello {{userName}},</p><p>The Vice President has <strong>rejected</strong> request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#fde8e8;color:#e53e3e;border-radius:4px;font-weight:600;'>VP REJECTED</span></p><p>Reason: {{rejectionReason}}</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>"
}
```

### 13. PROCUREMENT_INITIATED

```json
{
  "name": "Procurement Initiated",
  "eventType": "PROCUREMENT_INITIATED",
  "emailSubject": "Procurement Started — Request #{{requestId}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Procurement Initiated</h2><p>Hello {{userName}},</p><p>Procurement has been initiated for request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#fff3e0;color:#e65100;border-radius:4px;font-weight:600;'>PROCUREMENT IN PROGRESS</span></p><p>The IT team is now sourcing the required hardware/software.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>"
}
```

### 14. HARDWARE_ORDERED

```json
{
  "name": "Hardware Ordered",
  "eventType": "HARDWARE_ORDERED",
  "emailSubject": "Hardware Ordered — Request #{{requestId}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Hardware Ordered</h2><p>Hello {{userName}},</p><p>The hardware for request <strong>#{{requestId}} — {{requestTitle}}</strong> has been ordered.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e3f2fd;color:#1565c0;border-radius:4px;font-weight:600;'>ORDERED</span></p><p>You will be notified when the item is received.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>"
}
```

### 15. HARDWARE_RECEIVED

```json
{
  "name": "Hardware Received",
  "eventType": "HARDWARE_RECEIVED",
  "emailSubject": "Hardware Received — Request #{{requestId}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Hardware Received</h2><p>Hello {{userName}},</p><p>The hardware for request <strong>#{{requestId}} — {{requestTitle}}</strong> has been received and is being prepared for provisioning.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>RECEIVED</span></p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>"
}
```

### 16. HARDWARE_DELIVERED

```json
{
  "name": "Hardware/Software Delivered",
  "eventType": "HARDWARE_DELIVERED",
  "emailSubject": "Delivered — Request #{{requestId}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#2e7d32;'>Delivered</h2><p>Hello {{userName}},</p><p>Your request <strong>#{{requestId}} — {{requestTitle}}</strong> has been fulfilled and delivered.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>DELIVERED</span></p><p>If you have any issues, please create a new support ticket.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>"
}
```

### 17. REQUEST_RESOLVED

```json
{
  "name": "Request Resolved",
  "eventType": "REQUEST_RESOLVED",
  "emailSubject": "Resolved — Request #{{requestId}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#2e7d32;'>Request Resolved</h2><p>Hello {{userName}},</p><p>Request <strong>#{{requestId}} — {{requestTitle}}</strong> has been resolved.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>RESOLVED</span></p><p>If the issue persists, you can reopen this request within 7 days.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>"
}
```

### 18. ACTION_REQUIRED

```json
{
  "name": "Action Required",
  "eventType": "ACTION_REQUIRED",
  "emailSubject": "Action Required — Request #{{requestId}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#f6ad55;'>Action Required</h2><p>Hello {{userName}},</p><p>Action is needed on request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#fff3e0;color:#e65100;border-radius:4px;font-weight:600;'>ACTION NEEDED</span></p><p>Please review and take the necessary steps.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#f6ad55;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Take Action</a></p>"
}
```

### 19. APPROVAL_REQUIRED

```json
{
  "name": "Executive Approval Required",
  "eventType": "APPROVAL_REQUIRED",
  "emailSubject": "{{approverRole}} Approval Needed — Request #{{requestId}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Executive Approval Required</h2><p>Hello {{userName}},</p><p><strong>{{approverRole}}</strong> approval is required for request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Approval Level</td><td style='padding:8px 12px;border:1px solid #eee;'>{{approvalLevel}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#f6ad55;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Review & Approve</a></p>"
}
```

### 20. REQUEST_REJECTED

```json
{
  "name": "Executive Rejected",
  "eventType": "REQUEST_REJECTED",
  "emailSubject": "Request #{{requestId}} — Rejected by {{approverRole}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#e53e3e;'>Request Rejected</h2><p>Hello {{userName}},</p><p>Request <strong>#{{requestId}} — {{requestTitle}}</strong> has been rejected by <strong>{{approverRole}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#fde8e8;color:#e53e3e;border-radius:4px;font-weight:600;'>REJECTED</span></p><p>Reason: {{rejectionReason}}</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>"
}
```

---

## Finance Templates (6)

### 21. FINANCE_ACKNOWLEDGED

```json
{
  "name": "Finance Acknowledged",
  "eventType": "FINANCE_ACKNOWLEDGED",
  "emailSubject": "Finance Acknowledged — Request #{{requestId}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Finance Acknowledged</h2><p>Hello {{userName}},</p><p>Your finance request <strong>#{{requestId}} — {{requestTitle}}</strong> has been acknowledged by the Finance team.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e3f2fd;color:#1565c0;border-radius:4px;font-weight:600;'>ACKNOWLEDGED</span></p><p>The request is being reviewed and will be routed to the appropriate approver.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>"
}
```

### 22. FINANCE_ROUTED_CFO

```json
{
  "name": "Finance Routed to CFO",
  "eventType": "FINANCE_ROUTED_CFO",
  "emailSubject": "CFO Review — Request #{{requestId}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Routed to CFO</h2><p>Hello {{userName}},</p><p>Finance request <strong>#{{requestId}} — {{requestTitle}}</strong> has been routed to the Chief Financial Officer for approval.</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Amount</td><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;'>{{currency}} {{amount}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>"
}
```

### 23. FINANCE_CFO_DECISION

```json
{
  "name": "CFO Decision",
  "eventType": "FINANCE_CFO_DECISION",
  "emailSubject": "CFO Decision — Request #{{requestId}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>CFO Decision</h2><p>Hello {{userName}},</p><p>The CFO has made a decision on finance request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Amount</td><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;'>{{currency}} {{amount}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Decision</a></p>"
}
```

### 24. FINANCE_GROUP_CEO_DECISION

```json
{
  "name": "Group CEO Decision",
  "eventType": "FINANCE_GROUP_CEO_DECISION",
  "emailSubject": "Group CEO Decision — Request #{{requestId}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Group CEO Decision</h2><p>Hello {{userName}},</p><p>The Group CEO has made a decision on finance request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p>This request was escalated to Group CEO level due to the amount exceeding the CFO approval threshold.</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Amount</td><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;'>{{currency}} {{amount}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Decision</a></p>"
}
```

### 25. FINANCE_PAYMENT_COMPLETE

```json
{
  "name": "Finance Payment Complete",
  "eventType": "FINANCE_PAYMENT_COMPLETE",
  "emailSubject": "Payment Complete — Request #{{requestId}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#2e7d32;'>Payment Complete</h2><p>Hello {{userName}},</p><p>Payment has been completed for finance request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Amount</td><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;'>{{currency}} {{amount}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Payment Ref</td><td style='padding:8px 12px;border:1px solid #eee;'>{{paymentRef}}</td></tr></table><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>PAID</span></p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>"
}
```

### 26. FINANCE_TICKET_CLOSED

```json
{
  "name": "Finance Ticket Closed",
  "eventType": "FINANCE_TICKET_CLOSED",
  "emailSubject": "Closed — Request #{{requestId}}",
  "emailBody": "<h2 style='margin:0 0 16px;color:#2e7d32;'>Request Closed</h2><p>Hello {{userName}},</p><p>Finance request <strong>#{{requestId}} — {{requestTitle}}</strong> has been formally closed.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>CLOSED</span></p><p>All approvals and payments for this request have been completed.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>"
}
```

---

## HR Templates (1 — uses shared STATUS_CHANGED)

### 27. (STATUS_CHANGED is shared with General template #4)

HR onboarding and offboarding controllers use the same `STATUS_CHANGED` eventType as the general request controller. The same template applies.

**Future consideration:** If HR needs separate templates (e.g., `HR_STATUS_CHANGED`, `ONBOARDING_STATUS_CHANGED`), the controllers would need to use a distinct eventType. This is a refinement for later.

---

*Generated by Hermes Agent on 2026-04-25. Template content for CWC 2.0 NotificationTemplate seed data.*