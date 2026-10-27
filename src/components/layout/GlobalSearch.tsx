import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isSuperAdminRole } from '../../auth/featurePermissions';
import { getVisibleMenuItems, type MenuItem } from './Sidebar';

interface SearchEntry {
  id: string;
  label: string;
  parentLabel?: string;
  href: string;
  icon: React.ReactNode;
}

/** Flattens the permission-filtered menu into searchable entries: every
 * accessible module (its own page, or its first submenu page as the
 * destination for group-only modules) plus every accessible submodule. */
const buildSearchIndex = (visibleMenuItems: MenuItem[]): SearchEntry[] => {
  const entries: SearchEntry[] = [];

  visibleMenuItems.forEach((item) => {
    if (item.href && !item.submenu) {
      entries.push({ id: item.href, label: item.label, href: item.href, icon: item.icon });
      return;
    }

    const firstSubHref = item.submenu?.find((sub) => sub.href)?.href;
    if (firstSubHref) {
      entries.push({ id: `module:${item.label}`, label: item.label, href: firstSubHref, icon: item.icon });
    }

    item.submenu?.forEach((sub) => {
      if (!sub.href) return;
      entries.push({ id: sub.href, label: sub.label, parentLabel: item.label, href: sub.href, icon: sub.icon });
    });
  });

  return entries;
};

export const GlobalSearch: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasAnyPermission, hasAllPermissions } = useAuth();
  const isSuperAdmin = isSuperAdminRole(user?.role);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchIndex = useMemo(
    () => buildSearchIndex(getVisibleMenuItems(hasAnyPermission, hasAllPermissions, isSuperAdmin)),
    [hasAnyPermission, hasAllPermissions, isSuperAdmin, user?.permissions],
  );

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return searchIndex.filter((entry) =>
      entry.label.toLowerCase().includes(term) || entry.parentLabel?.toLowerCase().includes(term)
    );
  }, [query, searchIndex]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    setQuery('');
    setActiveIndex(0);
  };

  const open = () => setIsOpen(true);

  const selectEntry = (entry: SearchEntry) => {
    navigate(entry.href);
    close();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (!results.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const entry = results[activeIndex];
      if (entry) selectEntry(entry);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={open}
        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        aria-label="Search modules and submodules"
        title="Search"
      >
        <Search size={18} />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 px-4 pt-20 dark:bg-black/35"
          role="dialog"
          aria-modal="true"
          aria-label="Global search"
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <Search size={18} className="shrink-0 text-slate-400 dark:text-slate-500" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search modules and submodules..."
                className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                aria-label="Search modules and submodules"
              />
              <button
                type="button"
                onClick={close}
                aria-label="Close search"
                className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {query.trim() === '' ? (
                <p className="px-4 py-3 text-center text-sm text-slate-400 dark:text-slate-500">
                  Start typing to search modules and submodules.
                </p>
              ) : results.length === 0 ? (
                <p className="px-4 py-3 text-center text-sm text-slate-400 dark:text-slate-500">
                  No results found
                </p>
              ) : (
                <ul role="listbox">
                  {results.map((entry, index) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectEntry(entry)}
                        className={[
                          'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          index === activeIndex
                            ? 'bg-blue-50 dark:bg-blue-900/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/60',
                        ].join(' ')}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300 [&_svg]:h-4 [&_svg]:w-4">
                          {entry.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {entry.label}
                          </span>
                          {entry.parentLabel && (
                            <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
                              {entry.parentLabel} → {entry.label}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
