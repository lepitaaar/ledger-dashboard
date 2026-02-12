'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const menuItems: Array<{ href: string; label: string }> = [
  { href: '/dashboard/products', label: '상품관리' },
  { href: '/dashboard/vendors', label: '거래처 관리' },
  { href: '/dashboard/transactions', label: '거래 조회' },
  { href: '/dashboard/settlements', label: '계산서' }
];

export function Sidebar(): JSX.Element {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <div className="space-y-2 rounded-lg border border-border bg-white p-3 shadow-sm">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href.split('#')[0]);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block rounded-md border px-4 py-3.5 text-base font-semibold transition-colors',
                isActive
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-white text-slate-700 hover:border-primary hover:text-primary'
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
