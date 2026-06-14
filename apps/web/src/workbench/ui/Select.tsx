import React from 'react';
import { cx } from './cx';

export function Select({
  className,
  children,
  invalid,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }): React.ReactElement {
  return (
    <select
      {...props}
      aria-invalid={invalid || props['aria-invalid'] || undefined}
      className={cx('db-select', invalid && 'db-select--invalid', className)}
    >
      {children}
    </select>
  );
}
