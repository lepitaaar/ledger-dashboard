import Link from "next/link";

import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): JSX.Element {
  return (
    <div className="min-h-screen bg-[#eceef2]">
      <header className="sticky top-0 z-40 border-b border-blue-900 bg-primary text-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 lg:px-6">
          <div className="flex items-center">
            <Link
              href="/dashboard/transactions"
              className="text-2xl font-bold tracking-tight"
            >
              장부 관리
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] gap-6 p-4 lg:p-6">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
