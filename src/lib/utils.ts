import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value);
}

export function formatWon(value: number): string {
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 0
  }).format(Math.round(value));
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function safeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
