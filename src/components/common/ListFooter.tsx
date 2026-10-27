import React from 'react';
import { Pagination } from '../ui/Pagination';

interface ListFooterProps {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
}

/**
 * Standard list-page footer: "Show entries" bottom-left, "Showing X to Y of Z
 * entries" centered, Pagination on the right.
 */
export const ListFooter: React.FC<ListFooterProps> = ({
  pageSize,
  onPageSizeChange,
  rangeStart,
  rangeEnd,
  total,
  page,
  totalPages,
  onPageChange,
  pageSizeOptions = [10, 20, 50, 100],
}) => (
  <div className="grid grid-cols-1 items-center gap-3 border-t px-5 py-4 text-sm text-gray-600 md:grid-cols-3">
    <label className="flex items-center gap-2 justify-self-start">Show
      <select
        value={pageSize}
        onChange={(event) => onPageSizeChange(Number(event.target.value))}
        className="h-9 rounded border border-gray-300 px-2"
      >
        {pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
      </select>
      entries
    </label>
    <span className="justify-self-start md:justify-self-center">
      Showing {rangeEnd ? rangeStart : 0} to {rangeEnd} of {total} entries
    </span>
    <div className="justify-self-start md:justify-self-end">
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  </div>
);
