'use client';

interface ChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ title, description, children, className = '' }: ChartCardProps) {
  return (
    <div className={`rounded-lg border border-neutral-200 bg-white p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-neutral-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}
