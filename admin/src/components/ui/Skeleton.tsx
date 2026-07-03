import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'card' | 'bg' | 'text' | 'circular';
}

export default function Skeleton({ className = '', variant = 'bg', style, ...props }: SkeletonProps) {
  const bgColors = {
    card: 'var(--card)',
    bg: 'var(--bg)',
    text: 'var(--bg)',
    circular: 'var(--bg)'
  };

  const roundedClasses = {
    card: 'rounded-2xl',
    bg: 'rounded-xl',
    text: 'rounded',
    circular: 'rounded-full'
  };

  return (
    <div
      className={`animate-pulse ${roundedClasses[variant]} ${className}`}
      style={{
        background: bgColors[variant],
        ...style
      }}
      {...props}
    />
  );
}
