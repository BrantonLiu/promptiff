import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Wordiff · Agent 比对画布',
  description: '选择对话中的 prompt 与 AI 产出，逐句检查表达、遗漏和语义距离。',
};

export default function CanvasPage() {
  return (
    <iframe
      title="Wordiff Agent 比对画布"
      src="/canvas/index.html"
      style={{ width: '100%', height: '100dvh', border: 0, display: 'block' }}
    />
  );
}
