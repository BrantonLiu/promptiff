/** Server-only runtime bindings. Never import this module from a client component. */
export async function getServerEnv() {
  let bindings: Record<string, unknown> = {};
  try {
    const { env } = await import('cloudflare:workers');
    bindings = env as unknown as Record<string, unknown>;
  } catch {
    // Unit tests and Node-based local tools do not expose Cloudflare bindings.
  }
  const read = (key: string) => {
    const value = bindings[key] ?? (typeof process !== 'undefined' ? process.env[key] : undefined);
    return typeof value === 'string' ? value.trim() : '';
  };
  return {
    supabaseUrl: read('SUPABASE_URL'),
    supabaseAnonKey: read('SUPABASE_ANON_KEY'),
    supabaseServiceRoleKey: read('SUPABASE_SERVICE_ROLE_KEY'),
    siteUrl: read('SITE_URL'),
  };
}

export function isPublicSupabaseKey(key: string) {
  if (key.startsWith('sb_publishable_')) return true;
  if (!key || key.startsWith('sb_secret_')) return false;
  try {
    const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).role === 'anon';
  } catch {
    return false;
  }
}

export function isValidSupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return !url.username && !url.password &&
      (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)));
  } catch {
    return false;
  }
}
