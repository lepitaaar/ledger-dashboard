import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state-panel";

export default function NotFound(): JSX.Element {
  return (
    <EmptyState
      title="페이지를 찾을 수 없습니다."
      description="주소가 변경되었거나 존재하지 않는 페이지입니다."
      action={
        <Button asChild>
          <Link href="/dashboard">대시보드로 이동</Link>
        </Button>
      }
    />
  );
}
