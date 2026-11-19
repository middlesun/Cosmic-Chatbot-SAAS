import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

export interface TooltipProps {
  content?: string | null;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  delayMs?: number;
  className?: string;
  children: React.ReactNode;
}

interface TooltipPosition {
  top: number;
  left: number;
  resolvedPlacement: 'top' | 'bottom' | 'left' | 'right';
  arrowOffset: number;
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  placement = 'top',
  delayMs = 180,
  className = '',
  children,
}) => {
  const tooltipId = useId();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const openTimerRef = useRef<number | null>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [pos, setPos] = useState<TooltipPosition | null>(null);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const hideTooltip = useCallback(() => {
    clearOpenTimer();
    setIsVisible(false);
  }, [clearOpenTimer]);

  const scheduleOpen = useCallback(() => {
    if (!content?.trim()) return;
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      !window.matchMedia('(hover: hover)').matches
    ) {
      return;
    }
    clearOpenTimer();
    openTimerRef.current = window.setTimeout(() => {
      setIsVisible(true);
    }, delayMs);
  }, [clearOpenTimer, content, delayMs]);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const bubble = bubbleRef.current;
    if (!anchor || !bubble) return;

    const aRect = anchor.getBoundingClientRect();
    const bRect = bubble.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 10;
    const gap = 8;

    let resolved = placement;
    if (placement === 'top' && aRect.top - bRect.height - gap < margin) {
      resolved = 'bottom';
    } else if (placement === 'bottom' && aRect.bottom + bRect.height + gap > vh - margin) {
      resolved = 'top';
    } else if (placement === 'left' && aRect.left - bRect.width - gap < margin) {
      resolved = 'right';
    } else if (placement === 'right' && aRect.right + bRect.width + gap > vw - margin) {
      resolved = 'left';
    }

    let top = 0;
    let left = 0;
    let arrowOffset = 0;

    if (resolved === 'top' || resolved === 'bottom') {
      const centerX = aRect.left + aRect.width / 2;
      left = centerX - bRect.width / 2;
      left = Math.max(margin, Math.min(vw - margin - bRect.width, left));
      top =
        resolved === 'top'
          ? aRect.top - bRect.height - gap
          : aRect.bottom + gap;
      top = Math.max(margin, Math.min(vh - margin - bRect.height, top));
      arrowOffset = Math.max(12, Math.min(bRect.width - 12, centerX - left));
    } else {
      const centerY = aRect.top + aRect.height / 2;
      top = centerY - bRect.height / 2;
      top = Math.max(margin, Math.min(vh - margin - bRect.height, top));
      left =
        resolved === 'left'
          ? aRect.left - bRect.width - gap
          : aRect.right + gap;
      left = Math.max(margin, Math.min(vw - margin - bRect.width, left));
      arrowOffset = Math.max(10, Math.min(bRect.height - 10, centerY - top));
    }

    setPos({ top, left, resolvedPlacement: resolved, arrowOffset });
  }, [placement]);

  useLayoutEffect(() => {
    if (!isVisible) {
      setPos(null);
      return;
    }
    updatePosition();
  }, [isVisible, content, updatePosition]);

  useEffect(() => {
    if (!isVisible) return;

    const handleScrollOrResize = () => hideTooltip();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideTooltip();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hideTooltip, isVisible]);

  useEffect(() => {
    return () => clearOpenTimer();
  }, [clearOpenTimer]);

  if (!content?.trim()) {
    return <>{children}</>;
  }

  const arrowClasses =
    pos?.resolvedPlacement === 'top'
      ? 'bottom-[-4px] border-r border-b'
      : pos?.resolvedPlacement === 'bottom'
      ? 'top-[-4px] border-l border-t'
      : pos?.resolvedPlacement === 'left'
      ? 'right-[-4px] border-t border-r'
      : 'left-[-4px] border-b border-l';

  const arrowStyle: React.CSSProperties =
    pos?.resolvedPlacement === 'top' || pos?.resolvedPlacement === 'bottom'
      ? { left: `${pos.arrowOffset - 4}px` }
      : { top: `${(pos?.arrowOffset ?? 12) - 4}px` };

  const portalBubble =
    isVisible && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={bubbleRef}
            id={tooltipId}
            role="tooltip"
            style={{
              position: 'fixed',
              top: pos ? `${pos.top}px` : '-9999px',
              left: pos ? `${pos.left}px` : '-9999px',
              zIndex: 320,
              visibility: pos ? 'visible' : 'hidden',
            }}
            className={`pointer-events-none select-none max-w-[240px] rounded-xl border border-[#B8965A]/30 bg-[#1F2229] px-2.5 py-1.5 text-center font-['Plus_Jakarta_Sans',sans-serif] text-[11px] font-medium leading-snug text-[#F4EFE6] shadow-[0_12px_28px_-8px_rgba(31,34,41,0.5)] ${
              pos?.resolvedPlacement === 'bottom'
                ? 'animate-cc-dropdown-down'
                : 'animate-cc-dropdown-up'
            }`}
          >
            <span className="relative z-10 block">{content}</span>
            {pos && (
              <span
                aria-hidden="true"
                style={arrowStyle}
                className={`absolute h-2 w-2 rotate-45 bg-[#1F2229] border-[#B8965A]/30 ${arrowClasses}`}
              />
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <span
        ref={anchorRef}
        aria-describedby={isVisible ? tooltipId : undefined}
        onMouseEnter={scheduleOpen}
        onMouseLeave={hideTooltip}
        onFocus={scheduleOpen}
        onBlur={hideTooltip}
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse') {
            hideTooltip();
          }
        }}
        className={`inline-flex ${className}`}
      >
        {children}
      </span>
      {portalBubble}
    </>
  );
};

export default Tooltip;
