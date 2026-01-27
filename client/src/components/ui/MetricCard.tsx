import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-primary',
  trend,
}) => {
  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-medium text-text-secondary">{label}</p>
        {Icon && (
          <div className={iconColor}>
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-text-primary font-mono mb-2">{value}</p>
      {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
      {trend && (
        <div className="mt-4 pt-4 border-t border-border">
          <span
            className={`text-sm font-medium ${
              trend.isPositive ? 'text-success' : 'text-error'
            }`}
          >
            {trend.isPositive ? '+' : ''}
            {trend.value}%
          </span>
          <span className="text-sm text-text-muted ml-2">vs mes anterior</span>
        </div>
      )}
    </div>
  );
};
