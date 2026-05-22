import React from 'react';

type SkeletonProps = {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  'aria-label'?: string;
};

const ROUNDED: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  sm: 'rounded-md',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  full: 'rounded-full',
};

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  rounded = 'md',
  'aria-label': ariaLabel = 'Loading',
}) => (
  <div
    role="status"
    aria-label={ariaLabel}
    aria-busy="true"
    style={{ width, height }}
    className={`bg-gray-200 motion-safe:animate-pulse ${ROUNDED[rounded]} ${className}`}
  />
);

export default Skeleton;
