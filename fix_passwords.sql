UPDATE users
SET password_hash = '$2b$12$V/C31Al3LPXwOC61xObG0u9rcnYhRn4rCbk50JCNhtZrTVyvr2jP2'
WHERE email IN ('admin@test.com', 'staff@test.com');

SELECT email, password_hash FROM users WHERE email IN ('admin@test.com', 'staff@test.com');
