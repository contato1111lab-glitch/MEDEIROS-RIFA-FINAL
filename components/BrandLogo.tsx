import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface BrandLogoProps {
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = '' }) => {
  const { brandPrimary, brandSecondary } = useTheme();

  return (
    <span className={className}>
      <span className="text-brand-primary font-bold">{brandPrimary}</span>
      {brandSecondary && (
        <span className="ml-2 font-bold text-white">{brandSecondary}</span>
      )}
    </span>
  );
};
