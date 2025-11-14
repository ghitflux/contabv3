-- Create test users for testing
INSERT INTO users (id, name, email, password_hash, role, is_active, is_verified, created_at, updated_at)
VALUES
(
  gen_random_uuid(),
  'Admin Test',
  'admin@test.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YmMxSUxby46m',
  'ADMIN'::user_role,
  true,
  true,
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  'Staff Test',
  'staff@test.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YmMxSUxby46m',
  'FUNC'::user_role,
  true,
  true,
  NOW(),
  NOW()
);

-- Verify
SELECT name, email, role FROM users;
