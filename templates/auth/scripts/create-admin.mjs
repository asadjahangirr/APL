import { createClient } from '@supabase/supabase-js';
const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: key, ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
if (!url || !key || !email || !password || password.length < 16) throw new Error('Set owner Supabase credentials, ADMIN_EMAIL, and a unique ADMIN_PASSWORD of at least 16 characters in .env.local.');
const db = createClient(url, key, { auth: { persistSession: false } });
const result = await db.auth.admin.createUser({ email, password, email_confirm: true });
if (result.error || !result.data.user) throw new Error('Could not create administrator. Check configuration or whether this email already exists.');
const grant = await db.from('site_admins').insert({ user_id: result.data.user.id });
if (grant.error) { await db.auth.admin.deleteUser(result.data.user.id); throw new Error('Admin role could not be assigned; migrations must be applied first.'); }
console.log('Administrator created. Remove ADMIN_EMAIL and ADMIN_PASSWORD from .env.local.');

