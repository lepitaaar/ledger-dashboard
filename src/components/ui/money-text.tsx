import type { HTMLAttributes } from "react";

import { cn, formatWon } from "@/lib/utils";

type MoneyTextProps = HTMLAttributes<HTMLSpanElement> & {
  value: number;
  suffix?: string;
  showSign?: boolean;
};

export function MoneyText({
  value,
  suffix = "원",
  showSign = false,
  className,
  ...props
}: MoneyTextProps): JSX.Element {
  const sign = showSign && value > 0 ? "+" : "";

  return (
    <span
      className={cn(
        "whitespace-nowrap tabular-nums",
        value < 0 && "text-red-600",
        className,
      )}
      {...props}
    >
      {sign}
      {formatWon(value)}
      {suffix ? ` ${suffix}` : ""}
    </span>
  );
}
