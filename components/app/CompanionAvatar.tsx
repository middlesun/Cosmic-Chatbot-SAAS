import React, { useEffect, useState } from 'react';
import type { CompanionMonogramPalette } from './chatTypes';

export type CompanionAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface CompanionAvatarProps {
  name: string;
  avatarUrl?: string | null;
  palette?: CompanionMonogramPalette | null;
  size?: CompanionAvatarSize;
  shape?: 'circle' | 'rounded';
  ring?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<CompanionAvatarSize, string> = {
  xs: 'w-7 h-7 text-[11px]',
  sm: 'w-9 h-9 text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-20 h-20 text-2xl',
};

const DEFAULT_PALETTE: CompanionMonogramPalette = {
  bg: '#EAE3D7',
  ring: '#B8965A',
  ink: '#3D3830',
};

function getInitials(name: string): string {
  const parts = (name || 'C').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'C';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

const CompanionAvatar: React.FC<CompanionAvatarProps> = ({
  name,
  avatarUrl,
  palette,
  size = 'md',
  shape = 'circle',
  ring = true,
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);

  const activePalette = palette || DEFAULT_PALETTE;
  const radiusClass = shape === 'rounded' ? 'rounded-2xl' : 'rounded-full';
  const showImage = Boolean(avatarUrl && avatarUrl.trim()) && !imgFailed;
  const initials = getInitials(name);

  return (
    <div
      className={`relative shrink-0 overflow-hidden select-none flex items-center justify-center ${SIZE_CLASSES[size]} ${radiusClass} ${className}`}
      style={{
        backgroundColor: activePalette.bg,
        color: activePalette.ink,
        boxShadow: ring ? `inset 0 0 0 1px ${activePalette.ring}40` : undefined,
      }}
      aria-label={name}
    >
      {showImage ? (
        <img
          src={avatarUrl!.trim()}
          alt={`${name} portrait`}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover object-top"
        />
      ) : (
        <span
          className="font-['Cormorant_Garamond',serif] font-semibold tracking-wide leading-none"
          aria-hidden="true"
        >
          {initials}
        </span>
      )}
    </div>
  );
};

export default CompanionAvatar;
