import React from 'react';

interface BadgeProps {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({
  variant = 'secondary',
  children,
  className = '',
}) => {
  const baseClass = 'badge';
  const variantClass = `badge-${variant}`;
  
  const classes = [baseClass, variantClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes}>
      {children}
    </span>
  );
};

export default Badge;