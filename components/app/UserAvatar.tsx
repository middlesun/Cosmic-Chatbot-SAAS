import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { getUserProfileDisplayLabel } from './chatUtilities';

export interface UserAvatarProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  size = 'sm',
  className = '',
}) => {
  const { authUser, appUser, isPreviewMode } = useAuth();
  const [imgError, setImgError] = useState(false);

  const meta = (authUser?.user_metadata || {}) as Record<string, unknown>;
  const avatarUrl =
    !isPreviewMode &&
    ((typeof meta.avatar_url === 'string' && meta.avatar_url.trim()) ||
      (typeof meta.picture === 'string' && meta.picture.trim()) ||
      null);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  const displayName =
    appUser?.full_name?.trim() ||
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    getUserProfileDisplayLabel(appUser, 'Cosmic Council');

  const initials = (() => {
    if (isPreviewMode) return 'P';
    const cleaned = displayName.trim();
    if (!cleaned) return 'C';
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && !cleaned.includes('@')) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return cleaned.slice(0, 1).toUpperCase();
  })();

  const showImage = Boolean(avatarUrl && !imgError);

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#8B7355]/35 bg-[#EAE3D7] text-[#3D3830] select-none ${SIZE_CLASSES[size]} ${className}`}
    >
      {showImage ? (
        <>
          <img
            src={avatarUrl as string}
            alt={displayName}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover sepia-[0.45] hue-rotate-[-8deg] saturate-[0.72] contrast-[0.98] brightness-[0.95]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[#5C4A38]/14 mix-blend-multiply"
          />
        </>
      ) : (
        <span className="font-serif font-semibold leading-none tracking-tight text-[#3D3830]">
          {initials}
        </span>
      )}
    </span>
  );
};

export default UserAvatar;
