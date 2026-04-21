'use client';

interface ChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ title, description, children, className = '' }: ChartCardProps) {
  return (
    <div className={`rounded-lg border border-rule-soft bg-paper-alt p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-ink-3">{description}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}
