import React from 'react';
import { Card } from '../ui';

export function NotificationStack({ notifications }: { notifications: string[] }): React.ReactElement | null {
  if (notifications.length === 0) {
    return null;
  }
  return (
    <div className="notifications">
      {notifications.map((notification) => (
        <Card key={notification}>{notification}</Card>
      ))}
    </div>
  );
}
