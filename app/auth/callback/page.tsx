/* oxlint-disable next/no-html-link-for-pages -- Native navigation avoids the reproduced vinext production Link crash. */
'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient, safeReturnPath } from '@/lib/supabase-browser';

export default function AuthCallback() {
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      // Remove the short-lived authorization code from the address bar/history.
      window.history.replaceState(null, '', '/auth/callback');
      if (params.get('error') || !code) throw new Error('登录未完成或已取消。请返回页面重新尝试。');
      const client = await getSupabaseBrowserClient();
      if (!client) throw new Error('Google 登录尚未配置。');
      const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
      if (exchangeError) throw new Error('登录链接已失效，请在发起登录的浏览器中重新尝试。');
      const returnTo = safeReturnPath(sessionStorage.getItem('wordiff.auth.returnTo'));
      sessionStorage.removeItem('wordiff.auth.returnTo');
      window.location.replace(returnTo);
    })().catch((reason) => setError(reason instanceof Error ? reason.message : '登录失败，请重新尝试。'));
  }, []);
  return <main className="auth-callback" style={{ maxWidth: 560, margin: '15vh auto', padding: 24 }}>
    <h1>版本比对器</h1>
    <p role={error ? 'alert' : 'status'}>{error ?? '正在完成 Google 登录…'}</p>
    {error && <a href="/">返回版本比对器</a>}
  </main>;
}
