import React, { useState, useRef, useEffect, useCallback } from 'react';

export type ComboboxOption = {
  value: string;
  label: string;
  icon?: string;
};

export type ComboboxProps = {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
};

export const Combobox: React.FC<ComboboxProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchable = true,
  clearable = false,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filteredOptions = searchable && search
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-combobox-option]');
      const el = items[highlightIndex] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setSearch('');
      setHighlightIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightIndex((prev) =>
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightIndex >= 0 && highlightIndex < filteredOptions.length) {
            handleSelect(filteredOptions[highlightIndex].value);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setSearch('');
          break;
      }
    },
    [isOpen, highlightIndex, filteredOptions]
  );

  return (
    <div
      ref={containerRef}
      className={`relative ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
    >
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={`
          flex items-center justify-between w-full px-3 py-2.5 text-sm bg-surface border border-cwc-border rounded-cwc-md
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2
          transition-colors text-left
          ${isOpen ? 'ring-2 ring-brand-500 ring-offset-2' : ''}
          ${!selectedOption ? 'text-text-tertiary' : 'text-text-primary'}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon && (
            <span className="material-symbols-outlined text-lg">{selectedOption.icon}</span>
          )}
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="flex items-center gap-1">
          {clearable && value && (
            <span
              onClick={handleClear}
              className="material-symbols-outlined text-base text-text-tertiary hover:text-text-primary cursor-pointer"
              role="button"
              aria-label="Clear selection"
            >
              close
            </span>
          )}
          <span className="material-symbols-outlined text-lg text-text-tertiary">
            {isOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
          </span>
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-[50] bg-surface border border-cwc-border rounded-cwc-md shadow-cwc-lg overflow-hidden">
          {/* Search input */}
          {searchable && (
            <div className="px-3 py-2 border-b border-cwc-border">
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-text-tertiary">
                  search
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setHighlightIndex(0);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-surface-subtle border border-cwc-border rounded-cwc-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Search..."
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>
          )}

          {/* Options list */}
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-60 overflow-y-auto py-1"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-6 text-sm text-text-tertiary text-center">
                No options found
              </li>
            ) : (
              filteredOptions.map((option, index) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  data-combobox-option
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setHighlightIndex(index)}
                  className={`
                    flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors
                    ${
                      index === highlightIndex
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-text-primary hover:bg-surface-muted'
                    }
                    ${option.value === value ? 'font-semibold' : ''}
                  `}
                >
                  {option.icon && (
                    <span className="material-symbols-outlined text-lg">{option.icon}</span>
                  )}
                  {option.label}
                  {option.value === value && (
                    <span className="material-symbols-outlined text-base text-brand-700 ml-auto">
                      check
                    </span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Combobox;