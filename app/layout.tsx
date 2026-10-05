import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Backbeat · 个人排练台',
  description: '离线使用的乐队排练工具：调音、节拍、曲目与录音。',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://backbeat-rehearsal.wiry-elf-5574.chatgpt.site'),
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Backbeat' },
  openGraph: {
    title: 'Backbeat · 个人排练台',
    description: '调音、节拍、曲目与录音，全都留在你的设备上。',
    type: 'website',
    images: [{ url: '/og.png', width: 1680, height: 945, alt: 'Backbeat 个人排练台' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Backbeat · 个人排练台',
    description: '调音、节拍、曲目与录音，全都留在你的设备上。',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#171713',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
