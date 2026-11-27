-- Bind fallback SIWS to the exact server-issued message, including its origin.
-- Old challenges remain unusable because no new request can match a null message.
alter table public.auth_challenges add column if not exists message text;
