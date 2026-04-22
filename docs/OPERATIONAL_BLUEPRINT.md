# JIRA Service Management Operational Blueprint: CWC 2.0
**Version:** 1.0  
**Role:** Senior ITSM Consultant & Business Analyst  
**Status:** Operational Baseline  
**Date:** April 21, 2026

---

## 1. Executive Summary: System Architecture
The CWC 2.0 Enterprise Help Center is a multi-tenant service desk designed to unify IT, HR, and Finance operations. The system leverages a **DB-Driven Workflow Engine**, allowing administrative control over state transitions without code deployments.

### Core Modules Implemented
| Module | Description | Status |
| :--- | :--- | :--- |
| **Omnichannel Request Engine** | Dynamic form builder based on `RequestType` configurations. | ✅ Full |
| **DB-Driven Workflow Engine** | Transition validation via `WorkflowTransition` table. | ✅ Full |
| **Multi-Departmental Routing** | Dedicated desks for IT, HR, and Finance. | ✅ Full |
| **SLA Management** | Automated due-date calculation and breach notifications. | ✅ Basic |
| **Admin Configuration Suite** | GUI for managing Status Definitions and Workflow Transitions. | ✅ Full |
| **Communication Layer** | In-app notifications, activity logs, and email hooks. | ✅ Full |

---

## 2. Service Catalog & Request Taxonomy

### 2.1 IT Support (Technical Infrastructure)
| Request Type | Category | Approval Required | SLA (Hours) | Primary Goal |
| :--- | :--- | :--- | :--- | :--- |
| **Get IT Help** | Get IT help | No | 24 | General troubleshooting |
| **Email Mgmt** | Email Management | No | 24 | Account/Access config |
| **System Problem** | Report System Problem| No | 48 | Bug reporting/System outage |
| **SW Install** | Software Installation | No | 48 | Provisioning approved software |
| **New Hardware** | Request New Hardware | **Yes** | 72 | Procurement of physical assets |

### 2.2 HR Services (People & Culture)
| Request Type | Category | Approval Required | SLA (Hours) | Primary Goal |
| :--- | :--- | :--- | :--- | :--- |
| **HR Question** | Question for HR | No | 24 | General policy inquiries |
| **New Hiring** | New Hiring Request | **Yes** | 48 | Requisition for new headcount |
| **Onboarding** | New Emp. Onboarding | No | 48 | New hire setup sequence |
| **Offboarding** | Offboard Employee | No | 48 | Asset recovery & account closure |

### 2.3 Group Finance (Fiscal Management)
| Request Type | Category | Approval Required | SLA (Hours) | Primary Goal |
| :--- | :--- | :--- | :--- | :--- |
| **Purchase Req** | Purchase Requisition | **Yes** | 72 | Procurement of goods/services |
| **Chargeback** | Inter-Company Chargeback| **Yes** | 72 | Internal fund transfers |
| **Budget Prop** | Submit Budget Proposal | **Yes** | 72 | Fiscal planning/approval |

---

## 3. Workflow & Approval Architecture

### 3.1 Approval Flow Hierarchy
Requests marked as `requiresApproval = true` follow terms of the **Approval Matrix**:
1. **Level 1 (Manager):** Initial validation of business need.
2. **Level 2 (Department Head/VP):** Budgetary or policy validation.
3. **Level 3 (C-Level/CEO):** Final sign-off for high-value or high-impact requests.

### 3.2 Detailed User Workflow (Sample: New Hardware Request)
`SUBMITTED` $\rightarrow$ `PENDING_MANAGER_APPROVAL_IT` $\rightarrow$ `PENDING_VP_APPROVAL_IT` $\rightarrow$ `PENDING_CFO_APPROVAL_IT` $\rightarrow$ `PROCUREMENT_IN_PROGRESS` $\rightarrow$ `HARDWARE_ORDERED` $\rightarrow$ `HARDWARE_RECEIVED` $\rightarrow$ `SOFTWARE_PROVISIONED` $\rightarrow$ `RESOLVED`

---

## 4. Backend Fulfillment & Automation

### 4.1 Fulfillment Process
- **Triage:** Agent reviews `SUBMITTED` ticket $\rightarrow$ Moves to `IN_REVIEW` $\rightarrow$ `IN_PROGRESS`.
- **SLA Tracking:** System computes `slaDueAt` based on `RequestType.slaHours`.
- **Closure:** Transition to `RESOLVED` $\rightarrow$ `CLOSED`.

### 4.2 Automation Rules (Active)
| Trigger | Action | Logic |
| :--- | :--- | :--- |
| **SLA Breach** | Notify Agent | If `now() > slaDueAt` $\rightarrow$ Event `SLA_BREACHED`. |
| **Role Assignment** | Auto-Route | If `WorkflowTransition.autoAssignRole` exists $\rightarrow$ Set `assignedToId`. |
| **Transition Fail** | Block State Change | If transition not in `WorkflowTransition` table $\rightarrow$ 400 Error. |

### 4.3 Notification Matrix
| Event | Recipient | Channel | Priority |
| :--- | :--- | :--- | :--- |
| `REQUEST_CREATED` | Agent / Admin | In-App / Email | Medium |
| `APPROVAL_REQUIRED` | Designated Approver | In-App / Push | High |
| `SLA_BREACHED` | Assigned Agent | In-App | Critical |
| `REQUEST_REJECTED` | Requester | In-App / Email | Medium |

---

## 5. Escalation Matrix
| Level | Trigger | Escalation Path | Response Target |
| :--- | :--- | :--- | :--- |
| **L1: Agent** | Ticket Creation | Assigned Agent | < 4 Hours |
| **L2: Lead** | SLA Warning (50% time) | Department Lead | < 8 Hours |
| **L3: Manager** | SLA Breach (100% time) | Dept. Manager | < 24 Hours |
| **L4: Executive**| Critical System Failure | CTO/CFO | Immediate |

---

## 6. Gap Analysis & Future Roadmap

### 6.1 Current Gaps
- **Dynamic Form Logic:** Forms are currently static JSON; lack conditional "If X then show Y" logic.
- **Multi-Stage Approval:** Approval is handled as discrete status changes rather than a dedicated `ApprovalQueue` object.
- **Reporting:** Basic reporting exists; lacks weighted KPI dashboards (e.g., Mean Time to Resolve - MTTR).

### 6.2 Future Enhancement Roadmap
- [ ] **Phase 1: Advanced Automation** $\rightarrow$ AI-powered category auto-suggestion based on `summary`.
- [ ] **Phase 2: Integration** $\rightarrow$ Integration with Active Directory and Finance ERP for automatic expense validation.
- [ ] **Phase 3: Customer Portal** $\rightarrow$ Externalized request tracking for non-employees (Vendors/Candidates).
- [ ] **Phase 4: Analytics** $\rightarrow$ Heatmaps of request volume by department and category.
