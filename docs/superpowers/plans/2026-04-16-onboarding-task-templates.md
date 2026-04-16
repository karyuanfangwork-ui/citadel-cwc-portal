# Onboarding Task Templates — Admin Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to manage the default onboarding task checklist (add/edit/delete tasks) via Admin Settings UI instead of changing code.

**Architecture:** Add a new `OnboardingTaskTemplate` Prisma model + migration. Expose CRUD via 4 new routes mounted at `/admin/onboarding-templates`, gated to `ADMIN` role. `createDefaultOnboardingTasks` reads templates from DB instead of the hardcoded array. Frontend adds a third tab "Onboarding Tasks" to `AdminSettings.tsx` that renders the template list and an inline add/edit form.

**Tech Stack:** Prisma (PostgreSQL), Express/TypeScript backend, React 19 + TypeScript frontend, axios via `apiClient`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `backend/prisma/schema.prisma` | Modify | Add `OnboardingTaskTemplate` model |
| `backend/prisma/migrations/` | Create (auto) | Migration for new table |
| `backend/prisma/seed.ts` | Modify | Seed 12 default templates |
| `backend/src/controllers/onboardingTemplate.controller.ts` | Create | CRUD handlers for templates |
| `backend/src/routes/onboardingTemplate.routes.ts` | Create | 4 routes, ADMIN-gated |
| `backend/src/routes/index.ts` | Modify | Mount new router at `/admin/onboarding-templates` |
| `backend/src/services/onboarding.service.ts` | Modify | `createDefaultOnboardingTasks` reads from DB |
| `frontend/types.ts` | Modify | Add `OnboardingTaskTemplate` interface |
| `frontend/pages/AdminSettings.tsx` | Modify | Add 3rd tab + template management UI |

---

## Task 1: Add `OnboardingTaskTemplate` schema model

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add the model** — append after the `OnboardingTask` model (around line 930):

```prisma
model OnboardingTaskTemplate {
  id              String   @id @default(uuid()) @db.Uuid
  taskName        String   @map("task_name") @db.VarChar(200)
  taskDescription String?  @map("task_description") @db.Text
  taskCategory    String   @map("task_category") @db.VarChar(50)
  priority        String   @default("MEDIUM") @db.VarChar(20)
  dueDayOffset    Int      @default(0) @map("due_day_offset")
  displayOrder    Int      @default(0) @map("display_order")
  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  @@map("onboarding_task_templates")
  @@index([taskCategory])
  @@index([isActive])
}
```

> `dueDayOffset`: negative = days before start date, 0 = on start date, positive = days after. E.g. `-5` = 5 days before start.

- [ ] **Step 2: Run migration**

```bash
cd backend
npx prisma migrate dev --name add_onboarding_task_templates
```

Expected: new migration file created, `onboarding_task_templates` table created in DB.

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: no errors, client updated.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add OnboardingTaskTemplate schema model"
```

---

## Task 2: Seed the 12 default templates

**Files:**
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Add seeding block** — append before the final `console.log('🎉 Database seeding completed!')` line:

```typescript
// Seed onboarding task templates
const existingTemplates = await prisma.onboardingTaskTemplate.count();
if (existingTemplates === 0) {
    await prisma.onboardingTaskTemplate.createMany({
        data: [
            { taskName: 'Create Active Directory Account', taskDescription: 'Set up AD account with appropriate permissions', taskCategory: 'IT', priority: 'CRITICAL', dueDayOffset: -5, displayOrder: 1 },
            { taskName: 'Setup Email Account', taskDescription: 'Create company email account and configure mailbox', taskCategory: 'IT', priority: 'CRITICAL', dueDayOffset: -5, displayOrder: 2 },
            { taskName: 'Provision Laptop/Desktop', taskDescription: 'Prepare and configure hardware with required software', taskCategory: 'IT', priority: 'HIGH', dueDayOffset: -3, displayOrder: 3 },
            { taskName: 'Create Access Badge', taskDescription: 'Prepare physical access badge for building entry', taskCategory: 'IT', priority: 'HIGH', dueDayOffset: -2, displayOrder: 4 },
            { taskName: 'Setup Desk/Workspace', taskDescription: 'Prepare workstation with necessary equipment', taskCategory: 'ADMIN', priority: 'MEDIUM', dueDayOffset: -1, displayOrder: 5 },
            { taskName: 'Complete I-9 Form', taskDescription: 'Employment eligibility verification', taskCategory: 'HR', priority: 'CRITICAL', dueDayOffset: 0, displayOrder: 6 },
            { taskName: 'Complete W-4 Tax Form', taskDescription: 'Federal tax withholding form', taskCategory: 'HR', priority: 'CRITICAL', dueDayOffset: 0, displayOrder: 7 },
            { taskName: 'Acknowledge Company Policies', taskDescription: 'Review and sign employee handbook', taskCategory: 'HR', priority: 'HIGH', dueDayOffset: 0, displayOrder: 8 },
            { taskName: 'Complete Security Training', taskDescription: 'Mandatory cybersecurity awareness training', taskCategory: 'TRAINING', priority: 'HIGH', dueDayOffset: 7, displayOrder: 9 },
            { taskName: 'Complete Compliance Training', taskDescription: 'Regulatory compliance and ethics training', taskCategory: 'TRAINING', priority: 'HIGH', dueDayOffset: 7, displayOrder: 10 },
            { taskName: 'Department Orientation', taskDescription: 'Introduction to team and department processes', taskCategory: 'TRAINING', priority: 'MEDIUM', dueDayOffset: 7, displayOrder: 11 },
            { taskName: 'Enroll in Benefits', taskDescription: 'Health insurance, 401k, and other benefits enrollment', taskCategory: 'HR', priority: 'HIGH', dueDayOffset: 30, displayOrder: 12 },
        ],
    });
    console.log('✅ Onboarding task templates seeded');
} else {
    console.log('⏭️  Onboarding task templates already exist, skipping');
}
```

- [ ] **Step 2: Run seed**

```bash
cd backend
npm run prisma:seed
```

Expected output includes: `✅ Onboarding task templates seeded`

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: seed 12 default onboarding task templates"
```

---

## Task 3: Create the template CRUD controller

**Files:**
- Create: `backend/src/controllers/onboardingTemplate.controller.ts`

- [ ] **Step 1: Create the file**

```typescript
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const listTemplates = async (req: Request, res: Response) => {
    try {
        const templates = await prisma.onboardingTaskTemplate.findMany({
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        });
        res.json({ data: templates });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
};

export const createTemplate = async (req: Request, res: Response) => {
    try {
        const { taskName, taskDescription, taskCategory, priority, dueDayOffset, displayOrder } = req.body;
        if (!taskName || !taskCategory || !priority) {
            return res.status(400).json({ error: 'taskName, taskCategory, and priority are required' });
        }
        const template = await prisma.onboardingTaskTemplate.create({
            data: {
                taskName,
                taskDescription: taskDescription || null,
                taskCategory,
                priority,
                dueDayOffset: dueDayOffset ?? 0,
                displayOrder: displayOrder ?? 0,
            },
        });
        res.status(201).json(template);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create template' });
    }
};

export const updateTemplate = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { taskName, taskDescription, taskCategory, priority, dueDayOffset, displayOrder, isActive } = req.body;
        const template = await prisma.onboardingTaskTemplate.update({
            where: { id },
            data: { taskName, taskDescription, taskCategory, priority, dueDayOffset, displayOrder, isActive },
        });
        res.json(template);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update template' });
    }
};

export const deleteTemplate = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.onboardingTaskTemplate.delete({ where: { id } });
        res.json({ message: 'Template deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete template' });
    }
};
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/onboardingTemplate.controller.ts
git commit -m "feat: add onboarding task template CRUD controller"
```

---

## Task 4: Create the template routes and mount them

**Files:**
- Create: `backend/src/routes/onboardingTemplate.routes.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Create routes file**

```typescript
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { listTemplates, createTemplate, updateTemplate, deleteTemplate } from '../controllers/onboardingTemplate.controller';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', listTemplates);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
```

- [ ] **Step 2: Mount in `backend/src/routes/index.ts`** — add import and `router.use` after the existing onboarding routes:

Add import at top with other imports:
```typescript
import onboardingTemplateRoutes from './onboardingTemplate.routes';
```

Add mount after `router.use('/onboarding', onboardingRoutes);`:
```typescript
router.use('/admin/onboarding-templates', onboardingTemplateRoutes);
```

- [ ] **Step 3: Verify backend starts without error**

```bash
cd backend
npm run dev
```

Expected: server starts, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/onboardingTemplate.routes.ts backend/src/routes/index.ts
git commit -m "feat: add onboarding template routes gated to ADMIN role"
```

---

## Task 5: Update `createDefaultOnboardingTasks` to read from DB

**Files:**
- Modify: `backend/src/services/onboarding.service.ts`

- [ ] **Step 1: Replace the hardcoded `createDefaultOnboardingTasks` function** — find the function starting at line ~111 and replace the entire body:

```typescript
export const createDefaultOnboardingTasks = async (onboardingId: string, startDate: Date) => {
    const templates = await prisma.onboardingTaskTemplate.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    if (templates.length === 0) {
        console.warn('⚠️  No active onboarding task templates found — no tasks created');
        return;
    }

    await prisma.onboardingTask.createMany({
        data: templates.map(template => ({
            onboardingId,
            taskName: template.taskName,
            taskDescription: template.taskDescription ?? undefined,
            taskCategory: template.taskCategory,
            priority: template.priority,
            dueDate: new Date(startDate.getTime() + template.dueDayOffset * 24 * 60 * 60 * 1000),
        })),
    });

    console.log(`✅ Created ${templates.length} onboarding tasks from templates`);
};
```

- [ ] **Step 2: Restart backend and verify a new onboarding still creates tasks**

```bash
cd backend
npm run dev
```

Test by checking DB: if you have an existing onboarding record, the change only affects new ones going forward. No existing records are touched.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/onboarding.service.ts
git commit -m "feat: createDefaultOnboardingTasks reads from DB templates instead of hardcoded array"
```

---

## Task 6: Add `OnboardingTaskTemplate` type to frontend

**Files:**
- Modify: `frontend/types.ts`

- [ ] **Step 1: Add interface** — append after the `OnboardingTask` interface (around line 218):

```typescript
export interface OnboardingTaskTemplate {
  id: string;
  taskName: string;
  taskDescription?: string;
  taskCategory: 'IT' | 'HR' | 'TRAINING' | 'ADMIN';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueDayOffset: number;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/types.ts
git commit -m "feat: add OnboardingTaskTemplate type to frontend"
```

---

## Task 7: Add "Onboarding Tasks" tab to AdminSettings

**Files:**
- Modify: `frontend/pages/AdminSettings.tsx`

- [ ] **Step 1: Extend the `activeTab` type** — find line 53:

```typescript
// Before:
const [activeTab, setActiveTab] = useState<'service-desks' | 'users'>('service-desks');

// After:
const [activeTab, setActiveTab] = useState<'service-desks' | 'users' | 'onboarding-tasks'>('service-desks');
```

- [ ] **Step 2: Add state for templates** — add after the existing state declarations (after line ~53):

```typescript
const [templates, setTemplates] = useState<OnboardingTaskTemplate[]>([]);
const [templatesLoading, setTemplatesLoading] = useState(false);
const [templateError, setTemplateError] = useState<string | null>(null);
const [editingTemplate, setEditingTemplate] = useState<OnboardingTaskTemplate | null>(null);
const [showTemplateForm, setShowTemplateForm] = useState(false);
const [templateForm, setTemplateForm] = useState({
    taskName: '',
    taskDescription: '',
    taskCategory: 'IT' as 'IT' | 'HR' | 'TRAINING' | 'ADMIN',
    priority: 'MEDIUM' as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
    dueDayOffset: 0,
    displayOrder: 0,
});
```

- [ ] **Step 3: Add import for `OnboardingTaskTemplate`** — find the types import at the top of `AdminSettings.tsx` and add `OnboardingTaskTemplate`:

```typescript
import { ..., OnboardingTaskTemplate } from '../types';
```

- [ ] **Step 4: Add fetch and CRUD functions** — add these functions inside the component, after existing fetch functions:

```typescript
const fetchTemplates = async () => {
    setTemplatesLoading(true);
    setTemplateError(null);
    try {
        const res = await apiClient.get('/admin/onboarding-templates');
        setTemplates(res.data.data);
    } catch (err: any) {
        setTemplateError(err.message || 'Failed to load templates');
    } finally {
        setTemplatesLoading(false);
    }
};

const handleSaveTemplate = async () => {
    try {
        if (editingTemplate) {
            const res = await apiClient.put(`/admin/onboarding-templates/${editingTemplate.id}`, templateForm);
            setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? res.data : t));
        } else {
            const res = await apiClient.post('/admin/onboarding-templates', templateForm);
            setTemplates(prev => [...prev, res.data]);
        }
        setShowTemplateForm(false);
        setEditingTemplate(null);
        setTemplateForm({ taskName: '', taskDescription: '', taskCategory: 'IT', priority: 'MEDIUM', dueDayOffset: 0, displayOrder: 0 });
    } catch (err: any) {
        setTemplateError(err.message || 'Failed to save template');
    }
};

const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this template? This will not affect existing onboarding checklists.')) return;
    try {
        await apiClient.delete(`/admin/onboarding-templates/${id}`);
        setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
        setTemplateError(err.message || 'Failed to delete template');
    }
};

const handleEditTemplate = (template: OnboardingTaskTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
        taskName: template.taskName,
        taskDescription: template.taskDescription || '',
        taskCategory: template.taskCategory,
        priority: template.priority,
        dueDayOffset: template.dueDayOffset,
        displayOrder: template.displayOrder,
    });
    setShowTemplateForm(true);
};
```

- [ ] **Step 5: Trigger fetch when tab activates** — find the existing `useEffect` that checks `activeTab` (around line 94) and add:

```typescript
// Before:
if (activeTab === 'users') {

// After:
if (activeTab === 'onboarding-tasks') {
    fetchTemplates();
} else if (activeTab === 'users') {
```

- [ ] **Step 6: Add tab button** — find the tabs array (around line 356) and add the new tab:

```typescript
{ id: 'service-desks', label: 'Service Desks', icon: 'support_agent' },
{ id: 'users', label: 'User Accounts', icon: 'manage_accounts' },
{ id: 'onboarding-tasks', label: 'Onboarding Tasks', icon: 'checklist' },
```

- [ ] **Step 7: Add tab panel** — add after the `{activeTab === 'users' && ( ... )}` closing block:

```tsx
{activeTab === 'onboarding-tasks' && (
    <div>
        <div className="flex items-center justify-between mb-6">
            <div>
                <h2 className="text-xl font-bold text-[#101418]">Onboarding Task Templates</h2>
                <p className="text-sm text-[#44546f] mt-1">These tasks are automatically added to every new hire's onboarding checklist.</p>
            </div>
            <button
                onClick={() => { setEditingTemplate(null); setTemplateForm({ taskName: '', taskDescription: '', taskCategory: 'IT', priority: 'MEDIUM', dueDayOffset: 0, displayOrder: 0 }); setShowTemplateForm(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-[#0052cc] text-white rounded-lg text-sm font-semibold hover:bg-[#0747a6] transition-colors"
            >
                <span className="material-symbols-outlined text-base">add</span>
                Add Task
            </button>
        </div>

        {templateError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{templateError}</div>}

        {/* Add/Edit Form */}
        {showTemplateForm && (
            <div className="mb-6 p-5 border border-[#0052cc] rounded-lg bg-blue-50">
                <h3 className="font-semibold text-[#101418] mb-4">{editingTemplate ? 'Edit Task Template' : 'New Task Template'}</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs font-semibold text-[#44546f] uppercase mb-1">Task Name *</label>
                        <input
                            type="text"
                            value={templateForm.taskName}
                            onChange={e => setTemplateForm(p => ({ ...p, taskName: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                            placeholder="e.g. Create Active Directory Account"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-semibold text-[#44546f] uppercase mb-1">Description</label>
                        <input
                            type="text"
                            value={templateForm.taskDescription}
                            onChange={e => setTemplateForm(p => ({ ...p, taskDescription: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                            placeholder="Brief description of what needs to be done"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-[#44546f] uppercase mb-1">Category *</label>
                        <select
                            value={templateForm.taskCategory}
                            onChange={e => setTemplateForm(p => ({ ...p, taskCategory: e.target.value as any }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                        >
                            <option value="IT">IT</option>
                            <option value="HR">HR</option>
                            <option value="TRAINING">Training</option>
                            <option value="ADMIN">Admin</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-[#44546f] uppercase mb-1">Priority *</label>
                        <select
                            value={templateForm.priority}
                            onChange={e => setTemplateForm(p => ({ ...p, priority: e.target.value as any }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                        >
                            <option value="CRITICAL">Critical</option>
                            <option value="HIGH">High</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-[#44546f] uppercase mb-1">Due Date Offset (days)</label>
                        <input
                            type="number"
                            value={templateForm.dueDayOffset}
                            onChange={e => setTemplateForm(p => ({ ...p, dueDayOffset: parseInt(e.target.value) || 0 }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                        />
                        <p className="text-xs text-[#44546f] mt-1">Negative = before start date, 0 = on start date, positive = after</p>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-[#44546f] uppercase mb-1">Display Order</label>
                        <input
                            type="number"
                            value={templateForm.displayOrder}
                            onChange={e => setTemplateForm(p => ({ ...p, displayOrder: parseInt(e.target.value) || 0 }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                        />
                    </div>
                </div>
                <div className="flex gap-3 mt-4">
                    <button
                        onClick={handleSaveTemplate}
                        disabled={!templateForm.taskName}
                        className="px-4 py-2 bg-[#0052cc] text-white rounded-lg text-sm font-semibold hover:bg-[#0747a6] disabled:opacity-50 transition-colors"
                    >
                        {editingTemplate ? 'Save Changes' : 'Add Template'}
                    </button>
                    <button
                        onClick={() => { setShowTemplateForm(false); setEditingTemplate(null); }}
                        className="px-4 py-2 border border-gray-300 text-[#44546f] rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        )}

        {/* Templates Table */}
        {templatesLoading ? (
            <div className="text-center py-8 text-[#44546f]">Loading templates...</div>
        ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">#</th>
                            <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">Task Name</th>
                            <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">Category</th>
                            <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">Priority</th>
                            <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">Due Offset</th>
                            <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">Status</th>
                            <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {templates.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-8 text-center text-[#44546f]">No templates yet. Add one above.</td></tr>
                        ) : templates.map((template, index) => (
                            <tr key={template.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-[#44546f]">{index + 1}</td>
                                <td className="px-4 py-3">
                                    <p className="text-sm font-medium text-[#101418]">{template.taskName}</p>
                                    {template.taskDescription && <p className="text-xs text-[#44546f] mt-0.5">{template.taskDescription}</p>}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                        template.taskCategory === 'IT' ? 'bg-blue-100 text-blue-700' :
                                        template.taskCategory === 'HR' ? 'bg-emerald-100 text-emerald-700' :
                                        template.taskCategory === 'TRAINING' ? 'bg-purple-100 text-purple-700' :
                                        'bg-gray-100 text-gray-700'
                                    }`}>{template.taskCategory}</span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`text-xs font-semibold ${
                                        template.priority === 'CRITICAL' ? 'text-red-600' :
                                        template.priority === 'HIGH' ? 'text-orange-600' :
                                        template.priority === 'MEDIUM' ? 'text-yellow-600' : 'text-gray-500'
                                    }`}>{template.priority}</span>
                                </td>
                                <td className="px-4 py-3 text-sm text-[#44546f]">
                                    {template.dueDayOffset === 0 ? 'Start date' :
                                     template.dueDayOffset < 0 ? `${Math.abs(template.dueDayOffset)}d before` :
                                     `${template.dueDayOffset}d after`}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${template.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {template.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEditTemplate(template)} className="text-[#0052cc] hover:text-[#0747a6] text-xs font-semibold">Edit</button>
                                        <button onClick={() => handleDeleteTemplate(template.id)} className="text-red-600 hover:text-red-800 text-xs font-semibold">Delete</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </div>
)}
```

- [ ] **Step 8: Verify frontend compiles**

```bash
cd frontend
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add frontend/types.ts frontend/pages/AdminSettings.tsx
git commit -m "feat: add Onboarding Tasks tab to Admin Settings with full CRUD"
```

---

## Task 8: End-to-end verification

- [ ] **Step 1: Check templates load in Admin Settings**
  - Log in as `admin@helpdesk.com` / `admin123`
  - Go to Admin Settings → "Onboarding Tasks" tab
  - Should see 12 templates seeded from Task 2

- [ ] **Step 2: Add a new template**
  - Click "Add Task", fill in: Name = "IT Security Briefing", Category = TRAINING, Priority = HIGH, Due Offset = 1
  - Click "Add Template"
  - Should appear in table immediately

- [ ] **Step 3: Edit a template**
  - Click Edit on "Enroll in Benefits"
  - Change priority to CRITICAL, click Save
  - Row should update without page reload

- [ ] **Step 4: Delete a template**
  - Click Delete on any template → confirm → row disappears

- [ ] **Step 5: Verify new onboarding uses DB templates**
  - Complete a new hiring flow through to LOA accepted
  - Check the Onboarding Workflow section — task count should match active templates in DB

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: onboarding task template admin configuration — complete"
```
