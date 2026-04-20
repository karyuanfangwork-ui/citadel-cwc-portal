# Admin Features Documentation

## User Management Features

### ✅ Features Currently Available

The admin console provides comprehensive user management capabilities through the `PUT /api/v1/users/:id` endpoint.

#### **Field-by-Field Update Capabilities:**

| Field | Updateable | Notes |
|-------|------------|-------|
| firstName | ✅ Yes | Can be updated by any admin |
| lastName | ✅ Yes | Can be updated by any admin |
| phone | ✅ Yes | Optional field |
| email | ❌ NO | Immutable after creation |
| department | ✅ Yes | Can be reassigned |
| jobTitle | ✅ Yes | Can be reassigned |
| isActive | ✅ Yes | Soft delete via deactivation |
| managerId | ✅ Yes | Can reassign manager |
| agentTeam | ✅ Yes | Can update team assignment |
| roles | ✅ Yes | Via separate endpoint |

#### **Available Endpoints:**

1. **GET /api/v1/users** - List all users (admin only)
   - Supports pagination (page, limit)
   - Supports filters: search, department, isActive, role
   
2. **PUT /api/v1/users/:id** - Update user fields
   - All fields above except email
   - Authorization: ADMIN role required

3. **POST /api/v1/users/:id/roles** - Update roles
   - Replaces all user roles atomically
   - Force-revokes active tokens
   - Authorization: ADMIN role required

4. **GET /api/v1/users/:id** - Get user details (admin only)
   - Includes roles and manager information

5. **DELETE /api/v1/users/:id** - Soft delete
   - Deactivates user (sets isActive: false)
   - Authorization: ADMIN role required

---

### ⚠️ **Limitation: Email Addresses Are Immutable**

#### **Why Email Cannot Be Updated:**

1. **Authentication Tied to Email**
   - The backend uses email for user sessions
   - JWT tokens contain email claims
   - Password resets sent to original email

2. **Duplicate Email Constraint**
   - Database has unique constraint on email
   - Email validation at registration
   - No update endpoint for email field

3. **Security Considerations**
   - Email is the primary identity
   - Email hash verification during login
   - Changing email would require password reset

#### **Workaround Options:**

**Option 1: Manual Admin Intervention (Current)**
- Direct database update via migration script
- Update user email, then force password reset
- Requires database access

**Option 2: Add Email Update Endpoint (Recommended)**
- Add email field to updateUserSchema
- Add duplicate check: `existing.findFirst({ where: { email: newEmail, id: { not: userId } } })`
- Force password reset on email change
- Clear existing sessions via tokenService.revokeAllForUser()

**Option 3: Legacy Email Field**
- Add `legacyEmail` field tracking original email
- Use for password resets to old address
- Maintain audit trail

#### **Impact Assessment:**

- **Frequency**: Low - Email changes are rare (< 1% of admin operations)
- **Severity**: Low - Workarounds exist
- **Customer Impact**: Minimal - Staff can be contacted via phone/manager
- **Priority**: Medium - Should be addressed in next sprint

---

### 📋 **Usage Examples**

#### **Create New User:**
```bash
POST /api/v1/users
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@company.com",
  "department": "IT",
  "roles": ["USER"]
}
```

Response includes temporary password.

#### **Update User Profile:**
```bash
PUT /api/v1/users/uuid-here
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "555-1234",
  "department": "HR",
  "jobTitle": "HR Manager"
}
```

#### **Assign New Roles:**
```bash
POST /api/v1/users/uuid-here/roles
Content-Type: application/json

{
  "roles": ["USER", "MANAGER"]
}
```

Automatically revokes active tokens.

#### **Get User List with Filters:**
```bash
GET /api/v1/users?page=1&limit=20&department=IT&role=USER
```

#### **List All Roles:**
```bash
GET /api/v1/users/roles/all
```

#### **Get Agents Only:**
```bash
GET /api/v1/users/agents
```

---

### 🔐 **Role-Based Access**

All user management endpoints require:
- **Authentication** (logged in session)
- **Authorization** (ADMIN or AGENT role)

#### **Role Hierarchy:**
```
CEO → CTO → CFO → ADMIN → AGENT → USER
```

#### **Permission Matrix:**
| Action | CEO | CTO | CFO | ADMIN | AGENT | USER |
|--------|-----|-----|-----|-------|-------|------|
| Create User | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Update User | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Assign Roles | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete User | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| List Users | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

---

### 📊 **Audit Considerations**

User changes should be logged:

1. **Name/Department Changes**
   - Log who made the change
   - Log timestamp
   - Log old vs new values

2. **Role Assignments**
   - Log previous roles
   - Log new roles
   - Log reason for change

3. **Deactivation**
   - Log who deactivated
   - Log reason code
   - Log deactivation date

---

### 🎯 **Best Practices**

#### **Creating New Users:**
1. ✅ Use approved naming convention
2. ✅ Validate email format
3. ✅ Assign appropriate initial roles
4. ✅ Set correct department
5. ❌ Never create multiple accounts for same person

#### **Updating Existing Users:**
1. ✅ Verify the user exists
2. ✅ Confirm with user or manager
3. ✅ Update fields appropriately
4. ❌ Never change email without documented reason
5. ❌ Never remove USER role without replacement

#### **Deactivating Users:**
1. ✅ Soft delete (set isActive: false)
2. ✅ Keep historical data
3. ✅ Revoke active sessions
4. ✅ Notify IT for account cleanup

#### **Role Management:**
1. ✅ Replace roles atomically (don't add/remove separately)
2. ✅ Force token revocation on role change
3. ✅ Assign minimal required roles
4. ✅ Document role assignments

---

### 🛠️ **API Reference**

#### **GET /api/v1/users** - List Users

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 10)
- `search` (string): Search term (email, first/last name)
- `department` (string): Filter by department
- `isActive` (boolean): Filter active/inactive
- `role` (string): Filter by role name

**Response:**
```json
{
  "status": "success",
  "data": {
    "users": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

#### **PUT /api/v1/users/:id** - Update User

**Request Body:**
```json
{
  "firstName": "string",
  "lastName": "string",
  "phone": "string",
  "department": "string",
  "jobTitle": "string",
  "isActive": "boolean",
  "managerId": "uuid",
  "agentTeam": "string"
}
```

**Note:** Email field is intentionally omitted.

#### **POST /api/v1/users/:id/roles** - Assign Roles

**Request Body:**
```json
{
  "roles": ["USER", "MANAGER"]
}
```

---

### 🧪 **Testing Checklist**

#### **User Creation:**
- [ ] Valid name, email, department
- [ ] Duplicate email validation
- [ ] Email format validation
- [ ] Temporary password generation
- [ ] User roles assignment

#### **User Update:**
- [ ] First name update
- [ ] Last name update
- [ ] Phone update
- [ ] Department update
- [ ] Job title update
- [ ] Active/inactive toggle
- [ ] Manager assignment
- [ ] Agent team update
- [ ] Email update (should fail)

#### **Role Management:**
- [ ] Assign multiple roles
- [ ] Replace all roles atomically
- [ ] Role validation
- [ ] Unknown role handling
- [ ] Token revocation after role change

#### **User Listing:**
- [ ] Pagination works correctly
- [ ] Search filters work
- [ ] Department filter works
- [ ] Role filter works
- [ ] Active status filter works
- [ ] Total count accurate

#### **User Deactivation:**
- [ ] Soft delete works
- [ ] User can't login after deactivation
- [ ] Audit log entries created
- [ ] Sessions properly revoked

---

### 📝 **Future Enhancement Candidates**

1. **Email Update Endpoint** (Priority: High)
   - Add duplicate email check
   - Trigger password reset
   - Clear active sessions

2. **Bulk User Operations** (Priority: Low)
   - Bulk update names
   - Bulk assign roles
   - Bulk create users from CSV
   - Bulk deactivate users

3. **User Import/Export** (Priority: Medium)
   - CSV export of user list
   - CSV import with validation
   - Bulk user creation

4. **Audit Log Endpoint** (Priority: High)
   - View user change history
   - View role change history
   - Export audit trail

5. **User Profile Merge** (Priority: Low)
   - Detect duplicate accounts
   - Merge users with same email
   - Preserve request history

---

### 📚 **Related Documentation**

- [Auth Documentation](../auth/auth.md)
- [RBAC Documentation](../auth/rbac.md)
- [API Documentation](../API.md)
- [Workflow Documentation](../workflow.md)

---

*Last updated: 2026-04-19*
