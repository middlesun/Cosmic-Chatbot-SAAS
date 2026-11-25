import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { CompanionCarouselItem, ConversationLine } from './landingData';

interface EditorialRevealProps {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'left' | 'right';
  className?: string;
}

export const EditorialReveal: React.FC<EditorialRevealProps> = ({
  children,
  delay = 0,
  direction = 'up',
  className = '',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  });

  useEffect(() => {
    if (visible) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -56px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  const hiddenTransform =
    direction === 'left'
      ? '-translate-x-8 opacity-0'
      : direction === 'right'
      ? 'translate-x-8 opacity-0'
      : 'translate-y-10 scale-[0.985] opacity-0';

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`transition-[transform,opacity] duration-[850ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100 ${
        visible ? 'translate-x-0 translate-y-0 scale-100 opacity-100' : hiddenTransform
      } ${className}`}
    >
      {children}
    </div>
  );
};

interface EditorialImageProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallbackLabel?: string;
  warmGrade?: boolean;
  priority?: boolean;
}

export const EditorialImage: React.FC<EditorialImageProps> = ({
  src,
  alt,
  className = '',
  imgClassName = '',
  fallbackLabel,
  warmGrade = true,
  priority = false,
}) => {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`relative overflow-hidden bg-[#EAE3D7] ${className}`}>
      {!failed ? (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover ${
            warmGrade ? 'saturate-[0.88] sepia-[0.07] contrast-[0.98]' : ''
          } ${imgClassName}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#EFE8DB] via-[#EAE3D7] to-[#DFD6C7] p-6 text-center">
          <span className="font-['Cormorant_Garamond',serif] text-lg font-medium text-[#5C5449]">
            {fallbackLabel || alt}
          </span>
        </div>
      )}
    </div>
  );
};

interface ParallaxFrameProps {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}

export const ParallaxFrame: React.FC<ParallaxFrameProps> = ({
  children,
  className = '',
  strength = 18,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let rafId = 0;

    const update = () => {
      rafId = 0;
      const el = containerRef.current;
      const inner = innerRef.current;
      if (!el || !inner) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      if (rect.bottom < -120 || rect.top > vh + 120) return;
      const progress = (rect.top + rect.height / 2 - vh / 2) / (vh + rect.height);
      const offset = Math.max(-strength, Math.min(strength, -progress * strength));
      inner.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0) scale(1.04)`;
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [strength]);

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      <div
        ref={innerRef}
        className="h-full w-full transition-transform duration-150 ease-out will-change-transform motion-reduce:transform-none"
      >
        {children}
      </div>
    </div>
  );
};

interface DialogueShowcaseProps {
  companion: {
    name: string;
    role: string;
    avatarUrl: string;
  };
  lines: ConversationLine[];
  footnote?: string;
  userBubbleClassName?: string;
  companionBubbleClassName?: string;
  surfaceClassName?: string;
}

export const DialogueShowcase: React.FC<DialogueShowcaseProps> = ({
  companion,
  lines,
  footnote,
  userBubbleClassName = 'bg-[#E9E2D6] text-[#3D3830]',
  companionBubbleClassName = 'bg-[#F8F5EF] text-[#3D3830] border border-[#3D3830]/10',
  surfaceClassName = 'bg-[#FDFBF7]',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

  const [revealedCount, setRevealedCount] = useState<number>(
    reducedMotion ? lines.length : 1
  );
  const [hasTriggered, setHasTriggered] = useState<boolean>(reducedMotion);

  useEffect(() => {
    if (reducedMotion || hasTriggered) return;
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setHasTriggered(true);
      setRevealedCount(lines.length);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setHasTriggered(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasTriggered, lines.length, reducedMotion]);

  useEffect(() => {
    if (!hasTriggered || reducedMotion) return;
    if (revealedCount >= lines.length) return;
    const timer = window.setTimeout(() => {
      setRevealedCount((prev) => Math.min(lines.length, prev + 1));
    }, 620);
    return () => window.clearTimeout(timer);
  }, [hasTriggered, revealedCount, lines.length, reducedMotion]);

  const handleReplay = () => {
    if (reducedMotion) return;
    setRevealedCount(1);
    setHasTriggered(true);
  };

  return (
    <div
      ref={containerRef}
      className={`rounded-3xl border border-[#3D3830]/10 p-5 sm:p-7 ${surfaceClassName}`}
    >
      {/* Companion header */}
      <div className="flex items-center justify-between gap-3 pb-5 border-b border-[#3D3830]/10">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-12 w-12 rounded-2xl overflow-hidden shrink-0 border border-[#3D3830]/10">
            <EditorialImage
              src={companion.avatarUrl}
              alt={`${companion.name} — ${companion.role}`}
              className="h-full w-full"
              imgClassName="object-top"
              fallbackLabel={companion.name.slice(0, 2)}
            />
          </div>
          <div className="min-w-0">
            <p className="font-['Cormorant_Garamond',serif] text-xl font-semibold text-[#3D3830] leading-tight truncate">
              {companion.name}
            </p>
            <p className="text-xs text-[#6B6256] truncate">{companion.role}</p>
          </div>
        </div>

        {!reducedMotion && (
          <button
            type="button"
            onClick={handleReplay}
            aria-label={`Replay ${companion.name} conversation`}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[#6B6256] hover:text-[#3D3830] hover:bg-[#3D3830]/5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Replay</span>
          </button>
        )}
      </div>

      {/* Progressive message stack */}
      <div className="py-5 space-y-3.5">
        {lines.map((line, index) => {
          const isVisible = index < revealedCount;
          const isUser = line.sender === 'user';
          return (
            <div
              key={`${companion.name}-${index}`}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'} transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:transform-none ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
            >
              <p
                className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm sm:text-[15px] leading-relaxed ${
                  isUser ? `${userBubbleClassName} rounded-br-md` : `${companionBubbleClassName} rounded-bl-md`
                }`}
              >
                {line.text}
              </p>
            </div>
          );
        })}
      </div>

      {footnote?.trim() && (
        <p className="pt-2 text-xs text-[#8B8275]">{footnote}</p>
      )}
    </div>
  );
};

interface CompanionCarouselProps {
  title: string;
  items: CompanionCarouselItem[];
  caption?: string;
}

export const CompanionCarousel: React.FC<CompanionCarouselProps> = ({
  title,
  items,
  caption,
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollByCards = (direction: 'prev' | 'next') => {
    const node = scrollerRef.current;
    if (!node) return;
    const distance = Math.max(260, Math.round(node.clientWidth * 0.72));
    node.scrollBy({
      left: direction === 'next' ? distance : -distance,
      behavior: 'smooth',
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <h3 className="font-['Cormorant_Garamond',serif] text-2xl sm:text-3xl font-medium text-[#3D3830] tracking-tight">
          {title}
        </h3>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => scrollByCards('prev')}
            aria-label={`Scroll ${title} left`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#3D3830]/15 bg-[#FDFBF7]/90 text-[#3D3830] hover:bg-[#EAE3D7] transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByCards('next')}
            aria-label={`Scroll ${title} right`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#3D3830]/15 bg-[#FDFBF7]/90 text-[#3D3830] hover:bg-[#EAE3D7] transition-colors cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory no-scrollbar"
      >
        {items.map((item) => (
          <figure
            key={`${item.name}-${item.role}`}
            className="w-[172px] sm:w-[200px] lg:w-[216px] shrink-0 snap-start space-y-2.5 group"
          >
            <div className="aspect-[3/4] w-full rounded-2xl overflow-hidden border border-[#3D3830]/10">
              <EditorialImage
                src={item.imageUrl}
                alt={item.alt}
                className="h-full w-full"
                imgClassName={`${item.imgClassName || 'object-top'} transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]`}
                fallbackLabel={item.name}
              />
            </div>
            <figcaption className="px-0.5">
              <p className="text-sm font-semibold text-[#3D3830] leading-snug">
                {item.name}
              </p>
              <p className="text-xs text-[#6B6256] leading-snug">{item.role}</p>
            </figcaption>
          </figure>
        ))}
      </div>

      {caption && (
        <p className="max-w-2xl text-sm sm:text-base text-[#5C5449] leading-relaxed pt-1">
          {caption}
        </p>
      )}
    </div>
  );
};
