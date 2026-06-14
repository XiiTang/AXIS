import React from 'react';
import { cx } from './cx';

export type CardVariant = 'default' | 'interactive' | 'selected' | 'danger';

export function Card({
  variant = 'default',
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { variant?: CardVariant }): React.ReactElement {
  return <article {...props} className={cx('db-card', `db-card--${variant}`, className)} />;
}
