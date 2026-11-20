import React from 'react';
import type { AstrologyMode } from './AuthContext';

interface AstrologyModeToggleProps {
  value: AstrologyMode;
  onChange: (mode: AstrologyMode) => void;
  variant?: 'light' | 'dark';
  size?: 'xs' | 'sm';
  className?: string;
}

const AstrologyModeToggle: React.FC<AstrologyModeToggleProps> = ({
  value,
  onChange,
  variant = 'light',
  size = 'sm',
  className = '',
}) => {
  const isDark = variant === 'dark';
  const containerClasses = isDark
    ? 'bg-[#1F2229]/85 border border-[#F4EFE6]/15'
    : 'bg-[#EAE3D7]/80 border border-[#3D3830]/12';

  const padClasses = size === 'xs' ? 'p-0.5 text-[11px]' : 'p-1 text-xs';
  const btnPadClasses = size === 'xs' ? 'px-2.5 py-1' : 'px-3 py-1.5';

  return (
    <div
      role="group"
      aria-label="Astrology system"
      className={`inline-flex items-center rounded-xl ${containerClasses} ${padClasses} ${className}`}
    >
      {(
        [
          { id: 'vedic', label: 'Vedic' },
          { id: 'western', label: 'Western' },
        ] as const
      ).map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={`rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${btnPadClasses} ${
              active
                ? isDark
                  ? 'bg-[#F4EFE6] text-[#1F2229] shadow-xs'
                  : 'bg-[#4A453D] text-[#FAF7F2] shadow-xs'
                : isDark
                ? 'text-[#F4EFE6]/70 hover:text-[#F4EFE6]'
                : 'text-[#5C5449] hover:text-[#3D3830]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default AstrologyModeToggle;
