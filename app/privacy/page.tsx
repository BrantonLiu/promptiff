import Link from 'next/link';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';

export const metadata: Metadata = {
  title: '隐私说明 · 版本比对器',
  description: '了解版本比对器的可选登录、使用反馈与浏览器存储。',
};

const sectionStyle: CSSProperties = {
  marginTop: 28,
  paddingTop: 24,
  borderTop: '1px solid var(--border)',
};
const headingStyle: CSSProperties = { margin: '0 0 10px', fontSize: 18, fontWeight: 600 };
const paragraphStyle: CSSProperties = { margin: '0 0 12px' };
const linkStyle: CSSProperties = { color: 'var(--primary)', textDecoration: 'underline', textUnderlineOffset: 3 };

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '32px 18px 64px' }}>
      <Link href="/" style={{ ...linkStyle, display: 'inline-block', marginBottom: 24, fontSize: 14 }}>
        ← 返回版本比对器
      </Link>
      <article style={{ background: 'var(--card, #fff)', border: '1px solid var(--border)', borderRadius: 12, padding: 'clamp(22px, 5vw, 44px)', fontSize: 15, lineHeight: 1.9 }}>
        <p style={{ margin: '0 0 12px', color: 'var(--muted-foreground)', fontSize: 12 }}>更新于 2026 年 9 月 10 日</p>
        <h1 style={{ fontSize: 28, marginBottom: 16 }}>隐私说明</h1>
        <p style={paragraphStyle}>
          本说明适用于官方实例 <span style={{ overflowWrap: 'anywhere' }}>wordiff.zliu2934.workers.dev</span>。
          你可以直接浏览演示，Google 登录和使用反馈均为可选。自行部署的开源实例由各自部署者负责数据管理。
        </p>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>浏览文章与对比结果</h2>
          <p style={paragraphStyle}>
            当前演示使用预先整理的文章、改写版本和预计算的分析结果。切换审阅、类 Git Diff、切词和按句语义比对时，不会把文章实时发送给大模型重新分析。
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>可选的 Google 登录</h2>
          <p style={paragraphStyle}>
            选择登录后，Google 会根据你的授权向 Supabase 身份认证服务提供邮箱及基本账号资料，例如姓名和头像。
            Supabase 管理账号和登录会话，页面用这些资料展示登录状态；本应用不会获取你的 Google 密码。
          </p>
          <p style={paragraphStyle}>你可以退出登录，继续浏览演示，也可以不登录而提交反馈。</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>可选的使用反馈</h2>
          <p style={paragraphStyle}>
            在你体验四种视图、且页面在前台并获得焦点的累计停留时间超过 10 分钟后，页面会邀请你回答不超过三个问题。
            你可以关闭邀请。只有点击提交后，答案才会发送至后端并保存在 Supabase。
          </p>
          <p style={paragraphStyle}>
            提交内容包括评分、偏好的视图、你自愿填写的意见，以及用于判断体验进度和避免重复提交的浏览会话标识（sessionId）、已访问视图和有效停留时长。
            如果提交时已登录，还会关联经过验证的账号标识（userId）。反馈用于改进产品，不在演示页面公开展示。
          </p>
          <p style={paragraphStyle}>请勿在意见中填写密码、证件号码或其他不希望提供的个人信息。</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>浏览器存储与服务日志</h2>
          <p style={paragraphStyle}>
            页面使用浏览器的 sessionStorage 保存当前浏览会话的体验进度和计时信息，使用 localStorage 保存 Supabase 登录会话，以便刷新后继续使用。
            你可以通过浏览器设置清除本站数据；清除后可能需要重新登录，体验进度也可能重置。
          </p>
          <p style={paragraphStyle}>
            网站由 Cloudflare 提供托管，认证和反馈后端由 Supabase 提供，Google 负责 Google 账号授权。
            这些服务在提供网络访问、认证和安全防护时，可能处理 IP 地址、请求信息及技术日志。
          </p>
          <p style={paragraphStyle}>
            相关服务的隐私说明：{' '}
            <a href="https://www.cloudflare.com/privacypolicy/" style={linkStyle}>Cloudflare</a>、{' '}
            <a href="https://supabase.com/privacy" style={linkStyle}>Supabase</a>、{' '}
            <a href="https://policies.google.com/privacy" style={linkStyle}>Google</a>。
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>联系与删除请求</h2>
          <p style={paragraphStyle}>
            如果你希望了解、纠正或删除官方实例中的账号或反馈数据，请联系部署者：{' '}
            <a href="mailto:zliu2934@gmail.com" style={linkStyle}>zliu2934@gmail.com</a>。
            为定位记录，可提供登录邮箱、反馈的大致提交时间或反馈内容；无需发送密码。
            对于匿名反馈，部署者可能需要你补充能定位该条记录的信息。
          </p>
        </section>
      </article>
    </main>
  );
}
