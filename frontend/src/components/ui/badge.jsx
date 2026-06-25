import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-block px-2.5 py-0.5 rounded-full text-xs font-medium',
  {
    variants: {
      variant: {
        green:  'bg-emerald-100 text-emerald-800',
        orange: 'bg-amber-100 text-amber-800',
        red:    'bg-red-100 text-red-800',
        gray:   'bg-gray-100 text-gray-600',
      },
    },
    defaultVariants: { variant: 'gray' },
  }
);

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
