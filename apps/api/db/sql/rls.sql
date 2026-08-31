-- Aktifkan Row-Level Security + policy isolasi company pada SETIAP tabel yang
-- punya kolom company_id. Otomatis mengikuti skema (tabel baru tinggal jalankan ulang).
--
-- PENTING: dipakai nullif(current_setting('app.company_id', true), '') karena
-- setelah set_config(..., true) selesai (commit), GUC kembali menjadi STRING KOSONG
-- (bukan NULL) pada koneksi pool yang sama — tanpa nullif, cast ''::uuid meledak.
--
-- PENGECUALIAN (policy longgar saat TANPA konteks): users, roles, devices,
-- listings, commodities. Alasan: login cukup email+password (cari user lintas
-- company), IoT ingest mencari perangkat via api_key, dan Pasar WUTUH (etalase
-- publik) membaca lapak aktif + nama komoditas lintas usaha. Saat konteks company
-- SUDAH terpasang, isolasi tetap berlaku penuh.
DO $$
DECLARE
  t text;
  loose boolean;
  ctx text := 'nullif(current_setting(''app.company_id'', true), '''')';
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'company_id'
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    -- 'cycles' longgar hanya untuk pencarian trace_code publik (halaman /lacak);
    -- endpoint hanya mengekspos data lewat kode acak, lalu membaca detail via UoW ber-RLS.
    loose := t IN ('users', 'roles', 'devices', 'listings', 'commodities', 'listing_photos', 'cycles');
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS company_isolation ON public.%I;', t);
    IF loose THEN
      EXECUTE format(
        'CREATE POLICY company_isolation ON public.%I '
        || 'USING (%s IS NULL OR company_id = (%s)::uuid) '
        || 'WITH CHECK (%s IS NULL OR company_id = (%s)::uuid);',
        t, ctx, ctx, ctx, ctx
      );
    ELSE
      -- %s IS NULL → company_id = NULL::uuid → selalu false → nol baris (aman).
      EXECUTE format(
        'CREATE POLICY company_isolation ON public.%I '
        || 'USING (company_id = (%s)::uuid) '
        || 'WITH CHECK (company_id = (%s)::uuid);',
        t, ctx, ctx
      );
    END IF;
    RAISE NOTICE 'RLS aktif: % (loose=%)', t, loose;
  END LOOP;
END$$;
