import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import clsx from 'clsx';

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={clsx('w-full text-sm', className)} {...props} />;
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={clsx('table-header', className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={clsx('table-row', className)} {...props} />;
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={clsx('px-4 py-3 text-left font-medium', className)} {...props} />;
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={clsx('px-4 py-3', className)} {...props} />;
}
