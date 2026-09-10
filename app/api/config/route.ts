import { getServerEnv, isPublicSupabaseKey, isValidSupabaseUrl } from '@/lib/server-env';

export async function GET() {
  const env = await getServerEnv();
  const configured = isValidSupabaseUrl(env.supabaseUrl) && isPublicSupabaseKey(env.supabaseAnonKey);
  return Response.json(configured
    ? { configured: true, supabaseUrl: env.supabaseUrl, supabaseAnonKey: env.supabaseAnonKey }
    : { configured: false },
  { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
