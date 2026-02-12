import * as React from 'react';

import { cn } from '@/lib/utils';

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>): JSX.Element {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom text-base', className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  return <thead className={cn('bg-slate-50', className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableFooter({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  return <tfoot className={cn('bg-slate-100 font-medium', className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>): JSX.Element {
  return <tr className={cn('border-b border-slate-200 hover:bg-slate-50', className)} {...props} />;
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>): JSX.Element {
  return <th className={cn('h-12 px-4 text-left align-middle font-semibold text-slate-700', className)} {...props} />;
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>): JSX.Element {
  return <td className={cn('p-4 align-middle text-slate-700', className)} {...props} />;
}
