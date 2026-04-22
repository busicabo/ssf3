CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    key BYTEA NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

DELETE FROM public_keys old_key
WHERE EXISTS (
    SELECT 1
    FROM public_keys newer_key
    WHERE newer_key.user_id = old_key.user_id
      AND (
          newer_key.created_at > old_key.created_at
          OR (newer_key.created_at = old_key.created_at AND newer_key.id > old_key.id)
      )
);

CREATE UNIQUE INDEX IF NOT EXISTS public_keys_user_id_unique
    ON public_keys (user_id);


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
