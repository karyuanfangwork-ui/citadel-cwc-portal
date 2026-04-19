# Create User — Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Create User" to Admin Console → User Accounts tab — modal form creates user with USER role and temp password `abc@123`, then displays the temp password for handoff.

**Architecture:** New `POST /api/v1/users` backend endpoint + `CreateUserModal` frontend component. `adminService` gets a `createUser()` method. `AdminSettings.tsx` wires the button and modal. No email delivery — admin copies temp password manually.

**Tech Stack:** Express + Prisma + bcryptjs (backend); React + TypeScript + Tailwind (frontend); existing `apiClient` axios instance.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `backend/src/controllers/user.controller.ts` | Add `createUser` handler |
| Modify | `backend/src/routes/user.routes.ts` | Register `POST /` route |
| Modify | `frontend/src/services/admin.service.ts` | Add `createUser()` method |
| Create | `frontend/src/components/admin/CreateUserModal.tsx` | Two-phase modal UI |
| Modify | `frontend/pages/AdminSettings.tsx` | Wire button + modal |

---

## Task 1: Backend — `createUser` controller method

**Files:**
- Modify: `backend/src/controllers/user.controller.ts`

- [ ] **Step 1: Add `createUser` handler inside the `UserController` class**

Open `backend/src/controllers/user.controller.ts`. Add this method before the closing `}` of the class (before `export const userController`):

```typescript
createUser = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { firstName, lastName, email, department } = req.body;

    if (!firstName || !lastName || !email) {
        throw new AppError('firstName, lastName, and email are required', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new AppError('Invalid email format', 400);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        throw new AppError('Email already in use', 409);
    }

    const TEMP_PASSWORD = 'abc@123';
    const hashedPassword = await bcrypt.hash(TEMP_PASSWORD, 10);

    const userRole = await prisma.role.findFirst({ where: { name: 'USER' } });
    if (!userRole) throw new AppError('USER role not found in database', 500);

    const newUser = await prisma.user.create({
        data: {
            firstName,
            lastName,
            email,
            password: hashedPassword,
            department: department || null,
            isActive: true,
            roles: {
                create: { roleId: userRole.id },
            },
        },
        include: {
            roles: { include: { role: true } },
        },
    });

    res.status(201).json({
        status: 'success',
        data: {
            user: {
                id: newUser.id,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                email: newUser.email,
                department: newUser.department,
                roles: (newUser as any).roles.map((ur: any) => ur.role.name),
            },
            tempPassword: TEMP_PASSWORD,
        },
    });
});
```

- [ ] **Step 2: Verify backend builds clean**

```bash
cd backend && npm run build 2>&1 | tail -5
```

Expected: `Found 0 errors.` (pre-existing errors are acceptable, no new ones)

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/user.controller.ts
git commit -m "feat: add createUser controller method with USER role and temp password"
```

---

## Task 2: Backend — register the route

**Files:**
- Modify: `backend/src/routes/user.routes.ts`

- [ ] **Step 1: Add `POST /` route**

Open `backend/src/routes/user.routes.ts`. Add this line after the existing `router.get('/', ...)` line:

```typescript
router.post('/', authorize('ADMIN'), userController.createUser);
```

The file should have these routes in order (existing routes unchanged, new one added):
```typescript
router.get('/agents', authorize('ADMIN', 'AGENT'), userController.getAgents);
router.get('/me', userController.getMe);
router.put('/me', validate(updateProfileSchema), userController.updateMe);
router.post('/:id/roles', authorize('ADMIN'), userController.assignRoles);
router.get('/roles/all', authorize('ADMIN'), userController.listRoles);
router.get('/:id', authorize('ADMIN'), userController.getUserById);
router.get('/', authorize('ADMIN'), userController.getAllUsers);
router.post('/', authorize('ADMIN'), userController.createUser);   // ← new
router.put('/:id', authorize('ADMIN'), userController.updateUser);
router.delete('/:id', authorize('ADMIN'), userController.deleteUser);
```

- [ ] **Step 2: Verify backend builds clean**

```bash
cd backend && npm run build 2>&1 | tail -5
```

Expected: no new errors

- [ ] **Step 3: Smoke test with curl**

Start backend dev server (`npm run dev` in `backend/`), then:

```bash
curl -s -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-jwt>" \
  -d '{"firstName":"Test","lastName":"User","email":"test.newuser@example.com"}' | jq .
```

Expected response shape:
```json
{
  "status": "success",
  "data": {
    "user": { "id": "...", "firstName": "Test", "lastName": "User", "email": "test.newuser@example.com", "roles": ["USER"] },
    "tempPassword": "abc@123"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/user.routes.ts
git commit -m "feat: register POST /api/v1/users route for admin user creation"
```

---

## Task 3: Frontend service — `createUser` method

**Files:**
- Modify: `frontend/src/services/admin.service.ts`

- [ ] **Step 1: Add interface and method to `adminService`**

Open `frontend/src/services/admin.service.ts`. Add this interface near the top (after existing interfaces):

```typescript
export interface CreateUserData {
    firstName: string;
    lastName: string;
    email: string;
    department?: string;
}

export interface CreateUserResult {
    user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        department: string | null;
        roles: string[];
    };
    tempPassword: string;
}
```

Then add this method inside the `adminService` object (after `listRoles`):

```typescript
async createUser(data: CreateUserData): Promise<CreateUserResult> {
    const response = await apiClient.post('/users', data);
    return response.data.data;
},
```

- [ ] **Step 2: Verify frontend builds clean**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no new errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/admin.service.ts
git commit -m "feat: add createUser method to adminService"
```

---

## Task 4: Frontend — `CreateUserModal` component

**Files:**
- Create: `frontend/src/components/admin/CreateUserModal.tsx`

- [ ] **Step 1: Create the component file**

Create `frontend/src/components/admin/CreateUserModal.tsx`:

```tsx
import React, { useState } from 'react';
import { adminService, CreateUserData, CreateUserResult } from '../../services/admin.service';

interface CreateUserModalProps {
    onSuccess: () => void;
    onClose: () => void;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ onSuccess, onClose }) => {
    const [phase, setPhase] = useState<'form' | 'success'>('form');
    const [form, setForm] = useState<CreateUserData>({ firstName: '', lastName: '', email: '', department: '' });
    const [result, setResult] = useState<CreateUserResult | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
            setError('First name, last name, and email are required.');
            return;
        }
        try {
            setSubmitting(true);
            const data: CreateUserData = {
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                email: form.email.trim(),
                ...(form.department?.trim() ? { department: form.department.trim() } : {}),
            };
            const res = await adminService.createUser(data);
            setResult(res);
            setPhase('success');
        } catch (err: any) {
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to create user.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCopy = () => {
        if (result) {
            navigator.clipboard.writeText(result.tempPassword);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDone = () => {
        onSuccess();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-blue-50 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[#0052cc]">person_add</span>
                        </div>
                        <div>
                            <h2 className="font-bold text-base text-gray-900">Create User</h2>
                            <p className="text-xs text-gray-500">New account · USER role · Temp password</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-gray-400">close</span>
                    </button>
                </div>

                {phase === 'form' ? (
                    <form onSubmit={handleSubmit}>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">First Name <span className="text-red-500">*</span></label>
                                    <input
                                        name="firstName"
                                        value={form.firstName}
                                        onChange={handleChange}
                                        placeholder="John"
                                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Last Name <span className="text-red-500">*</span></label>
                                    <input
                                        name="lastName"
                                        value={form.lastName}
                                        onChange={handleChange}
                                        placeholder="Doe"
                                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Email <span className="text-red-500">*</span></label>
                                <input
                                    name="email"
                                    type="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    placeholder="john.doe@company.com"
                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                    Department <span className="font-normal normal-case text-gray-400">(optional)</span>
                                </label>
                                <input
                                    name="department"
                                    value={form.department}
                                    onChange={handleChange}
                                    placeholder="e.g. IT, HR, Finance"
                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                                />
                            </div>
                            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                        </div>
                        <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                                Cancel
                            </button>
                            <button type="submit" disabled={submitting} className="px-4 py-2.5 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-[#0047b3] disabled:opacity-50">
                                {submitting ? 'Creating…' : 'Create User'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div>
                        <div className="p-5 space-y-4">
                            <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                <span className="text-sm font-bold">User created successfully</span>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Account</p>
                                <p className="text-sm font-bold text-gray-900">{result?.user.firstName} {result?.user.lastName}</p>
                                <p className="text-sm text-gray-500">{result?.user.email}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Temporary Password</p>
                                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                                    <code className="flex-1 text-sm font-mono font-bold text-amber-800">{result?.tempPassword}</code>
                                    <button type="button" onClick={handleCopy} className="text-amber-600 hover:text-amber-800 transition-colors">
                                        <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-1.5">Share this with the user. They can change it after logging in.</p>
                            </div>
                        </div>
                        <div className="flex justify-end p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                            <button type="button" onClick={handleDone} className="px-4 py-2.5 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-[#0047b3]">
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreateUserModal;
```

- [ ] **Step 2: Verify frontend builds clean**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no new errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/CreateUserModal.tsx
git commit -m "feat: add CreateUserModal component with form and success phases"
```

---

## Task 5: Frontend — wire button and modal into AdminSettings

**Files:**
- Modify: `frontend/pages/AdminSettings.tsx`

- [ ] **Step 1: Import `CreateUserModal`**

At the top of `frontend/pages/AdminSettings.tsx`, add the lazy import alongside the other imports:

```tsx
const CreateUserModal = lazy(() => import('../src/components/admin/CreateUserModal'));
```

- [ ] **Step 2: Add `showCreateUserModal` state**

Find the block of `useState` declarations (around line 55-65). Add:

```tsx
const [showCreateUserModal, setShowCreateUserModal] = useState(false);
```

- [ ] **Step 3: Add "+ Create User" button to User Accounts header**

Find the `{activeTab === 'users' && (` block. The header div contains the search input and role filter select. Add the button after the `<select>` closing tag, inside the flex container:

```tsx
<button
    onClick={() => setShowCreateUserModal(true)}
    className="flex items-center gap-2 px-4 py-3 bg-[#0052cc] text-white text-sm font-bold rounded-2xl hover:bg-[#0047b3] transition-colors whitespace-nowrap"
>
    <span className="material-symbols-outlined text-sm">person_add</span>
    Create User
</button>
```

The header div after this change should look like:
```tsx
<div className="p-8 border-b border-gray-100 flex flex-col md:flex-row gap-4 bg-gray-50/20">
    <div className="relative flex-1">
        {/* search input — unchanged */}
    </div>
    <select {/* role filter — unchanged */}>
        {/* options — unchanged */}
    </select>
    <button
        onClick={() => setShowCreateUserModal(true)}
        className="flex items-center gap-2 px-4 py-3 bg-[#0052cc] text-white text-sm font-bold rounded-2xl hover:bg-[#0047b3] transition-colors whitespace-nowrap"
    >
        <span className="material-symbols-outlined text-sm">person_add</span>
        Create User
    </button>
</div>
```

- [ ] **Step 4: Render `CreateUserModal`**

Find the block where other modals are rendered (around line 1200+, near `{roleModalUser && (`). Add the modal render:

```tsx
{showCreateUserModal && (
    <Suspense fallback={null}>
        <CreateUserModal
            onSuccess={() => fetchUsers(1, userSearch, userRoleFilter)}
            onClose={() => setShowCreateUserModal(false)}
        />
    </Suspense>
)}
```

- [ ] **Step 5: Verify frontend builds clean**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no new errors

- [ ] **Step 6: Manual smoke test**

1. Start backend (`cd backend && npm run dev`)
2. Start frontend (`cd frontend && npm run dev`)
3. Login as `admin@helpdesk.com` / `admin123`
4. Go to Admin Settings → User Accounts
5. Confirm "+ Create User" button visible top-right of the accounts section
6. Click it → modal opens with form
7. Fill: First Name `Jane`, Last Name `Smith`, Email `jane.smith.test@example.com`, Department `Finance`
8. Click "Create User" → modal switches to success phase showing temp password `abc@123` with copy button
9. Click "Done" → modal closes, user list refreshes, `jane.smith.test@example.com` appears with USER role
10. Confirm duplicate email → reopen modal, submit same email → error "Email already in use"

- [ ] **Step 7: Commit**

```bash
git add frontend/pages/AdminSettings.tsx
git commit -m "feat: wire CreateUserModal into Admin Console User Accounts tab"
```
