import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-opacity active:scale-95 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:   'bg-[var(--green)] text-white hover:opacity-90',
        secondary: 'bg-[var(--cream-dark)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--border)]',
        orange:    'bg-[var(--orange)] text-white hover:opacity-90',
        ghost:     'hover:bg-[var(--cream-dark)]',
      },
      size: {
        default: 'px-5 py-2.5',
        sm:      'px-3 py-1.5 text-xs',
        lg:      'px-7 py-3 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
