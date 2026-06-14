import React from 'react';
import { cx } from './cx';

export function Textarea({
  className,
  invalid,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }): React.ReactElement {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || props['aria-invalid'] || undefined}
      className={cx('db-textarea', invalid && 'db-textarea--invalid', className)}
    />
  );
}
