import React from 'react';
import { cx } from './cx';

export function EmptyState({
  title,
  description,
  action,
  className,
  ...props
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div {...props} className={cx('db-empty-state', className)}>
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
      {action}
    </div>
  );
}
