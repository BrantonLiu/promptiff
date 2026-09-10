import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '版本比对器',
  description: '用审阅、逐句 Diff、结巴分词与语义向量，对照一篇口述和三种 AI 改写。',
  openGraph: { images: ['/og.png'], title: '版本比对器', description: '同一篇口述，三种改写程度，四种观察方式。' },
  twitter: { images: ['/og.png'], card: 'summary_large_image', title: '版本比对器', description: '同一篇口述，三种改写程度，四种观察方式。' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
