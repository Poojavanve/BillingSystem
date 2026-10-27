import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface SearchableSelectOption {
  id: number;
  label: string;
}

interface SearchableSelectProps {
  value: number;
  options: SearchableSelectOption[];
  onChange: (id: number) => void;
  onSearchChange?: (search: string) => void;
  isLoading?: boolean;
  hasError?: boolean;
  disabled?: boolean;
  placeholder?: string;
  loadingPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  dropdownPortal?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  options,
  onChange,
  onSearchChange,
  isLoading = false,
  hasError = false,
  disabled = false,
  placeholder = 'Search...',
  loadingPlaceholder = 'Loading...',
  emptyMessage = 'No options found',
  className = '',
  dropdownPortal = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>();
  const isDisabled = disabled || isLoading;

  const selectedOption = useMemo(() => options.find((option) => option.id === value), [options, value]);
  const filteredOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch || value) return options;
    return options.filter((option) => option.label.toLowerCase().includes(normalizedSearch));
  }, [options, search, value]);

  useEffect(() => {
    if (!value || search) return;
    if (selectedOption) setSearch(selectedOption.label);
  }, [search, selectedOption, value]);

  useEffect(() => {
    if (!value) setSearch('');
  }, [value]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !dropdownPortal) return undefined;

    const updateDropdownPosition = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const maxHeight = 224;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openAbove = spaceBelow < Math.min(maxHeight, 160) && spaceAbove > spaceBelow;
      const availableHeight = Math.max(0, Math.min(maxHeight, openAbove ? spaceAbove : spaceBelow));

      setDropdownStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        top: openAbove ? Math.max(8, rect.top - availableHeight - 4) : rect.bottom + 4,
        maxHeight: availableHeight,
        zIndex: 1000,
      });
    };

    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [dropdownPortal, isOpen]);

  return (
    <div ref={containerRef} className="relative min-w-0 w-full">
      <input
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        disabled={isDisabled}
        className={[
          'h-10 w-full min-w-0 rounded border bg-white px-3 pr-9 text-sm text-gray-900 outline-none transition',
          'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400',
          hasError
            ? 'border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-100'
            : isOpen
              ? 'border-blue-400 ring-2 ring-blue-100'
              : 'border-gray-300 hover:border-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100',
          className,
        ].filter(Boolean).join(' ')}
        placeholder={isLoading ? loadingPlaceholder : placeholder}
        value={search}
        onFocus={() => !isDisabled && setIsOpen(true)}
        onChange={(event) => {
          setSearch(event.target.value);
          onSearchChange?.(event.target.value);
          if (value) onChange(0);
          setIsOpen(true);
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={isDisabled}
        aria-label="Toggle options"
        onClick={() => setIsOpen((current) => !current)}
        className="absolute right-0 top-0 flex h-10 w-9 items-center justify-center text-gray-600 disabled:text-gray-300"
      >
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !isDisabled && (() => {
        const dropdown = (
          <div
            ref={dropdownRef}
            role="listbox"
            style={dropdownPortal ? dropdownStyle : undefined}
            className={`z-50 max-h-56 w-full overflow-y-auto rounded-lg border border-blue-300 bg-white shadow-xl ${dropdownPortal ? 'fixed' : 'absolute mt-1'}`}
          >
            {isLoading ? (
              <p className="px-4 py-3 text-sm text-gray-500">{loadingPlaceholder}</p>
            ) : filteredOptions.length ? (
              filteredOptions.map((option) => {
                const selected = option.id === value;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(option.id);
                      setSearch(option.label);
                      onSearchChange?.(option.label);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 border-t border-gray-100 px-4 py-2.5 text-left text-sm transition first:border-t-0 ${
                      selected ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {selected && <Check size={15} className="shrink-0" />}
                  </button>
                );
              })
            ) : (
              <p className="px-4 py-3 text-center text-sm text-gray-500">{emptyMessage}</p>
            )}
          </div>
        );

        return dropdownPortal ? createPortal(dropdown, document.body) : dropdown;
      })()}
    </div>
  );
};
