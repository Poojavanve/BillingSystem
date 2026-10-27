import React from 'react';

interface ListToolbarHeaderProps {
  title: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
}

/**
 * Standard list-page header: title on the left, Search immediately before any
 * Create/New action(s) on the right, so Search always precedes Create in the toolbar.
 */
export const ListToolbarHeader: React.FC<ListToolbarHeaderProps> = ({
  title,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  actions,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
    <h1 className="text-xl font-semibold uppercase text-gray-900">{title}</h1>
    <div className="flex flex-wrap items-center gap-3">
      {onSearchChange && (
        <input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 rounded border border-gray-300 px-3 text-sm"
          aria-label={searchPlaceholder}
        />
      )}
      {actions}
    </div>
  </div>
);
