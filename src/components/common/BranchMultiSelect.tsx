import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import type { Branch } from '../../types/api.types';

interface BranchMultiSelectProps {
  branches: Branch[];
  value: number[];
  onChange: (branchIds: number[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  className?: string;
}

export const BranchMultiSelect: React.FC<BranchMultiSelectProps> = ({
  branches,
  value,
  onChange,
  isLoading = false,
  disabled = false,
  label = 'Branches',
  placeholder = 'Select branches',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const isDisabled = disabled || isLoading;

  const filteredBranches = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return branches;
    return branches.filter((branch) =>
      branch.branchName.toLowerCase().includes(normalizedSearch)
      || (branch.branchCode || '').toLowerCase().includes(normalizedSearch));
  }, [branches, search]);
  const selectedBranches = branches.filter((branch) => value.includes(branch.id));
  const allFilteredSelected = filteredBranches.length > 0 && filteredBranches.every((branch) => value.includes(branch.id));

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
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
    if (!isOpen) setSearch('');
  }, [isOpen]);

  const toggleBranch = (branchId: number) => {
    onChange(value.includes(branchId) ? value.filter((id) => id !== branchId) : [...value, branchId]);
  };

  const toggleAllFiltered = () => {
    const filteredIds = filteredBranches.map((branch) => branch.id);
    onChange(allFilteredSelected
      ? value.filter((id) => !filteredIds.includes(id))
      : Array.from(new Set([...value, ...filteredIds])));
  };

  return (
    <div ref={containerRef} className={`relative min-w-0 w-full text-sm ${className}`}>
      <span className="mb-1 block text-sm text-gray-600 dark:text-gray-300">{label}</span>
      <div
        role="combobox"
        tabIndex={isDisabled ? -1 : 0}
        aria-expanded={isOpen}
        aria-disabled={isDisabled}
        onClick={() => !isDisabled && setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (isDisabled) return;
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        className={`flex min-h-10 w-full min-w-0 cursor-pointer items-center gap-2 rounded border bg-white py-1 pl-3 pr-2 text-left text-gray-900 outline-none transition dark:bg-gray-800 dark:text-gray-100 ${
          isDisabled
            ? 'cursor-not-allowed border-gray-300 bg-gray-50 text-gray-400 dark:border-gray-600 dark:bg-gray-900'
            : isOpen
              ? 'border-blue-400 ring-2 ring-blue-100 dark:ring-blue-900'
              : 'border-gray-300 hover:border-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:focus:ring-blue-900'
        }`}
      >
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {selectedBranches.length ? (
            selectedBranches.map((branch) => (
              <span
                key={branch.id}
                className="inline-flex max-w-full items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
              >
                <span className="truncate">{branch.branchName}</span>
                {!isDisabled && (
                  <button
                    type="button"
                    aria-label={`Remove ${branch.branchName}`}
                    className="rounded hover:text-blue-900 dark:hover:text-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleBranch(branch.id);
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))
          ) : (
            <span className="py-1 text-gray-400">{isLoading ? 'Loading branches...' : placeholder}</span>
          )}
        </div>
        {selectedBranches.length > 0 && !isDisabled && (
          <button
            type="button"
            aria-label="Clear selected branches"
            title="Clear"
            className="shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            onClick={(event) => {
              event.stopPropagation();
              onChange([]);
            }}
          >
            <X size={15} />
          </button>
        )}
        <ChevronDown size={18} className={`shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && !isDisabled && (
        <div
          role="listbox"
          aria-multiselectable
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="border-b p-2 dark:border-gray-700">
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search branches..."
              className="h-9 w-full rounded border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          {filteredBranches.length > 0 && (
            <button
              type="button"
              onClick={toggleAllFiltered}
              className="flex w-full items-center gap-3 border-b px-3 py-2 text-left font-medium text-blue-600 hover:bg-gray-50 dark:border-gray-700 dark:text-blue-300 dark:hover:bg-gray-700"
            >
              <Checkbox checked={allFilteredSelected} />
              {allFilteredSelected ? 'Deselect all' : 'Select all'}
            </button>
          )}
          <div className="max-h-56 overflow-y-auto">
            {filteredBranches.length ? (
              filteredBranches.map((branch) => {
                const selected = value.includes(branch.id);
                return (
                  <button
                    key={branch.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => toggleBranch(branch.id)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                      selected
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
                        : 'text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Checkbox checked={selected} />
                    <span className="min-w-0 flex-1 truncate">
                      {branch.branchName}
                      {branch.branchCode && <span className="ml-1 text-xs text-gray-400">({branch.branchCode})</span>}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="px-4 py-4 text-center text-gray-500 dark:text-gray-400">No branches found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Checkbox: React.FC<{ checked: boolean }> = ({ checked }) => (
  <span
    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
      checked ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white dark:border-gray-500 dark:bg-gray-900'
    }`}
  >
    {checked && <Check size={12} strokeWidth={3} />}
  </span>
);
