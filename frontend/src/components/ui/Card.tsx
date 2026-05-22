import React from 'react';

/* ── Variant styles ── */
const VARIANT_STYLES: Record<CardProps['variant'], string> = {
  default: 'bg-surface border border-cwc-border rounded-cwc-lg',
  elevated: 'bg-surface shadow-cwc-md rounded-cwc-lg border border-cwc-border',
  outlined: 'bg-transparent border-2 border-cwc-border rounded-cwc-lg',
  filled: 'bg-surface-muted rounded-cwc-lg',
};

/* ── Padding styles ── */
const PADDING_STYLES: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-8',
};

/* ── Card ── */
type CardProps = {
  variant?: 'default' | 'elevated' | 'outlined' | 'filled';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  className?: string;
  children?: React.ReactNode;
};

const Card: React.FC<CardProps> & {
  Header: React.FC<CardHeaderProps>;
  Body: React.FC<CardBodyProps>;
  Footer: React.FC<CardFooterProps>;
} = ({
  variant = 'default',
  padding = 'none',
  hoverable = false,
  className = '',
  children,
}) => {
  const classes = [
    VARIANT_STYLES[variant],
    PADDING_STYLES[padding],
    hoverable ? 'transition-shadow hover:shadow-cwc-md cursor-pointer' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classes}>{children}</div>;
};

/* ── Card.Header ── */
type CardHeaderProps = {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};

const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  action,
  className = '',
  children,
}) => (
  <div className={`flex items-center justify-between ${className}`.trimEnd()}>
    {title && <h3 className="text-lg font-semibold text-text-primary">{title}</h3>}
    {children && !title && children}
    {action && <div>{action}</div>}
  </div>
);

/* ── Card.Body ── */
type CardBodyProps = {
  className?: string;
  children?: React.ReactNode;
};

const CardBody: React.FC<CardBodyProps> = ({ className = '', children }) => (
  <div className={className}>{children}</div>
);

/* ── Card.Footer ── */
type CardFooterProps = {
  className?: string;
  children?: React.ReactNode;
};

const CardFooter: React.FC<CardFooterProps> = ({ className = '', children }) => (
  <div
    className={`flex items-center justify-end gap-2 border-t border-cwc-border ${className}`.trimEnd()}
  >
    {children}
  </div>
);

/* ── Attach subcomponents as static properties ── */
Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export { Card };
export default Card;