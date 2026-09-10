import { createClient } from '@supabase/supabase-js';
import { getServerEnv, isValidSupabaseUrl } from '@/lib/server-env';
import { isSameOriginRequest, readFeedbackJson, validateFeedback } from '@/lib/supabase-feedback-validation';

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
function failure(status: number, code: string, message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status, headers });
}

export async function POST(request: Request) {
  const env = await getServerEnv();
  if (!isSameOriginRequest(request, env.siteUrl)) return failure(403, 'INVALID_ORIGIN', '请从版本比对器页面提交反馈。');
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return failure(415, 'INVALID_CONTENT_TYPE', '反馈需要使用 JSON 格式提交。');
  }
  let parsed: unknown;
  try { parsed = await readFeedbackJson(request); }
  catch (error) {
    return error instanceof Error && error.message === 'BODY_TOO_LARGE'
      ? failure(413, 'BODY_TOO_LARGE', '反馈内容过长，请缩短后重试。')
      : failure(400, 'INVALID_JSON', '反馈格式有误，请重试。');
  }
  const feedback = validateFeedback(parsed);
  if (!feedback) return failure(400, 'INVALID_FEEDBACK', '请完成四种视图体验、有效停留超过 10 分钟，并检查反馈内容。');
  if (!isValidSupabaseUrl(env.supabaseUrl) || !env.supabaseServiceRoleKey) {
    return failure(503, 'NOT_CONFIGURED', '反馈服务尚未配置，请稍后重试。');
  }

  try {
    // Separate server client: never set a browser session on this elevated client.
    const admin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    let userId: string | null = null;
    const authorization = request.headers.get('authorization');
    if (authorization) {
      const bearer = /^Bearer ([^\s]+)$/i.exec(authorization);
      if (!bearer || bearer[1].length > 16_384) return failure(401, 'INVALID_SESSION', '登录状态已失效，请重新登录后重试。');
      const { data, error } = await admin.auth.getUser(bearer[1]);
      if (error || !data.user) return failure(401, 'INVALID_SESSION', '登录状态已失效，请重新登录后重试。');
      userId = data.user.id;
    }
    const { error } = await admin.from('feedback').insert({
      session_id: feedback.sessionId,
      user_id: userId,
      visited_modes: feedback.visitedModes,
      active_ms: feedback.activeMs,
      rating: feedback.rating,
      preferred_mode: feedback.preferredMode,
      comment: feedback.comment,
    });
    // One row per browser session; safe to retry after a connection failure.
    if (error?.code === '23505') return Response.json({ ok: true, duplicate: true }, { headers });
    if (error) return failure(502, 'SAVE_FAILED', '反馈暂时保存失败，请稍后重试。');
    return Response.json({ ok: true, duplicate: false }, { status: 201, headers });
  } catch {
    return failure(502, 'SERVICE_UNAVAILABLE', '反馈服务暂时无法连接，请稍后重试。');
  }
}
