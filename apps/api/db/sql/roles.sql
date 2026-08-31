-- Role aplikasi (RLS AKTIF). Jalankan dengan koneksi ADMIN (superuser 'postgres').
-- Role 'wutuh' = app connection di DATABASE_URL (non-superuser → FORCE RLS berlaku).
-- Password harus cocok dengan DATABASE_URL di .env.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'wutuh') THEN
    CREATE ROLE wutuh LOGIN PASSWORD 'wutuh';
  END IF;
END$$;

GRANT USAGE ON SCHEMA public TO wutuh;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO wutuh;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO wutuh;

-- Berlaku juga untuk tabel/sequence yang dibuat kemudian.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wutuh;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO wutuh;
