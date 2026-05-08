# SEC-003, SEC-004, SEC-005 — IMPLEMENTATION PLAN

**Prepared:** April 23, 2026  
**Priority:** P0 Critical  
**Estimated Effort:** 5 days total  
**Status:** Ready for Review

---

## OVERVIEW

These three security tasks are foundational for production readiness:

| Task | Description | Effort | Dependencies |
|------|-------------|--------|--------------|
| **SEC-003** | Password Policy Validation | 1 day | None |
| **SEC-004** | Rate Limiting on Auth Endpoints | 1 day | None (already partially implemented) |
| **SEC-005** | Executive Role Enum in User Model | 3 days | SEC-003 (shares auth.controller.ts changes) |

---

## SEC-003: PASSWORD POLICY VALIDATION

### Current State Analysis

**Location:** `backend/src/controllers/auth.controller.ts`

**Findings:**
- Line 71, 78: `register()` accepts any password without validation
- Line 113, 124: `login()` has no password requirements
- Line 280: `resetPassword()` accepts any new password
- No minimum length enforcement
- No complexity requirements (uppercase, lowercase, number, special char)
- No breach detection (HaveIBeenPwned API)
- No password history (users can reuse old passwords)

**Risk:** Users can set weak passwords like `123456`, `password`, or `admin123`.

### Requirements

| Rule | Description | Enforcement |
|------|-------------|-------------|
| **Minimum Length** | At least 8 characters | Server-side validation |
| **Complexity** | Must contain uppercase, lowercase, number, and special character | Server-side validation |
| **Breach Check** | Password must not appear in HaveIBeenPwned database | API check (optional, graceful fallback) |
| **No Personal Info** | Password cannot contain email, first name, or last name | Server-side validation |
| **Password History** | Cannot reuse last 5 passwords | Database check (Phase 2) |

### Implementation Steps

#### Step 1: Create Password Validation Utility (2 hours)

**File:** `backend/src/utils/password.ts`

```typescript
import crypto from 'crypto';

export interface PasswordValidationResult {
    isValid: boolean;
    errors: string[];
    score: number; // 0-4 strength score
}

export interface PasswordPolicy {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumber: boolean;
    requireSpecial: boolean;
    checkBreach: boolean;
}

const DEFAULT_POLICY: PasswordPolicy = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true,
    checkBreach: false, // Optional - requires API call
};

/**
 * Validate password against policy rules
 */
export function validatePassword(
    password: string,
    email?: string,
    firstName?: string,
    lastName?: string,
    policy: PasswordPolicy = DEFAULT_POLICY
): PasswordValidationResult {
    const errors: string[] = [];
    let score = 0;

    // Length check
    if (password.length < policy.minLength) {
        errors.push(`Password must be at least ${policy.minLength} characters long`);
    } else {
        score += 1;
        if (password.length >= 12) score += 1; // Bonus for length
    }

    // Complexity checks
    if (policy.requireUppercase) {
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        } else {
            score += 1;
        }
    }

    if (policy.requireLowercase) {
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        } else {
            score += 1;
        }
    }

    if (policy.requireNumber) {
        if (!/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        } else {
            score += 1;
        }
    }

    if (policy.requireSpecial) {
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password must contain at least one special character');
        } else {
            score += 1;
        }
    }

    // Personal info check
    if (email) {
        const emailPrefix = email.split('@')[0].toLowerCase();
        if (password.toLowerCase().includes(emailPrefix) && emailPrefix.length > 2) {
            errors.push('Password cannot contain your email address');
        }
    }

    if (firstName && firstName.length > 2) {
        if (password.toLowerCase().includes(firstName.toLowerCase())) {
            errors.push('Password cannot contain your first name');
        }
    }

    if (lastName && lastName.length > 2) {
        if (password.toLowerCase().includes(lastName.toLowerCase())) {
            errors.push('Password cannot contain your last name');
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        score: Math.min(score, 4), // Cap at 4
    };
}

/**
 * Check if password has been pwned using HaveIBeenPwned API
 * Uses k-anonymity: only sends first 5 chars of SHA1 hash
 */
export async function checkPasswordBreach(password: string): Promise<{
    isPwned: boolean;
    count?: number;
    error?: string;
}> {
    try {
        // SHA1 hash the password
        const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
        const prefix = hash.slice(0, 5);
        const suffix = hash.slice(5);

        // Query HaveIBeenPwned API
        const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
        if (!response.ok) {
            return { isPwned: false, error: 'Breach check unavailable' };
        }

        const text = await response.text();
        const lines = text.split('\n');

        for (const line of lines) {
            const [hashSuffix, count] = line.split(':');
            if (hashSuffix.trim() === suffix) {
                return { isPwned: true, count: parseInt(count, 10) };
            }
        }

        return { isPwned: false };
    } catch (error) {
        // Graceful fallback - don't block registration if API is down
        return { isPwned: false, error: 'Breach check failed' };
    }
}
```

#### Step 2: Update Auth Controller (2 hours)

**File:** `backend/src/controllers/auth.controller.ts`

**Changes:**

```typescript
// Add import at top
import { validatePassword, checkPasswordBreach } from '../utils/password';

// Update register() method
register = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { email, password, firstName, lastName, department, jobTitle } = req.body;

    // NEW: Password validation
    const validation = validatePassword(password, email, firstName, lastName);
    if (!validation.isValid) {
        throw new AppError(validation.errors.join(', '), 400);
    }

    // Optional: Breach check (can be disabled in config)
    if (config.security.checkPasswordBreach) {
        const breachCheck = await checkPasswordBreach(password);
        if (breachCheck.isPwned) {
            throw new AppError(
                `This password has been found in ${breachCheck.count} data breaches. Please choose a different password.`,
                400
            );
        }
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new AppError('User with this email already exists', 400);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    // ... rest unchanged
});

// Update resetPassword() method
resetPassword = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { token, newPassword } = req.body;

    // NEW: Password validation
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
        throw new AppError(validation.errors.join(', '), 400);
    }

    const record = await passwordResetService.validateToken(token);
    if (!record) {
        throw new AppError('Invalid or expired password reset token', 400);
    }

    await passwordResetService.consumeToken(record.id, record.userId, newPassword);
    // ... rest unchanged
});
```

#### Step 3: Add Config Option (30 minutes)

**File:** `backend/src/config/index.ts`

```typescript
// Add to config object
security: {
    checkPasswordBreach: process.env.CHECK_PASSWORD_BREACH === 'true',
    passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
},
```

**File:** `backend/.env.example`

```bash
# Password Policy
PASSWORD_MIN_LENGTH=8
CHECK_PASSWORD_BREACH=false
```

#### Step 4: Frontend Validation (2 hours)

**File:** `frontend/src/pages/Register.tsx`

Add real-time password strength indicator:

```typescript
// Add password strength validation
const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
    const checks = [
        password.length >= 8,
        /[A-Z]/.test(password),
        /[a-z]/.test(password),
        /[0-9]/.test(password),
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    ];

    const score = checks.filter(Boolean).length;
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['red', 'orange', 'yellow', 'blue', 'green'];

    return {
        score,
        label: labels[score],
        color: colors[score],
    };
};

// In component, add strength indicator below password field
<div className="password-strength">
    <div className="strength-bar">
        <div className={`strength-fill ${getPasswordStrength(password).color}`} 
             style={{ width: `${(getPasswordStrength(password).score / 5) * 100}%` }} />
    </div>
    <span className="strength-label">{getPasswordStrength(password).label}</span>
</div>
```

### Testing Checklist

- [ ] Register with weak password (e.g., `123456`) — should fail
- [ ] Register with strong password — should succeed
- [ ] Register with email in password — should fail
- [ ] Reset password with weak password — should fail
- [ ] Frontend shows password strength indicator
- [ ] Error messages are clear and helpful

---

## SEC-004: RATE LIMITING ON AUTH ENDPOINTS

### Current State Analysis

**Location:** `backend/src/middleware/rateLimit.middleware.ts`

**Findings:**
- `authLimiter` already exists with 10 requests per 15 minutes
- `passwordResetLimiter` already exists with 5 requests per hour
- Need to verify these are applied to all auth routes

**Status:** ✅ **Mostly Implemented** — Just needs verification and route wiring

### Implementation Steps

#### Step 1: Verify Route Wiring (1 hour)

**File:** `backend/src/routes/auth.routes.ts`

Check that limiters are applied:

```typescript
import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// Login, register, logout should use authLimiter
router.post('/login', authLimiter, authController.login);
router.post('/register', authLimiter, authController.register);
router.post('/logout', authController.logout); // No limiter needed (requires auth)

// Refresh token - use authLimiter
router.post('/refresh', authLimiter, authController.refreshToken);

// Password reset - use stricter limiter
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, authController.resetPassword);

export default router;
```

#### Step 2: Add Per-IP Tracking (1 hour)

The current rate limiter uses express-rate-limit's default memory store. For production with multiple instances, we should use Redis:

**File:** `backend/src/middleware/rateLimit.middleware.ts`

```typescript
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { config } from '../config';

// Create Redis client
const redisClient = new Redis(config.redis.url);

// Create Redis store
const redisStore = new RedisStore({
    sendCommand: (...args: string[]) => redisClient.call(...args),
});

// Update authLimiter to use Redis store
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'development' ? 1000 : 10,
    store: redisStore, // Use Redis for multi-instance support
    message: {
        status: 'error',
        statusCode: 429,
        message: 'Too many authentication attempts. Please try again after 15 minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use IP address or fingerprint
        return req.ip || req.headers['x-forwarded-for'] || 'unknown';
    },
});
```

**Note:** Requires `npm install rate-limit-redis`

#### Step 3: Add Rate Limit Headers (30 minutes)

Ensure rate limit headers are returned in responses:

```typescript
// The standardHeaders: true option already adds RateLimit headers
// But we can add custom headers for better client handling

router.post('/login', authLimiter, (req, res, next) => {
    // Add retry-after header info
    res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + 900);
    next();
}, authController.login);
```

#### Step 4: Add Monitoring (1 hour)

Log rate limit hits for security monitoring:

```typescript
// In rateLimit.middleware.ts
export const authLimiter = rateLimit({
    // ... existing config
    handler: (_req, res, _next, options) => {
        logger.warn('Rate limit exceeded', {
            ip: _req.ip,
            path: _req.path,
            userAgent: _req.headers['user-agent'],
        });
        res.status(options.statusCode).json(options.message);
    },
});
```

### Testing Checklist

- [ ] Make 10 login attempts in 15 minutes — 11th should be blocked
- [ ] Make 5 password reset requests in 1 hour — 6th should be blocked
- [ ] Verify rate limit headers in response
- [ ] Check logs for rate limit warnings
- [ ] Test with different IP addresses

---

## SEC-005: EXECUTIVE ROLE ENUM IN USER MODEL

### Current State Analysis

**Location:** `backend/prisma/schema.prisma`, `backend/src/controllers/it-workflow.controller.ts`

**Findings:**
- No `executiveRole` field in User model
- CEO/CFO/CTO checks are done via string comparison (anti-pattern)
- Example from it-workflow.controller.ts (lines to search):
  ```typescript
  if (user.email === 'ceo@company.com') // Bad
  if (user.roles.includes('CEO')) // Also bad - not in RBAC
  ```

**Risk:** Adding/removing executives requires code changes, not admin UI updates.

### Implementation Steps

#### Step 1: Update Prisma Schema (30 minutes)

**File:** `backend/prisma/schema.prisma`

Add enum and field to User model:

```prisma
// Add new enum (after RequestPriority enum, around line 304)
enum ExecutiveRole {
    NONE
    CEO
    CFO
    CTO
    COO
    VP
}

// Update User model (add after agentTeam field, around line 30)
model User {
    // ... existing fields
    agentTeam     String?       @map("agent_team") @db.VarChar(50)
    executiveRole ExecutiveRole @default(NONE) @map("executive_role")
    // ... rest unchanged
}
```

**Run migration:**
```bash
cd backend
npx prisma migrate dev --name add_executive_role_enum
npx prisma generate
```

#### Step 2: Update Seed Data (30 minutes)

**File:** `backend/prisma/seed.ts`

Add executive roles to test users:

```typescript
// Update admin user to have CEO role for testing
await prisma.user.update({
    where: { email: 'admin@helpdesk.com' },
    data: { executiveRole: 'CEO' },
});

// Add CFO and CTO test users
await prisma.user.create({
    data: {
        email: 'cfo@helpdesk.com',
        passwordHash: await bcrypt.hash('cfo123', 12),
        firstName: 'Chief',
        lastName: 'Financial Officer',
        executiveRole: 'CFO',
    },
});

await prisma.user.create({
    data: {
        email: 'cto@helpdesk.com',
        passwordHash: await bcrypt.hash('cto123', 12),
        firstName: 'Chief',
        lastName: 'Technical Officer',
        executiveRole: 'CTO',
    },
});
```

#### Step 3: Create Executive Role Helper (1 hour)

**File:** `backend/src/utils/executiveRole.ts`

```typescript
import { ExecutiveRole } from '@prisma/client';

export interface UserWithExecutiveRole {
    executiveRole: ExecutiveRole;
}

/**
 * Check if user has a specific executive role
 */
export function hasExecutiveRole(user: UserWithExecutiveRole | null, role: ExecutiveRole): boolean {
    if (!user) return false;
    return user.executiveRole === role;
}

/**
 * Check if user has any executive role (not NONE)
 */
export function isExecutive(user: UserWithExecutiveRole | null): boolean {
    if (!user) return false;
    return user.executiveRole !== 'NONE';
}

/**
 * Get approval threshold for executive role
 * Returns the "level" of executive (higher = more authority)
 */
export function getExecutiveLevel(role: ExecutiveRole): number {
    const levels: Record<ExecutiveRole, number> = {
        NONE: 0,
        VP: 1,
        COO: 2,
        CTO: 3,
        CFO: 3,
        CEO: 4,
    };
    return levels[role] || 0;
}

/**
 * Check if user can approve based on amount threshold
 */
export function canApproveAmount(user: UserWithExecutiveRole | null, amount: number): boolean {
    if (!user) return false;

    const thresholds: Record<ExecutiveRole, number> = {
        NONE: 0,
        VP: 2500,
        COO: 5000,
        CTO: 10000,
        CFO: 50000,
        CEO: Infinity,
    };

    return amount <= thresholds[user.executiveRole];
}
```

#### Step 4: Update IT Workflow Controller (3 hours)

**File:** `backend/src/controllers/it-workflow.controller.ts`

Find and replace all string-based executive checks:

```typescript
// OLD (find and replace these patterns)
if (user.roles.includes('CEO')) { ... }
if (user.email === 'ceo@company.com') { ... }
if (req.user?.email === config.executives.ceoEmail) { ... }

// NEW
import { hasExecutiveRole, getExecutiveLevel, canApproveAmount } from '../utils/executiveRole';

// In approval handlers
if (!hasExecutiveRole(user, 'CEO')) {
    throw new AppError('CEO approval required', 403);
}

// For amount-based approvals
const amount = parseFloat(req.body.estimatedPrice);
if (!canApproveAmount(user, amount)) {
    throw new AppError(`Insufficient approval authority for amount $${amount}`, 403);
}

// For approval level checks
const requiredLevel = 4; // CEO level
if (getExecutiveLevel(user.executiveRole) < requiredLevel) {
    throw new AppError('Insufficient executive level for this approval', 403);
}
```

**Search patterns to find:**
```bash
grep -n "CEO\|CFO\|CTO" backend/src/controllers/it-workflow.controller.ts
grep -n "ceo@\|cfo@\|cto@" backend/src/controllers/it-workflow.controller.ts
```

#### Step 5: Update LOA Controller (1 hour)

**File:** `backend/src/controllers/loa.controller.ts`

Same pattern — replace string checks with helper functions.

#### Step 6: Update Finance Workflow Controller (1 hour)

**File:** `backend/src/controllers/finance-workflow.controller.ts`

Same pattern — replace string checks with helper functions.

#### Step 7: Add Admin UI for Executive Role (4 hours)

**File:** `frontend/src/components/admin/CreateUserModal.tsx`

Add executive role dropdown:

```typescript
// Add to form fields
<div className="form-group">
    <label htmlFor="executiveRole">Executive Role</label>
    <select
        id="executiveRole"
        value={formData.executiveRole}
        onChange={(e) => setFormData({ ...formData, executiveRole: e.target.value })}
    >
        <option value="NONE">None</option>
        <option value="CEO">CEO</option>
        <option value="CFO">CFO</option>
        <option value="CTO">CTO</option>
        <option value="COO">COO</option>
        <option value="VP">VP</option>
    </select>
</div>
```

**File:** `frontend/src/components/admin/UserEditModal.tsx`

Same addition for editing existing users.

#### Step 8: Update User Type Definitions (30 minutes)

**File:** `frontend/src/types/user.ts` (or wherever user types are defined)

```typescript
export type ExecutiveRole = 'NONE' | 'CEO' | 'CFO' | 'CTO' | 'COO' | 'VP';

export interface User {
    // ... existing fields
    executiveRole: ExecutiveRole;
}
```

### Testing Checklist

- [ ] Run Prisma migration successfully
- [ ] Seed data includes executive roles
- [ ] CEO can approve hardware requests over $10,000
- [ ] Non-CEO cannot approve hardware requests over threshold
- [ ] Admin UI shows executive role dropdown
- [ ] Can assign/change executive role via Admin Settings
- [ ] All existing approval flows still work
- [ ] No TypeScript errors in controllers

---

## DEPENDENCIES & INTEGRATION

### Task Dependencies

```
SEC-003 (Password Policy)
├── No dependencies
└── Blocks: None

SEC-004 (Rate Limiting)
├── No dependencies
└── Blocks: None (already partially implemented)

SEC-005 (Executive Role)
├── Depends on: None
└── Blocks: Finance fraud prevention (FIN-001)
```

### Recommended Order

1. **SEC-004** (Rate Limiting) — 1 day, lowest risk, already mostly done
2. **SEC-003** (Password Policy) — 1 day, medium risk, isolated changes
3. **SEC-005** (Executive Role) — 3 days, highest risk, touches multiple controllers

### Files That Will Change

| File | Task | Change Type |
|------|------|-------------|
| `backend/src/utils/password.ts` | SEC-003 | New file |
| `backend/src/controllers/auth.controller.ts` | SEC-003 | Modify |
| `backend/src/config/index.ts` | SEC-003 | Modify |
| `backend/.env.example` | SEC-003 | Modify |
| `frontend/src/pages/Register.tsx` | SEC-003 | Modify |
| `backend/src/middleware/rateLimit.middleware.ts` | SEC-004 | Modify |
| `backend/src/routes/auth.routes.ts` | SEC-004 | Verify/Modify |
| `backend/prisma/schema.prisma` | SEC-005 | Modify |
| `backend/prisma/seed.ts` | SEC-005 | Modify |
| `backend/src/utils/executiveRole.ts` | SEC-005 | New file |
| `backend/src/controllers/it-workflow.controller.ts` | SEC-005 | Modify |
| `backend/src/controllers/loa.controller.ts` | SEC-005 | Modify |
| `backend/src/controllers/finance-workflow.controller.ts` | SEC-005 | Modify |
| `frontend/src/components/admin/CreateUserModal.tsx` | SEC-005 | Modify |
| `frontend/src/components/admin/UserEditModal.tsx` | SEC-005 | Modify |
| `frontend/src/types/user.ts` | SEC-005 | Modify |

---

## RISK ASSESSMENT

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Password policy breaks existing users | Low | Medium | Only applies to new registrations and password resets |
| Rate limiting blocks legitimate users | Low | Medium | High limit in development, clear error messages |
| Executive role migration breaks approvals | Medium | High | Thorough testing of all approval flows before deploy |
| Prisma migration fails | Low | High | Backup database before migration, test on staging first |

---

## ROLLBACK PLAN

### SEC-003 Rollback
- Revert `auth.controller.ts` changes
- Remove `password.ts` utility
- No database changes to rollback

### SEC-004 Rollback
- Revert `rateLimit.middleware.ts` changes
- No database changes to rollback

### SEC-005 Rollback
```bash
# Rollback Prisma migration
npx prisma migrate resolve --rolled-back add_executive_role_enum

# Revert code changes
git checkout -- backend/src/controllers/
git checkout -- frontend/src/components/admin/
```

---

## ACCEPTANCE CRITERIA

### SEC-003 (Password Policy)
- [ ] Password with < 8 characters is rejected
- [ ] Password without uppercase is rejected
- [ ] Password without lowercase is rejected
- [ ] Password without number is rejected
- [ ] Password without special character is rejected
- [ ] Password containing email is rejected
- [ ] Frontend shows password strength indicator
- [ ] Clear error messages displayed to user

### SEC-004 (Rate Limiting)
- [ ] 11th login attempt in 15 minutes is blocked
- [ ] 6th password reset in 1 hour is blocked
- [ ] Rate limit headers present in response
- [ ] Rate limit exceeded logged for monitoring
- [ ] Different IPs have separate limits

### SEC-005 (Executive Role)
- [ ] User model has `executiveRole` field
- [ ] All CEO/CFO/CTO string checks replaced with helper functions
- [ ] Admin UI can assign executive roles
- [ ] Approval flows work correctly with new system
- [ ] No TypeScript errors
- [ ] Seed data includes test executives

---

## TIMELINE

| Day | Task | Deliverable |
|-----|------|-------------|
| **Day 1** | SEC-004: Rate Limiting | Verified and enhanced rate limiting on all auth endpoints |
| **Day 2** | SEC-003: Password Policy (Backend) | Password validation utility, auth controller updates |
| **Day 3** | SEC-003: Password Policy (Frontend) | Password strength indicator, form validation |
| **Day 4** | SEC-005: Executive Role (Schema + Backend) | Prisma migration, helper utilities, controller updates |
| **Day 5** | SEC-005: Executive Role (Frontend + Testing) | Admin UI updates, full testing, documentation |

---

## NEXT STEPS

1. **Review this plan** — Confirm approach and estimates
2. **Backup database** — Before Prisma migration
3. **Create feature branch** — `feature/sec-003-004-005`
4. **Start with SEC-004** — Lowest risk, quickest win
5. **Test each task independently** — Before moving to next
6. **Update IMPLEMENTATION_CHECKLIST.md** — Mark tasks complete

---

**Prepared by:** AI Senior Product Auditor  
**Review Required By:** Platform Team Lead  
**Target Start Date:** April 24, 2026
