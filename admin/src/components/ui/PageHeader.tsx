import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h2 className="text-xl font-extrabold leading-tight"
          style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          {action}
        </div>
      )}
    </div>
  );
}
