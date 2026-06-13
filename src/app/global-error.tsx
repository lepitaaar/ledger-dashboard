"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  return (
    <html lang="ko">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">애플리케이션 오류</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              화면을 복구하지 못했습니다. 잠시 후 다시 시도해 주세요.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-5 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              다시 시도
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
