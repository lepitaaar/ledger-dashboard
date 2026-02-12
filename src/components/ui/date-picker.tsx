"use client";

import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateTime, Info } from "luxon";

import { cn } from "@/lib/utils";

const KST_ZONE = "Asia/Seoul";
const WEEKDAYS = Info.weekdays("short", { locale: "ko" });

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
};

type CalendarDay = {
  date: DateTime;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  key: string;
};

function buildCalendarDays(
  year: number,
  month: number,
  selectedIso: string,
): CalendarDay[] {
  const today = DateTime.now().setZone(KST_ZONE);
  const todayIso = today.toFormat("yyyy-MM-dd");

  const firstOfMonth = DateTime.fromObject(
    { year, month, day: 1 },
    { zone: KST_ZONE },
  );
  const startWeekday = firstOfMonth.weekday;

  const startDate = firstOfMonth.minus({
    days: startWeekday === 7 ? 0 : startWeekday,
  });

  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const date = startDate.plus({ days: i });
    const iso = date.toFormat("yyyy-MM-dd");
    days.push({
      date,
      day: date.day,
      isCurrentMonth: date.month === month && date.year === year,
      isToday: iso === todayIso,
      isSelected: iso === selectedIso,
      key: iso,
    });
  }

  return days;
}

function formatDisplay(value: string): string {
  if (!value) {
    return "";
  }

  const parsed = DateTime.fromISO(value, { zone: KST_ZONE });
  if (!parsed.isValid) {
    return value;
  }

  return parsed.toFormat("yyyy. MM. dd");
}

export function DatePicker({
  value,
  onChange,
  className,
  id,
  placeholder = "날짜 선택",
}: DatePickerProps): JSX.Element {
  const [open, setOpen] = useState(false);

  const initialDate = value
    ? DateTime.fromISO(value, { zone: KST_ZONE })
    : DateTime.now().setZone(KST_ZONE);
  const [viewYear, setViewYear] = useState(initialDate.year);
  const [viewMonth, setViewMonth] = useState(initialDate.month);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent): void => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (value) {
      const parsed = DateTime.fromISO(value, { zone: KST_ZONE });
      if (parsed.isValid) {
        setViewYear(parsed.year);
        setViewMonth(parsed.month);
      }
    }
  }, [value]);

  const days = useMemo(
    () => buildCalendarDays(viewYear, viewMonth, value),
    [viewYear, viewMonth, value],
  );

  const monthLabel = useMemo(() => {
    return DateTime.fromObject(
      { year: viewYear, month: viewMonth },
      { zone: KST_ZONE },
    ).toFormat("yyyy년 M월");
  }, [viewYear, viewMonth]);

  const navigateMonth = useCallback(
    (delta: number) => {
      const current = DateTime.fromObject(
        { year: viewYear, month: viewMonth },
        { zone: KST_ZONE },
      );
      const next = current.plus({ months: delta });
      setViewYear(next.year);
      setViewMonth(next.month);
    },
    [viewYear, viewMonth],
  );

  const selectDate = useCallback(
    (day: CalendarDay) => {
      onChange(day.key);
      setOpen(false);
    },
    [onChange],
  );

  const goToToday = useCallback(() => {
    const today = DateTime.now().setZone(KST_ZONE);
    setViewYear(today.year);
    setViewMonth(today.month);
    onChange(today.toFormat("yyyy-MM-dd"));
    setOpen(false);
  }, [onChange]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-md border border-border bg-white px-4 py-2 text-base text-slate-800 shadow-sm",
          "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          "transition-colors",
          !value && "text-slate-400",
        )}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{value ? formatDisplay(value) : placeholder}</span>
        <Calendar className="h-4 w-4 text-slate-400" />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 w-[340px] rounded-lg border border-slate-200 bg-white p-3 shadow-xl animate-in fade-in-0 zoom-in-95">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              onClick={() => navigateMonth(-1)}
              aria-label="이전 달"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-base font-semibold text-slate-800">
              {monthLabel}
            </span>
            <button
              type="button"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              onClick={() => navigateMonth(1)}
              aria-label="다음 달"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-1.5 text-sm font-medium text-slate-400"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 text-center">
            {days.map((day) => (
              <button
                key={day.key}
                type="button"
                className={cn(
                  "mx-auto flex h-9 w-9 items-center justify-center rounded-md text-base transition-colors",
                  day.isCurrentMonth ? "text-slate-700" : "text-slate-300",
                  day.isToday && !day.isSelected && "font-bold text-primary",
                  day.isSelected &&
                    "bg-primary text-white font-semibold shadow-sm",
                  !day.isSelected && day.isCurrentMonth && "hover:bg-slate-100",
                  !day.isSelected && !day.isCurrentMonth && "hover:bg-slate-50",
                )}
                onClick={() => selectDate(day)}
              >
                {day.day}
              </button>
            ))}
          </div>

          <div className="mt-2 flex justify-center border-t border-slate-100 pt-2">
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-primary hover:bg-blue-50 transition-colors"
              onClick={goToToday}
            >
              오늘
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
