import type { Metadata } from 'next';

import '@/app/globals.css';

export const metadata: Metadata = {
  title: '장부/거래/정산 관리자',
  description: 'KST 고정 장부 및 정산서 발행 대시보드'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>): JSX.Element {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
