"use client";

import {
  Boxes,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  FileText,
  HandCoins,
  LayoutDashboard,
  PackageSearch,
  ReceiptText,
  RefreshCcw,
  ShoppingBasket,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const navigationGroups: NavigationGroup[] = [
  {
    label: "홈",
    items: [{ href: "/dashboard", label: "대시보드", icon: LayoutDashboard }],
  },
  {
    label: "매출 관리",
    items: [
      { href: "/dashboard/transactions", label: "거래 조회", icon: ReceiptText },
      { href: "/dashboard/settlements", label: "계산서", icon: FileText },
      { href: "/dashboard/vendors", label: "거래처 관리", icon: Users },
    ],
  },
  {
    label: "상품 및 재고",
    items: [
      { href: "/dashboard/products", label: "상품 관리", icon: ShoppingBasket },
      { href: "/dashboard/inventory", label: "재고 현황", icon: Boxes },
    ],
  },
  {
    label: "매입 연동",
    items: [
      { href: "/dashboard/auction-purchases", label: "경매 매입", icon: HandCoins },
      { href: "/dashboard/product-mappings", label: "품목 매칭", icon: RefreshCcw },
    ],
  },
  {
    label: "분석",
    items: [
      { href: "/dashboard/profit-loss", label: "손익 분석", icon: ChartNoAxesCombined },
    ],
  },
];

export function getNavigationTitle(pathname: string): string {
  const items = navigationGroups.flatMap((group) => group.items);
  const matched = items
    .filter((item) =>
      item.href === "/dashboard"
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];

  if (pathname.startsWith("/dashboard/settlements/manage")) {
    return "계산서 상세 관리";
  }

  if (pathname.startsWith("/dashboard/vendors/")) {
    return "거래처 상세";
  }

  return matched?.label ?? "장부 관리";
}

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavigationContentProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
};

function NavigationContent({
  collapsed = false,
  onNavigate,
}: NavigationContentProps): JSX.Element {
  const pathname = usePathname();

  return (
    <nav aria-label="주요 메뉴" className="space-y-6">
      {navigationGroups.map((group) => (
        <div key={group.label}>
          {!collapsed ? (
            <p className="mb-2 px-3 text-xs font-bold tracking-wide text-slate-600">
              {group.label}
            </p>
          ) : null}
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = isItemActive(pathname, item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex min-h-12 items-center rounded-lg text-base font-semibold transition-colors",
                    collapsed ? "justify-center px-2" : "gap-3 px-3",
                    active
                      ? "bg-blue-50 text-primary"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      active ? "text-primary" : "text-slate-400 group-hover:text-slate-600",
                    )}
                  />
                  {!collapsed ? <span>{item.label}</span> : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function DesktopSidebar(): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r border-slate-200 bg-white transition-[width] duration-200 lg:flex lg:flex-col",
        collapsed ? "w-[84px]" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-slate-100",
          collapsed ? "justify-center px-3" : "gap-3 px-5",
        )}
      >
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-3"
          aria-label="장부 관리 홈"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
            <PackageSearch className="h-5 w-5" />
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-base font-bold text-slate-950">
                장부 관리
              </span>
              <span className="block truncate text-xs font-medium text-slate-500">
                매출·재고 통합 업무
              </span>
            </span>
          ) : null}
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <NavigationContent collapsed={collapsed} />
      </div>

      <div className="border-t border-slate-100 p-3">
        <Button
          type="button"
          variant="ghost"
          size={collapsed ? "icon-sm" : "sm"}
          className={cn("text-slate-500", !collapsed && "w-full justify-start")}
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              메뉴 접기
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}

type MobileNavigationProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MobileNavigation({
  open,
  onOpenChange,
}: MobileNavigationProps): JSX.Element | null {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]"
        onClick={() => onOpenChange(false)}
        aria-label="메뉴 닫기"
      />
      <aside className="absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col bg-white shadow-2xl">
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-3"
            onClick={() => onOpenChange(false)}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
              <PackageSearch className="h-5 w-5" />
            </span>
            <span className="font-bold text-slate-950">장부 관리</span>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
            aria-label="메뉴 닫기"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <NavigationContent onNavigate={() => onOpenChange(false)} />
        </div>
      </aside>
    </div>
  );
}

export function Sidebar(): JSX.Element {
  return <DesktopSidebar />;
}
