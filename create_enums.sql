-- Create missing enum types
CREATE TYPE theme_mode AS ENUM ('light', 'dark', 'system');
CREATE TYPE language_code AS ENUM ('pt-br', 'en-us', 'es-es');
CREATE TYPE permission_category AS ENUM ('USERS', 'CLIENTS', 'FINANCE', 'OBLIGATIONS', 'LICENSES', 'REPORTS', 'SETTINGS', 'AUDIT');

SELECT typname FROM pg_type WHERE typname IN ('theme_mode', 'language_code', 'permission_category') ORDER BY typname;
