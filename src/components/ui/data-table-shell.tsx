import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DataTableShellProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  toolbar?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function DataTableShell({
  children,
  title,
  description,
  toolbar,
  footer,
  className,
}: DataTableShellProps): JSX.Element {
  const hasHeader = title || description || toolbar;

  return (
    <Card className={cn("overflow-hidden", className)}>
      {hasHeader ? (
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title ? (
              <h2 className="text-lg font-bold text-slate-950">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm font-medium text-slate-600">{description}</p>
            ) : null}
          </div>
          {toolbar ? <div className="flex items-center gap-2">{toolbar}</div> : null}
        </div>
      ) : null}
      {children}
      {footer ? (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
          {footer}
        </div>
      ) : null}
    </Card>
  );
}
