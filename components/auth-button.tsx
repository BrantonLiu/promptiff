'use client';

import { useAuth } from '@/components/auth-provider';

export function AuthButton() {
  const { session, configured, loading, error, signIn, signOut } = useAuth();
  const fullName = session?.user.user_metadata?.full_name;
  return <div className="auth-controls">
    {session ? <>
      <span className="auth-identity" title={session.user.email}>{(typeof fullName === 'string' && fullName) || session.user.email || '已登录'}</span>
      <button className="auth-button" onClick={() => void signOut()} disabled={loading}>退出登录</button>
    </> : <button className="auth-button" onClick={() => void signIn()} disabled={loading || !configured}
      title={!loading && !configured ? 'Google 登录尚未配置，仍可浏览和提交反馈' : '使用 Google 账号登录'}>
      {loading ? '正在连接…' : 'Google 登录'}
    </button>}
    {error && <span className="auth-error" role="alert">{error}</span>}
  </div>;
}
