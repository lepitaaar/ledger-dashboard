import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FilterBarProps = {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function FilterBar({
  children,
  footer,
  className,
}: FilterBarProps): JSX.Element {
  return (
    <Card className={className}>
      <CardContent className="space-y-5 p-4 sm:p-5">
        {children}
        {footer ? (
          <div className="border-t border-slate-100 pt-4">{footer}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

type ActiveFilterChipsProps = {
  children: ReactNode;
  className?: string;
};

export function ActiveFilterChips({
  children,
  className,
}: ActiveFilterChipsProps): JSX.Element {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-sm font-semibold text-slate-700">적용 조건</span>
      {children}
    </div>
  );
}

type FilterChipProps = {
  label: string;
  onRemove?: () => void;
};

export function FilterChip({
  label,
  onRemove,
}: FilterChipProps): JSX.Element {
  return (
    <span className="inline-flex min-h-8 items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-900">
      {label}
      {onRemove ? (
        <button
          type="button"
          className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full text-lg text-blue-700 hover:bg-blue-100 hover:text-blue-950"
          onClick={onRemove}
          aria-label={`${label} 조건 제거`}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}
