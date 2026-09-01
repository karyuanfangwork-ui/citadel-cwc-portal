-- P02 Task 7: Department-scoped RBAC
-- Findings #1–#2, #5, #29–#30, #39–#40

-- Create departments table
CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT NOW(),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "departments_tenant_id_code_key" ON "departments"("tenant_id", "code");
CREATE INDEX "departments_tenant_id_is_active_idx" ON "departments"("tenant_id", "is_active");

-- Create department_memberships table
CREATE TABLE "department_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "valid_from" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
    "valid_until" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT NOW(),

    CONSTRAINT "department_memberships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "department_memberships_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "department_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "department_memberships_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "department_memberships_tenant_id_department_id_user_id_role_id_key" ON "department_memberships"("tenant_id", "department_id", "user_id", "role_id");
CREATE INDEX "department_memberships_tenant_id_user_id_idx" ON "department_memberships"("tenant_id", "user_id");
CREATE INDEX "department_memberships_tenant_id_department_id_idx" ON "department_memberships"("tenant_id", "department_id");

-- Seed default departments per tenant (IT, HR, Finance)
-- These will be populated by the seed script or by running the backfill separately.