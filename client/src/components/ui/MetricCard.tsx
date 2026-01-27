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
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted mb-1">{label}</p>
          <p className="text-2xl font-bold text-secondary-900 mb-1">{value}</p>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`rounded-lg p-3 ${iconColor} bg-primary-50`}>
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 pt-3 border-t border-border">
          <span
            className={`text-sm font-medium ${
              trend.isPositive ? 'text-success' : 'text-danger'
            }`}
          >
            {trend.isPositive ? '+' : ''}
            {trend.value}%
          </span>
          <span className="text-sm text-muted ml-2">vs mes anterior</span>
        </div>
      )}
    </div>
  );
};
