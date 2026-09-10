import { AuthProvider } from '@/components/auth-provider';
import { getServerEnv } from '@/lib/server-env';
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

const baseMetadata: Metadata = {
  title: '版本比对器',
  description: '核对原文与 AI 改写的增删改，支持审阅、类 Git Diff、切词和按句语义比对。当前提供内置样本演示。',
  openGraph: { images: ['/og.png'], title: '版本比对器', description: '逐字核对增删改，也可按行、按词或按句比对 AI 改写。' },
  twitter: { images: ['/og.png'], card: 'summary_large_image', title: '版本比对器', description: '逐字核对增删改，也可按行、按词或按句比对 AI 改写。' },
};

export async function generateMetadata(): Promise<Metadata> {
  const {siteUrl}=await getServerEnv();
  try {
    const url=new URL(siteUrl);
    if(!['http:','https:'].includes(url.protocol))return baseMetadata;
    return {...baseMetadata,metadataBase:url};
  } catch {return baseMetadata;}
}

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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
