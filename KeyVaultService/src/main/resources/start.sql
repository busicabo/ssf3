CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    key BYTEA NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);


CREATE TABLE IF NOT EXISTS user_backup (
    backup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS send_new_key(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    key BYTEA NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    public_key UUID NOT NULL,
    encrypting_public_key UUID
);

ALTER TABLE send_new_key
    ADD COLUMN IF NOT EXISTS encrypting_public_key UUID;

UPDATE send_new_key
SET encrypting_public_key = public_key
WHERE encrypting_public_key IS NULL;

ALTER TABLE send_new_key
    ALTER COLUMN encrypting_public_key SET NOT NULL;
