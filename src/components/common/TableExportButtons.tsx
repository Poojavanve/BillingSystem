import React, { useState } from 'react';
import { Check, Copy, FileSpreadsheet, FileText, Printer, RefreshCw } from 'lucide-react';

interface TableExportButtonsProps {
  onCopy?: () => Promise<void> | void;
  onDownloadExcel?: () => void;
  onDownloadCsv?: () => void;
  onPrint?: () => void;
  onRefresh?: () => void;
  leadingButton?: React.ReactNode;
}

const btnBase = [
  'inline-flex h-9 items-center gap-1.5 border-y border-r px-3 text-xs font-medium select-none',
  'transition-colors duration-100 active:scale-[0.97]',
  'text-slate-600 hover:bg-slate-50 active:bg-slate-100',
  'dark:text-slate-300 dark:hover:bg-slate-700 dark:active:bg-slate-600',
  'border-slate-200 dark:border-slate-700',
].join(' ');

export const TableExportButtons: React.FC<TableExportButtonsProps> = ({
  onCopy,
  onDownloadExcel,
  onDownloadCsv,
  onPrint,
  onRefresh,
  leadingButton,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!onCopy) return;
    await onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const buttons: Array<{ key: string; onClick: () => void; title: string; className?: string; content: React.ReactNode }> = [];
  if (onCopy) {
    buttons.push({
      key: 'copy',
      onClick: handleCopy,
      title: 'Copy to clipboard',
      className: copied ? '!border-green-300 !bg-green-50 !text-green-700 dark:!border-green-800 dark:!bg-green-900/30 dark:!text-green-400' : '',
      content: copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>,
    });
  }
  if (onDownloadExcel) {
    buttons.push({ key: 'excel', onClick: onDownloadExcel, title: 'Download as Excel', content: <><FileSpreadsheet size={12} /> Excel</> });
  }
  if (onDownloadCsv) {
    buttons.push({ key: 'csv', onClick: onDownloadCsv, title: 'Download as CSV', content: <><FileText size={12} /> CSV</> });
  }
  if (onPrint) {
    buttons.push({ key: 'pdf', onClick: onPrint, title: 'Print / PDF', content: <><Printer size={12} /> PDF</> });
  }
  if (onRefresh) {
    buttons.push({ key: 'refresh', onClick: onRefresh, title: 'Refresh data', content: <RefreshCw size={13} /> });
  }

  const hasLeading = Boolean(leadingButton);

  return (
    <div className="inline-flex flex-wrap items-center rounded-lg overflow-hidden">
      {leadingButton}
      {buttons.map((button, index) => (
        <button
          key={button.key}
          type="button"
          onClick={button.onClick}
          className={[
            btnBase,
            !hasLeading && index === 0 ? 'rounded-l-lg border-l' : '',
            index === buttons.length - 1 ? 'rounded-r-lg' : '',
            button.className || '',
          ].filter(Boolean).join(' ')}
          title={button.title}
          aria-label={button.key === 'refresh' ? 'Refresh' : undefined}
        >
          {button.content}
        </button>
      ))}
    </div>
  );
};
