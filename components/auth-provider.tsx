'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient, safeReturnPath } from '@/lib/supabase-browser';

type AuthState = {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    void getSupabaseBrowserClient().then(async (client) => {
      if (!alive || !client) return;
      setConfigured(true);
      const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
        if (alive) setSession(nextSession);
      });
      unsubscribe = () => listener.subscription.unsubscribe();
      const { data, error: sessionError } = await client.auth.getSession();
      if (alive) {
        setSession(data.session);
        if (sessionError) setError('登录状态读取失败，请重新登录。');
      }
    }).catch(() => { if (alive) setError('登录服务暂时不可用，请稍后重试。'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; unsubscribe?.(); };
  }, []);

  async function signIn() {
    setLoading(true);
    setError(null);
    try {
      const client = await getSupabaseBrowserClient();
      if (!client) throw new Error('Google 登录尚未配置。');
      const returnPath = safeReturnPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
      sessionStorage.setItem('wordiff.auth.returnTo', returnPath);
      const { error: authError } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: 'select_account' } },
      });
      if (authError) throw authError;
    } catch {
      setError('无法开始 Google 登录，请稍后重试。');
      setLoading(false);
    }
  }

  async function signOut() {
    setLoading(true);
    setError(null);
    try {
      const client = await getSupabaseBrowserClient();
      const result = await client?.auth.signOut({ scope: 'local' });
      if (result?.error) throw result.error;
      setSession(null);
    } catch {
      setError('退出失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }

  return <AuthContext.Provider value={{ session, loading, configured, error, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used within AuthProvider');
  return auth;
}
