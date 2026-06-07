"use client";

import { CalendarDays, Menu, Plus, Type } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  DesktopSidebar,
  MobileNavigation,
  getNavigationTitle,
} from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";

type AppShellProps = {
  children: React.ReactNode;
};

function getTodayLabel(): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());
}

export function AppShell({ children }: AppShellProps): JSX.Element {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const title = getNavigationTitle(pathname);

  useEffect(() => {
    const savedPreference = window.localStorage.getItem("ledger-font-size");
    const shouldUseLargeText = savedPreference === "large";
    setLargeText(shouldUseLargeText);
    document.documentElement.dataset.fontSize = shouldUseLargeText
      ? "large"
      : "normal";
  }, []);

  const toggleTextSize = (): void => {
    const nextValue = !largeText;
    setLargeText(nextValue);
    document.documentElement.dataset.fontSize = nextValue ? "large" : "normal";
    window.localStorage.setItem(
      "ledger-font-size",
      nextValue ? "large" : "normal",
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      <a href="#main-content" className="skip-link">
        본문으로 바로가기
      </a>
      <DesktopSidebar />
      <MobileNavigation open={mobileOpen} onOpenChange={setMobileOpen} />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 items-center gap-2 px-4 py-2 sm:gap-3 sm:px-6 lg:px-8">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="메뉴 열기"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-slate-900">{title}</p>
            </div>

            <div className="hidden items-center gap-2 text-sm font-medium text-slate-600 md:flex">
              <CalendarDays className="h-4 w-4" />
              <span>{getTodayLabel()}</span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={largeText}
              aria-label={largeText ? "글자를 기본 크기로 보기" : "글자를 크게 보기"}
              onClick={toggleTextSize}
            >
              <Type className="h-4 w-4" />
              <span className="hidden xl:inline">
                {largeText ? "기본 글자" : "글자 크게"}
              </span>
              <span className="xl:hidden">글자</span>
            </Button>

            <Button asChild size="sm">
              <Link
                href="/dashboard/settlements/manage"
                aria-label="새 거래 등록"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">거래 등록</span>
              </Link>
            </Button>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 lg:p-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
