-- Add CEO Role
INSERT INTO roles (id, name, description, created_at)
VALUES (gen_random_uuid(), 'CEO', 'Chief Executive Officer with approval authority', NOW())
ON CONFLICT (name) DO NOTHING;

-- Create CEO User
DO $$
DECLARE
    ceo_user_id UUID;
    ceo_role_id UUID;
BEGIN
    -- Get CEO role ID
    SELECT id INTO ceo_role_id FROM roles WHERE name = 'CEO';
    
    -- Create CEO user if not exists
    INSERT INTO users (
        id, email, password_hash, first_name, last_name, 
        department, job_title, is_active, created_at, updated_at
    )
    VALUES (
        gen_random_uuid(),
        'ceo@company.com',
        '$2a$10$YourHashedPasswordHere', -- Will need to update this
        'Chief',
        'Executive',
        'Executive',
        'Chief Executive Officer',
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
        first_name = 'Chief',
        last_name = 'Executive',
        department = 'Executive',
        job_title = 'Chief Executive Officer'
    RETURNING id INTO ceo_user_id;
    
    -- Assign CEO role
    INSERT INTO user_roles (user_id, role_id, assigned_at)
    VALUES (ceo_user_id, ceo_role_id, NOW())
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    RAISE NOTICE 'CEO user created/updated: ceo@company.com';
END $$;
