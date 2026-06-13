import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { HTMLAttributes } from 'react';

const variants = {
  info: { bg: 'bg-brand-50 border-brand-200 text-brand-800', icon: Info },
  success: { bg: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: CheckCircle2 },
  warning: { bg: 'bg-amber-50 border-amber-200 text-amber-800', icon: AlertCircle },
  error: { bg: 'bg-red-50 border-red-200 text-red-800', icon: XCircle },
};

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof variants;
  title?: string;
}

export function Alert({ className, variant = 'info', title, children, ...props }: AlertProps) {
  const { bg, icon: Icon } = variants[variant];

  return (
    <div
      className={cn('flex gap-3 p-4 rounded-xl border', bg, className)}
      {...props}
    >
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div>
        {title && <p className="font-medium">{title}</p>}
        {children && <p className={cn('text-sm', title && 'mt-1 opacity-90')}>{children}</p>}
      </div>
    </div>
  );
}
