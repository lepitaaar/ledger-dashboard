import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: ReactNode;
  description?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
};

const toneClasses = {
  default: "bg-blue-50 text-primary",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
};

export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "default",
}: MetricCardProps): JSX.Element {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-base font-semibold text-slate-700">{label}</p>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 tabular-nums">
              {value}
            </div>
          </div>
          {Icon ? (
            <div className={cn("rounded-lg p-2.5", toneClasses[tone])}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
          ) : null}
        </div>
        {description ? (
          <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
