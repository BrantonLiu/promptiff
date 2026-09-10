'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let clientPromise: Promise<SupabaseClient | null> | undefined;

export function getSupabaseBrowserClient(): Promise<SupabaseClient | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  clientPromise ??= fetch('/api/config', { credentials: 'same-origin', cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error('登录服务暂时不可用，请稍后重试。');
      const config = await response.json() as { configured?: boolean; supabaseUrl?: unknown; supabaseAnonKey?: unknown };
      if (!config.configured) return null;
      if (typeof config.supabaseUrl !== 'string' || typeof config.supabaseAnonKey !== 'string') {
        throw new Error('登录服务配置有误。');
      }
      return createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
      });
    })
    .catch((error) => { clientPromise = undefined; throw error; });
  return clientPromise;
}

/** Optional identity for feedback. A missing login never prevents sending feedback. */
export async function getAccessToken(): Promise<string | null> {
  const client = await getSupabaseBrowserClient();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session?.access_token ?? null;
}

export function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin && !url.pathname.startsWith('/auth/')
      ? `${url.pathname}${url.search}${url.hash}` : '/';
  } catch {
    return '/';
  }
}
