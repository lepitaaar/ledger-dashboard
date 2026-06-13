import { AlertCircle, Inbox } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type StatePanelProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({
  title,
  description,
  action,
}: StatePanelProps): JSX.Element {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="rounded-full bg-slate-100 p-3 text-slate-500">
        <Inbox className="h-5 w-5" />
      </div>
      <p className="mt-3 text-base font-bold text-slate-900">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
  action,
}: StatePanelProps & { onRetry?: () => void }): JSX.Element {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="rounded-full bg-red-50 p-3 text-red-600">
        <AlertCircle className="h-5 w-5" />
      </div>
      <p className="mt-3 text-base font-bold text-slate-900">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
      {!action && onRetry ? (
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          다시 시도
        </Button>
      ) : null}
    </div>
  );
}
