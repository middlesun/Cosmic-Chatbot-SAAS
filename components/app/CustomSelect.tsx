import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  disabled?: boolean;
  variant?: 'light' | 'dark';
  surface?: 'canvas' | 'elevated';
  size?: 'xs' | 'sm' | 'md';
  placement?: 'auto' | 'top' | 'bottom';
  align?: 'left' | 'right';
  minMenuWidth?: number;
  icon?: React.ReactNode;
  className?: string;
  triggerClassName?: string;
}

interface MenuCoords {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  direction: 'up' | 'down';
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  ariaLabel,
  id,
  disabled = false,
  variant = 'light',
  surface = 'elevated',
  size = 'md',
  placement = 'auto',
  align = 'left',
  minMenuWidth = 0,
  icon,
  className = '',
  triggerClassName = '',
}) => {
  const generatedId = useId();
  const listboxId = `${id || generatedId}-listbox`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const typeAheadRef = useRef<{ buffer: string; timer: number | null }>({
    buffer: '',
    timer: null,
  });

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const computeCoords = useCallback((): MenuCoords | null => {
    const el = triggerRef.current;
    if (!el) return null;

    const rect = el.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const margin = 10;
    const gap = 6;

    const spaceBelow = viewportH - rect.bottom - margin - gap;
    const spaceAbove = rect.top - margin - gap;

    let direction: 'up' | 'down' = 'down';
    if (placement === 'top') {
      direction = spaceAbove >= 140 || spaceAbove >= spaceBelow ? 'up' : 'down';
    } else if (placement === 'bottom') {
      direction = spaceBelow >= 140 || spaceBelow >= spaceAbove ? 'down' : 'up';
    } else {
      direction = spaceBelow < 210 && spaceAbove > spaceBelow ? 'up' : 'down';
    }

    const availableVertical = direction === 'up' ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(140, Math.min(288, availableVertical));

    const width = Math.min(
      viewportW - margin * 2,
      Math.max(rect.width, minMenuWidth)
    );

    let left = align === 'right' ? rect.right - width : rect.left;
    if (left + width > viewportW - margin) {
      left = viewportW - margin - width;
    }
    if (left < margin) {
      left = margin;
    }

    const top = direction === 'up' ? rect.top - gap : rect.bottom + gap;

    return { top, left, width, maxHeight, direction };
  }, [align, minMenuWidth, placement]);

  const openMenu = useCallback(() => {
    if (disabled || options.length === 0) return;
    const nextCoords = computeCoords();
    if (!nextCoords) return;
    setCoords(nextCoords);
    const currentIdx = options.findIndex((o) => o.value === value && !o.disabled);
    setHighlightedIndex(currentIdx >= 0 ? currentIdx : options.findIndex((o) => !o.disabled));
    setIsOpen(true);
  }, [computeCoords, disabled, options, value]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const selectOption = useCallback(
    (opt: CustomSelectOption) => {
      if (opt.disabled) return;
      onChange(opt.value);
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [onChange]
  );

  // Sync coordinates on open, scroll, and resize; close on outside pointerdown
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleScrollOrResize = (e: Event) => {
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) {
        return;
      }
      const nextCoords = computeCoords();
      if (nextCoords) {
        setCoords(nextCoords);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [computeCoords, isOpen]);

  // Keep keyboard-highlighted option scrolled into view
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !menuRef.current) return;
    const items = menuRef.current.querySelectorAll<HTMLElement>('[data-select-option]');
    const targetItem = items[highlightedIndex];
    if (targetItem) {
      targetItem.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const moveHighlight = (delta: 1 | -1) => {
    if (options.length === 0) return;
    let next = highlightedIndex;
    for (let i = 0; i < options.length; i++) {
      next = (next + delta + options.length) % options.length;
      if (!options[next].disabled) {
        setHighlightedIndex(next);
        return;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        closeMenu();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        openMenu();
      } else {
        moveHighlight(1);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        openMenu();
      } else {
        moveHighlight(-1);
      }
      return;
    }

    if (e.key === 'Home' && isOpen) {
      e.preventDefault();
      const firstIdx = options.findIndex((o) => !o.disabled);
      if (firstIdx >= 0) setHighlightedIndex(firstIdx);
      return;
    }

    if (e.key === 'End' && isOpen) {
      e.preventDefault();
      for (let i = options.length - 1; i >= 0; i--) {
        if (!options[i].disabled) {
          setHighlightedIndex(i);
          break;
        }
      }
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isOpen) {
        openMenu();
      } else if (highlightedIndex >= 0 && options[highlightedIndex]) {
        selectOption(options[highlightedIndex]);
      }
      return;
    }

    if (e.key === 'Tab' && isOpen) {
      closeMenu();
      return;
    }

    // Type-ahead matching
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const store = typeAheadRef.current;
      store.buffer += e.key.toLowerCase();
      if (store.timer) window.clearTimeout(store.timer);
      store.timer = window.setTimeout(() => {
        store.buffer = '';
      }, 500);

      const matchIdx = options.findIndex(
        (opt) => !opt.disabled && opt.label.toLowerCase().startsWith(store.buffer)
      );
      if (matchIdx >= 0) {
        if (isOpen) {
          setHighlightedIndex(matchIdx);
        } else {
          onChange(options[matchIdx].value);
        }
      }
    }
  };

  const sizeStyles = {
    xs: 'rounded-xl px-2.5 py-1.5 text-[11px] gap-1.5',
    sm: 'rounded-xl px-3 py-2 text-xs gap-2',
    md: 'rounded-xl px-3.5 py-2.5 text-sm gap-2',
  }[size];

  const isDark = variant === 'dark';

  const triggerTheme = isDark
    ? `border text-[#F4EFE6] ${
        isOpen
          ? 'border-[#B8965A]/75 bg-[#1F2229] ring-2 ring-[#B8965A]/20'
          : 'border-white/15 bg-[#1F2229]/90 hover:border-[#B8965A]/45 hover:bg-[#292D36]'
      }`
    : `border text-[#3D3830] ${
        surface === 'canvas' ? 'bg-[#FAF7F2]' : 'bg-[#FDFBF7]'
      } ${
        isOpen
          ? 'border-[#3D3830]/45 ring-2 ring-[#B8965A]/20'
          : 'border-[#3D3830]/15 hover:border-[#3D3830]/35 hover:bg-[#F5EFE6]/75'
      }`;

  const chevronSize = size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  const menuPortal =
    isOpen && coords && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              position: 'fixed',
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 240,
              ...(coords.direction === 'up'
                ? { bottom: `${window.innerHeight - coords.top}px` }
                : { top: `${coords.top}px` }),
            }}
            className={`${
              coords.direction === 'up' ? 'animate-cc-dropdown-up' : 'animate-cc-dropdown-down'
            } rounded-2xl p-1.5 focus:outline-none ${
              isDark
                ? 'bg-[#1F2229] text-[#F4EFE6] border border-white/10 shadow-[0_20px_48px_-12px_rgba(0,0,0,0.68)]'
                : 'bg-[#FDFBF7] text-[#3D3830] border border-[#3D3830]/15 shadow-[0_18px_42px_-12px_rgba(61,56,48,0.22),0_4px_12px_-4px_rgba(61,56,48,0.08)]'
            }`}
          >
            <div
              style={{ maxHeight: `${coords.maxHeight}px` }}
              className={`overflow-y-auto overscroll-contain space-y-0.5 pr-0.5 ${
                isDark ? 'observatory-dark-scroll' : ''
              }`}
            >
              {options.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;

                const rowClasses = isDark
                  ? opt.disabled
                    ? 'text-[#F4EFE6]/30 cursor-not-allowed'
                    : isSelected
                    ? 'bg-[#292D36] text-[#F4EFE6] font-medium'
                    : isHighlighted
                    ? 'bg-white/10 text-[#F4EFE6]'
                    : 'text-[#D4CFC7] hover:bg-white/10 hover:text-[#F4EFE6]'
                  : opt.disabled
                  ? 'text-[#8B8275]/50 cursor-not-allowed'
                  : isSelected
                  ? 'bg-[#F1ECE3] text-[#3D3830] font-medium'
                  : isHighlighted
                  ? 'bg-[#F1ECE3]/65 text-[#3D3830]'
                  : 'text-[#5C5449] hover:bg-[#F1ECE3]/65 hover:text-[#3D3830]';

                return (
                  <button
                    key={`${opt.value}-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    data-select-option
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => selectOption(opt)}
                    className={`w-full flex items-center justify-between gap-2.5 rounded-xl text-left transition-colors duration-150 ${
                      size === 'md' ? 'px-3 py-2 text-sm' : 'px-2.5 py-2 text-xs'
                    } ${rowClasses}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{opt.label}</span>
                      {opt.hint && (
                        <span
                          className={`block truncate text-[10px] mt-0.5 ${
                            isDark ? 'text-[#F4EFE6]/50' : 'text-[#8B8275]'
                          }`}
                        >
                          {opt.hint}
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <Check
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isDark ? 'text-[#B8965A]' : 'text-[#8B7355]'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
        className={`w-full inline-flex items-center justify-between text-left transition-all duration-150 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${sizeStyles} ${triggerTheme} ${triggerClassName}`}
      >
        <span className="flex items-center gap-1.5 min-w-0 flex-1">
          {icon && <span className="shrink-0 flex items-center">{icon}</span>}
          <span
            className={`truncate ${
              !selectedOption
                ? isDark
                  ? 'text-[#F4EFE6]/55'
                  : 'text-[#8B8275]'
                : ''
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`${chevronSize} shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isOpen ? 'rotate-180' : ''
          } ${isDark ? 'text-[#F4EFE6]/65' : 'text-[#8B8275]'}`}
        />
      </button>

      {menuPortal}
    </div>
  );
};

export default CustomSelect;
