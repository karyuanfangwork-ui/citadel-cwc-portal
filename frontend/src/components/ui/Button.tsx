import React from 'react';

// ─── Variant styles ──────────────────────────────────────────────────────
const variantStyles: Record<string, string> = {
  primary:
    'bg-brand-700 text-white hover:bg-brand-600 active:bg-brand-900 focus-visible:ring-brand-500/20',
  secondary:
    'bg-white text-brand-700 border border-cwc-border hover:bg-brand-50 active:bg-brand-100 focus-visible:ring-brand-500/20',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500/20',
  ghost:
    'bg-transparent text-text-secondary hover:bg-surface-muted active:bg-surface-subtle focus-visible:ring-brand-500/20',
};

// ─── Size styles ─────────────────────────────────────────────────────────
const sizeStyles: Record<string, string> = {
  sm: 'text-sm px-3 py-1.5 gap-1.5',
  md: 'text-base px-4 py-2.5 gap-2',
  lg: 'text-lg px-6 py-3 gap-2.5',
};

const iconSizeStyles: Record<string, string> = {
  sm: 'text-[16px]',
  md: 'text-[18px]',
  lg: 'text-[20px]',
};

// ─── Types ───────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';
type IconPosition = 'left' | 'right';

export type ButtonProps = {
  /** Visual variant */
  variant?: ButtonVariant;
  /** Size preset */
  size?: ButtonSize;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Shows a spinning progress icon and disables interaction */
  loading?: boolean;
  /** Material Symbols Outlined icon name, e.g. 'add', 'delete' */
  icon?: string;
  /** Position of the icon relative to children */
  iconPosition?: IconPosition;
  /** Stretch to full container width */
  fullWidth?: boolean;
  /** HTML button type */
  type?: 'button' | 'submit' | 'reset';
  /** Additional CSS classes */
  className?: string;
  /** Button content (label text, etc.) */
  children?: React.ReactNode;
  /** Click handler */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

// ─── Component ───────────────────────────────────────────────────────────
const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  type = 'button',
  className = '',
  children,
  onClick,
}) => {
  const isDisabled = disabled || loading;

  const iconEl = (iconName: string, extraClass = '') => (
    <span
      className={`material-symbols-outlined ${iconSizeStyles[size]} ${extraClass}`}
      aria-hidden="true"
    >
      {iconName}
    </span>
  );

  return (
    <button
      type={type as 'button' | 'submit' | 'reset'}
      disabled={isDisabled}
      onClick={onClick}
      className={[
        'inline-flex items-center justify-center font-sans font-semibold',
        'rounded-cwc-md select-none transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth ? 'w-full' : '',
        isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading && iconEl('progress_activity', 'animate-spin')}
      {!loading && icon && iconPosition === 'left' && iconEl(icon)}
      {children}
      {!loading && icon && iconPosition === 'right' && iconEl(icon)}
    </button>
  );
};

Button.displayName = 'Button';

export default Button;
export { Button };