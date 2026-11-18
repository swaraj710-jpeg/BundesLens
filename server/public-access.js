// This dataset is public. If no elevated deployment credential is supplied,
// use the public key with the existing resilient Supabase client. This does
// not elevate privileges: Postgres row-level security remains in force.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
