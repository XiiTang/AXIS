import React from 'react';
import { cx } from './cx';

export function Toolbar({
  ariaLabel,
  orientation = 'horizontal',
  density = 'compact',
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  ariaLabel: string;
  orientation?: 'horizontal' | 'vertical';
  density?: 'compact' | 'normal';
}): React.ReactElement {
  return (
    <div
      {...props}
      role="toolbar"
      aria-label={ariaLabel}
      className={cx('db-toolbar', `db-toolbar--${orientation}`, `db-toolbar--${density}`, className)}
    />
  );
}
