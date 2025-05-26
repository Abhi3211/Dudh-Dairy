
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 md:mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="mt-4 sm:mt-0">{action}</div>}
      </div>
    </div>
  );
}
