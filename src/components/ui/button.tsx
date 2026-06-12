import type { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type Variant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type Size = 'default' | 'sm' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClass: Record<Variant, string> = {
  default: 'btn-primary',
  secondary: 'btn-secondary',
  outline: 'btn-secondary border border-border',
  ghost: 'hover:bg-secondary-bg dark:hover:bg-dark-card px-3 py-2 rounded-lg',
  destructive: 'bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-xl',
};

const sizeClass: Record<Size, string> = {
  default: '',
  sm: 'text-sm px-3 py-1.5',
  lg: 'text-base px-6 py-3',
  icon: 'p-2',
};

export function Button({
  className,
  variant = 'default',
  size = 'default',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(variantClass[variant], sizeClass[size], className)}
      {...props}
    />
  );
}
