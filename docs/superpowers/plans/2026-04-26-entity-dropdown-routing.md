# Entity-Linked Dropdown Fields Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Replace free-text entity fields (e.g. "Charge From Entity", "Charge To Entity") with auto-populated dropdowns sourced from the Entity master list, so that the entity routing engine can match selections to the correct approver.

**Architecture:** Add a new `entity` field type to the FormBuilder (alongside `text`, `select`, `date` etc.). When the form is rendered in CreateRequest, the `entity` type fetches active entities from `/admin/entities` and renders a `<select>` whose option values are entity **codes** (e.g. `CIT-MY`). The entity routing service's `CUSTOM_FIELD` mode already resolves entity codes — no backend changes to the routing engine are needed.

**Tech Stack:** Express/TypeScript (backend), React 19/TypeScript (frontend), Prisma ORM

---

## Key Design Decisions

1. **New field type `entity`** — not a magic `select` with hardcoded options. This makes it explicit in the FormBuilder that the dropdown is linked to the entity system, and the routing engine knows to treat it as an entity code.
2. **Stored value = entity code** (e.g. `CIT-MY`) — not the entity ID. This is human-readable, matches the routing engine's `CUSTOM_FIELD` resolution which already does `prisma.entity.findUnique({ where: { code } })`, and survives entity renames.
3. **No backend schema change** — customFields is a JSON column; adding `entity` type is purely a frontend concern for rendering. The routing engine already supports `CUSTOM_FIELD` mode by entity code.
4. **Public entities endpoint** — the entity list must be fetchable by authenticated non-admin users (requesters). We add a lightweight public endpoint separate from the admin CRUD.

---

### Task 1: Add `entity` type to FormBuilder field type union

**Objective:** Allow admins to pick "Entity" as a field type when configuring request type forms.

**Files:**
- Modify: `frontend/src/components/FormBuilder.tsx` (lines 18-24, 89-96)

**Step 1: Update FormField interface**

In `FormBuilder.tsx`, change the type union on line 21:

```typescript
// BEFORE
type: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'currency' | 'file';

// AFTER
type: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'currency' | 'file' | 'entity';
```

**Step 2: Add Entity option to type selector**

In the `<select>` that renders field types (around line 89-96), add after the "File Upload" option:

```tsx
<option value="entity">Entity (Dropdown)</option>
```

**Step 3: Add helper text when entity type is selected**

After the `options` section for `select` type (around line 111), add:

```tsx
{field.type === 'entity' && (
    <div className="sm:col-span-12 mt-2 pt-3 border-t border-gray-200/50">
        <p className="text-xs text-[#44546f] italic">
            Options are auto-populated from the Entity master list. No manual options needed.
            The stored value will be the entity code (e.g. CIT-MY).
        </p>
    </div>
)}
```

**Verification:** Open Admin > Service Desks > any request type's FormBuilder. Confirm "Entity (Dropdown)" appears in the Type dropdown and shows the helper text when selected.

---

### Task 2: Add public endpoint to list active entities

**Objective:** Provide an endpoint that any authenticated user can call to get the list of active entities (for dropdown population). The admin endpoint requires `admin:settings`, but requesters need access too.

**Files:**
- Modify: `backend/src/routes/entity.routes.ts`

**Step 1: Add public list route**

Add a new route BEFORE the admin-protected routes:

```typescript
// Public: list active entities (for dropdown population in request forms)
router.get('/active', authenticate, entityController.listActiveEntities);
```

**Step 2: Implement controller method**

In `backend/src/controllers/entity.controller.ts`, add to the EntityController class:

```typescript
listActiveEntities = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const entities = await prisma.entity.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            code: true,
        },
    });
    res.json({ status: 'success', data: { entities } });
});
```

**Step 3: Verify route order**

Ensure the public route `/active` is mounted BEFORE the parameterized admin routes so Express doesn't confuse "active" with an entity `:id`. The routes file should look like:

```typescript
router.get('/active', authenticate, entityController.listActiveEntities);  // PUBLIC
router.get('/', authenticate, requirePermission('admin:settings'), entityController.listEntities);  // ADMIN
router.post('/', authenticate, requirePermission('admin:settings'), entityController.createEntity);
// ...
```

**Verification:** Restart backend. `GET /api/v1/admin/entities/active` as any authenticated user should return active entities. `GET /api/v1/admin/entities/` should still require `admin:settings`.

---

### Task 3: Add `listActiveEntities` to frontend entity service

**Objective:** Frontend can fetch the entity list for dropdown population.

**Files:**
- Modify: `frontend/src/services/entity.service.ts`

**Step 1: Add method**

```typescript
async listActiveEntities() {
    const res = await apiClient.get('/admin/entities/active');
    return res.data.data.entities;
},
```

**Verification:** Build passes.

---

### Task 4: Render `entity` field type in CreateRequest form

**Objective:** When a request type form has `entity` type fields, the CreateRequest page renders them as dropdowns populated from the entity list, storing the entity code as the value.

**Files:**
- Modify: `frontend/pages/CreateRequest.tsx` (lines 146-290)

**Step 1: Import entity service and add state**

At the top of `CreateRequest.tsx`, add the import:

```typescript
import { entityService } from '../src/services/entity.service';
```

Add state inside the component (near other useState declarations, around line 12):

```typescript
const [entityOptions, setEntityOptions] = useState<{ code: string; name: string }[]>([]);
```

**Step 2: Fetch entities on mount**

Add a useEffect to fetch entities once on mount:

```typescript
useEffect(() => {
    entityService.listActiveEntities()
        .then(setEntityOptions)
        .catch(() => setEntityOptions([]));
}, []);
```

**Step 3: Add entity case to renderDynamicField**

In the `switch` statement of `renderDynamicField` (around line 149), add a case BEFORE `default`:

```tsx
case 'entity': {
    const selected = formData.customFields[field.id] || '';
    return (
        <div className="relative">
            <select
                required={field.required}
                className={`${commonClass} appearance-none`}
                value={selected}
                onChange={e => handleCustomFieldChange(field.id, e.target.value)}
                disabled={submitting}
            >
                <option value="" disabled>Select an entity...</option>
                {entityOptions.map(e => (
                    <option key={e.code} value={e.code}>{e.name} ({e.code})</option>
                ))}
            </select>
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">expand_more</span>
        </div>
    );
}
```

**Step 4: Update handleCustomFieldChange type** (if needed)

The existing `handleCustomFieldChange` takes `(fieldId: string, value: string)` — this works fine since entity codes are strings.

**Verification:** Create a request type with an `entity` field in the FormBuilder. Navigate to CreateRequest for that type. Confirm the dropdown populates with entity names. Select one and submit — the customFields should contain the entity code.

---

### Task 5: Display entity codes nicely in CustomFieldsPanel

**Objective:** When viewing a submitted request, entity field values (codes like "CIT-MY") should display as the human-readable entity name, not just the raw code.

**Files:**
- Modify: `frontend/src/components/request-detail/CustomFieldsPanel.tsx`

**Step 1: Import entity service and add lookup**

Add import at the top:

```typescript
import { entityService } from '../../services/entity.service';
```

The CustomFieldsPanel is a functional component, so add a state + effect to build a code→name map:

```typescript
const [entityNameMap, setEntityNameMap] = useState<Record<string, string>>({});

useEffect(() => {
    entityService.listActiveEntities()
        .then(entities => {
            const map: Record<string, string> = {};
            for (const e of entities) map[e.code] = e.name;
            setEntityNameMap(map);
        })
        .catch(() => {});
}, []);
```

**Step 2: Enhance formatValue for entity type**

In the `formatValue` function, add a check before the final `return String(value)`:

```typescript
// Entity code display — if formConfig marks this field as 'entity' type, resolve the name
if (fieldType === 'entity' && entityNameMap[String(value)]) {
    return `${entityNameMap[String(value)]} (${value})`;
}
```

But `formatValue` is currently a standalone function, not a component method — it can't access `entityNameMap`. Restructure slightly: make it accept an optional `entityMap` parameter.

Update the function signature (line 93):

```typescript
function formatValue(key: string, value: any, fieldType?: string, entityMap?: Record<string, string>): React.ReactNode {
```

Add the entity lookup before the final `return String(value)`:

```typescript
if (fieldType === 'entity' && entityMap && entityMap[String(value)]) {
    return `${entityMap[String(value)]} (${value})`;
}
```

Update the call site in the rendered JSX (around line 177):

```tsx
<dd className="text-sm text-[#101418] flex-1">{formatValue(key, value, getFieldType(key), entityNameMap)}</dd>
```

**Verification:** View a ticket that has entity custom field values. The code should render as "Citadel Malaysia (CIT-MY)" instead of just "CIT-MY".

---

### Task 6: Test the full routing flow end-to-end (manual QA checklist)

**Objective:** Verify the complete flow: admin configures entity dropdown → requester selects entity → backend routes to correct approver.

**Prerequisites:**
- Run `cd backend && npm run prisma:seed` to ensure entities exist in DB
- Dev servers running (backend :3000, frontend :5173)

**Manual QA Steps:**

1. **Admin — Configure Form:**
   - Go to Admin > Service Desks > Group Finance > Inter-Company Chargeback
   - Open FormBuilder, change "Charge From Entity" and "Charge To Entity" fields from `text` or `select` to `entity` type
   - Save

2. **Admin — Configure Routing:**
   - Go to Admin > Entities tab
   - Note the entity codes (CIT-MY, CIT-SG, CIT-HK) and their designated approvers
   - (Future: use the routing rules UI once built — for now the `CUSTOM_FIELD` mode is configured per request type via seed or direct DB)

3. **Requester — Submit Ticket:**
   - Navigate to Group Finance > Inter-Company Chargeback
   - The "Charge From Entity" and "Charge To Entity" fields should now be dropdowns
   - Select CIT-MY as charge from, CIT-SG as charge to
   - Submit

4. **Verify Routing:**
   - Check the ticket detail page
   - The EntityApprovalsPanel should show pending approval from CIT-SG's designated approver (or CIT-MY's, depending on routing rule configuration)
   - Custom fields should display "Citadel Malaysia (CIT-MY)" not just "CIT-MY"

5. **Approver — Entity Decision:**
   - Log in as the entity's designated approver
   - Navigate to the ticket
   - Click Approve or Reject in EntityApprovalsPanel
   - Verify status transitions correctly

**Verification:** All 5 steps above work without errors.

---

## Summary of Changes

| Layer | File | Change |
|-------|------|--------|
| Backend | `entity.routes.ts` | Add `GET /active` (public, auth-only) |
| Backend | `entity.controller.ts` | Add `listActiveEntities` method |
| Frontend | `entity.service.ts` | Add `listActiveEntities()` method |
| Frontend | `FormBuilder.tsx` | Add `entity` to field type union + UI option + helper text |
| Frontend | `CreateRequest.tsx` | Import entity service, fetch on mount, render `entity` case with dropdown |
| Frontend | `CustomFieldsPanel.tsx` | Resolve entity codes to names for display |

**No Prisma schema changes.** The `CUSTOM_FIELD` routing mode already resolves entity codes via `prisma.entity.findUnique({ where: { code } })`.

**No routing engine changes.** The `applyEntityRouting` service already reads `customFields[rule.customFieldKey]` and matches against entity codes.