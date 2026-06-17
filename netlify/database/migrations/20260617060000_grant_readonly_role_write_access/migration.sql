-- Grant the application's runtime database role read/write access.
--
-- The app reaches Postgres through the connection in NETLIFY_DB_URL, which
-- authenticates as the `netlifydb_readonly` role. The initial migration created
-- the tables as `netlifydb_owner` and only granted SELECT to the runtime role,
-- so every write — creating a deck, adding pages, uploading media — failed with
-- "permission denied for table ...". That is why a new deck could be listed but
-- never created.
--
-- This migration runs as the table owner, so it can grant the runtime role the
-- write privileges it needs on the existing tables, and sets default privileges
-- so any tables added by future migrations are writable too. Guarded so it is a
-- no-op if the role is ever absent, keeping deploys safe.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'netlifydb_readonly') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO netlifydb_readonly;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO netlifydb_readonly;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO netlifydb_readonly;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO netlifydb_readonly;
  END IF;
END $$;
