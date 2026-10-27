import React from 'react';
import { TableExportButtons } from './TableExportButtons';

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  deleteLabel?: string;
  onDelete?: () => void;
  onCopy?: () => Promise<void> | void;
  onDownloadExcel?: () => void;
  onDownloadCsv?: () => void;
  onPrint?: () => void;
}

/**
 * Selection-triggered bulk action bar. Renders nothing while no rows are
 * selected; appears only once selectedCount > 0, and disappears again when
 * the selection is cleared (page-size change, search, page change, etc.).
 */
export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onClearSelection,
  deleteLabel = 'Delete',
  onDelete,
  onCopy,
  onDownloadExcel,
  onDownloadCsv,
  onPrint,
}) => {
  if (selectedCount <= 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-blue-50 px-5 py-3">
      <div className="flex items-center gap-3 text-sm font-medium text-blue-800">
        <span>{selectedCount} selected</span>
        <button type="button" onClick={onClearSelection} className="text-xs font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800">
          Clear
        </button>
      </div>
      <TableExportButtons
        leadingButton={onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="h-10 rounded-l border border-red-300 px-3 text-sm text-red-500 transition-all active:scale-95 active:bg-red-50"
          >
            {deleteLabel}
          </button>
        )}
        onCopy={onCopy}
        onDownloadExcel={onDownloadExcel}
        onDownloadCsv={onDownloadCsv}
        onPrint={onPrint}
      />
    </div>
  );
};
