"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/state-panel";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="화면을 표시하지 못했습니다."
      description="일시적인 오류가 발생했습니다. 다시 시도해 주세요."
      action={
        <Button type="button" onClick={reset}>
          다시 시도
        </Button>
      }
    />
  );
}
