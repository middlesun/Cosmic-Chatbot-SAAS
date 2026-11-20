import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FloatingScrollControlsProps {
  /** Extra right/bottom Tailwind positioning override if needed */
  className?: string;
  /** Optional internal scroll container (falls back to window when container isn't overflowing) */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

const FloatingScrollControls: React.FC<FloatingScrollControlsProps> = ({
  className = 'bottom-5 right-5 md:bottom-7 md:right-7',
  scrollContainerRef,
}) => {
  const [isScrollable, setIsScrollable] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const holdTimerRef = useRef<number | null>(null);
  const holdRafRef = useRef<number | null>(null);
  const didHoldRef = useRef(false);

  const getActiveContainer = useCallback((): HTMLElement | null => {
    const el = scrollContainerRef?.current ?? null;
    if (el && el.scrollHeight > el.clientHeight + 40) {
      return el;
    }
    return null;
  }, [scrollContainerRef]);

  const updateScrollState = useCallback(() => {
    const container = getActiveContainer();
    if (container) {
      const scrollHeight = container.scrollHeight;
      const viewportHeight = container.clientHeight;
      const scrollY = container.scrollTop;
      const overflow = scrollHeight > viewportHeight + 120;
      setIsScrollable(overflow);
      setCanScrollUp(scrollY > 40);
      setCanScrollDown(scrollY + viewportHeight < scrollHeight - 40);
      return;
    }

    const docEl = document.documentElement;
    const scrollHeight = Math.max(docEl.scrollHeight, document.body.scrollHeight);
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY || docEl.scrollTop || 0;

    const overflow = scrollHeight > viewportHeight + 120;
    setIsScrollable(overflow);
    setCanScrollUp(scrollY > 40);
    setCanScrollDown(scrollY + viewportHeight < scrollHeight - 40);
  }, [getActiveContainer]);

  useEffect(() => {
    updateScrollState();
    const container = scrollContainerRef?.current ?? null;
    window.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState, { passive: true });
    container?.addEventListener('scroll', updateScrollState, { passive: true });

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updateScrollState())
        : null;
    if (observer) {
      observer.observe(document.body);
      if (container) {
        observer.observe(container);
        if (container.firstElementChild) {
          observer.observe(container.firstElementChild);
        }
      }
    }

    return () => {
      window.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
      container?.removeEventListener('scroll', updateScrollState);
      observer?.disconnect();
    };
  }, [scrollContainerRef, updateScrollState]);

  const stopHoldScroll = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdRafRef.current !== null) {
      window.cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
  }, []);

  useEffect(() => stopHoldScroll, [stopHoldScroll]);

  const startHoldScroll = (direction: 'up' | 'down') => {
    stopHoldScroll();
    didHoldRef.current = false;

    holdTimerRef.current = window.setTimeout(() => {
      didHoldRef.current = true;
      const step = () => {
        const container = getActiveContainer();
        const delta = direction === 'up' ? -14 : 14;
        if (container) {
          container.scrollBy({ top: delta });
        } else {
          window.scrollBy({ top: delta });
        }
        updateScrollState();
        holdRafRef.current = window.requestAnimationFrame(step);
      };
      holdRafRef.current = window.requestAnimationFrame(step);
    }, 180);
  };

  const handleTap = (direction: 'up' | 'down') => {
    const wasHold = didHoldRef.current;
    stopHoldScroll();
    didHoldRef.current = false;
    if (wasHold) return;

    const container = getActiveContainer();
    if (container) {
      container.scrollTo({
        top: direction === 'up' ? 0 : container.scrollHeight,
        behavior: 'smooth',
      });
      return;
    }

    const targetTop =
      direction === 'up'
        ? 0
        : Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);

    window.scrollTo({
      top: targetTop,
      behavior: 'smooth',
    });
  };

  if (!isScrollable || (!canScrollUp && !canScrollDown)) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label="Page scroll controls"
      className={`fixed z-30 ${className}`}
    >
      <div className="flex flex-col rounded-2xl bg-[#FDFBF7]/90 backdrop-blur-md border border-[#3D3830]/15 shadow-[0_10px_28px_-10px_rgba(61,56,48,0.22)] overflow-hidden">
        <button
          type="button"
          disabled={!canScrollUp}
          onPointerDown={() => startHoldScroll('up')}
          onPointerUp={() => handleTap('up')}
          onPointerLeave={stopHoldScroll}
          onPointerCancel={stopHoldScroll}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleTap('up');
            }
          }}
          aria-label="Scroll to top"
          className="h-9 w-9 md:h-10 md:w-10 flex items-center justify-center text-[#3D3830] hover:bg-[#EAE3D7]/80 active:bg-[#EAE3D7] disabled:opacity-30 disabled:pointer-events-none transition-colors duration-200 cursor-pointer"
        >
          <ChevronUp className="h-4 w-4 stroke-[1.8]" />
        </button>

        <div className="h-px bg-[#3D3830]/10" />

        <button
          type="button"
          disabled={!canScrollDown}
          onPointerDown={() => startHoldScroll('down')}
          onPointerUp={() => handleTap('down')}
          onPointerLeave={stopHoldScroll}
          onPointerCancel={stopHoldScroll}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleTap('down');
            }
          }}
          aria-label="Scroll to bottom"
          className="h-9 w-9 md:h-10 md:w-10 flex items-center justify-center text-[#3D3830] hover:bg-[#EAE3D7]/80 active:bg-[#EAE3D7] disabled:opacity-30 disabled:pointer-events-none transition-colors duration-200 cursor-pointer"
        >
          <ChevronDown className="h-4 w-4 stroke-[1.8]" />
        </button>
      </div>
    </div>
  );
};

export default FloatingScrollControls;
