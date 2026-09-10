'use client';

import { useState, type SyntheticEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEngagement } from '@/hooks/use-engagement';
import { ENGAGEMENT_MODES, type EngagementMode } from '@/lib/engagement';

const labels: Record<EngagementMode, string> = {
  review: '审阅模式', diff: '类 Git Diff 比对模式', lexical: '切词比对模式', semantic: '按句语义比对模式',
};
export type FeedbackSurveyProps = {
  mode: EngagementMode;
  /** Defer while an existing modal or another flow has the user's attention. */
  blocked?: boolean;
  getAccessToken?: () => Promise<string | null>;
};

export function FeedbackSurvey({ mode, blocked = false, getAccessToken }: FeedbackSurveyProps) {
  const { engagement, finish } = useEngagement(mode);
  const [rating, setRating] = useState<number | null>(null);
  const [preferredMode, setPreferredMode] = useState<EngagementMode | ''>('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [thanks, setThanks] = useState(false);
  const open = engagement.eligible && !blocked;
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !rating || !preferredMode) return;
    setSubmitting(true);
    setError('');
    try {
      const accessToken = await getAccessToken?.();
      const response = await fetch('/api/feedback', {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ sessionId: engagement.sessionId, visitedModes: engagement.visitedModes,
          activeMs: engagement.activeMs, rating, preferredMode, comment: comment.trim() }),
      });
      if (!response.ok && response.status !== 409) throw new Error('反馈暂时没有发送成功，请稍后重试。');
      finish('submitted');
      setThanks(true);
    } catch {
      setError('反馈暂时没有发送成功，请稍后重试。你的填写内容已保留。');
    } finally { setSubmitting(false); }
  }
  return <>
    <Dialog open={open} onOpenChange={next => { if (!next && open && !submitting) finish('dismissed'); }}>
      <DialogContent className="feedback-dialog sm:max-w-lg" showCloseButton={!submitting}>
        <DialogHeader>
          <DialogTitle>使用反馈</DialogTitle>
          <DialogDescription>3 个问题，可匿名提交，也可以跳过。</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-5">
          <fieldset className="grid gap-2" disabled={submitting}>
            <legend className="mb-2 font-medium">1. 这些比对结果对你核对改写有多大帮助？</legend>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(value => <label key={value} className={`flex h-10 flex-1 cursor-pointer items-center justify-center rounded-lg border text-sm has-focus-visible:ring-2 ${rating === value ? 'border-sky-600 bg-sky-100 text-sky-900' : 'border-border'}`}>
                <input className="sr-only" type="radio" name="rating" required value={value} checked={rating === value} onChange={() => setRating(value)} aria-label={`${value} 分${value === 1 ? '，帮助很小' : value === 5 ? '，帮助很大' : ''}`} />
                {value}
              </label>)}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>帮助很小</span><span>帮助很大</span></div>
          </fieldset>
          <label className="grid gap-2 font-medium" htmlFor="feedback-preferred-mode">2. 哪种比对方式最有帮助？
            <select id="feedback-preferred-mode" value={preferredMode} onChange={event => setPreferredMode(event.target.value as EngagementMode)} required disabled={submitting} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal">
              <option value="" disabled>请选择一种比对方式</option>
              {ENGAGEMENT_MODES.map(value => <option key={value} value={value}>{labels[value]}</option>)}
            </select>
          </label>
          <label className="grid gap-2 font-medium" htmlFor="feedback-comment">3. 有什么不清楚，或者你希望改进的？（选填）
            <textarea id="feedback-comment" value={comment} onChange={event => setComment(event.target.value)} maxLength={2000} rows={3} disabled={submitting} placeholder="例如：色阶不好理解，或希望对比自己的文章……" className="w-full resize-y rounded-lg border border-border bg-background p-3 text-sm font-normal" />
          </label>
          <p className="text-xs text-muted-foreground">提交后将保存你的回答及本次使用过的比对方式和前台停留时长。请勿填写个人敏感信息。</p>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={submitting} onClick={() => finish('dismissed')}>暂时跳过</Button>
            <Button type="submit" disabled={submitting || !rating || !preferredMode}>{submitting ? '正在提交…' : '提交反馈'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    {thanks && <output className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm shadow-lg">反馈已收到，谢谢。<Button variant="ghost" size="sm" onClick={() => setThanks(false)}>关闭</Button></output>}
  </>;
}
