import React, { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { branchApi, excelImportApi } from '../../api/endpoints';
import { Button } from '../../components/ui/Button';
import { useBranch } from '../../hooks/useBranch';
import type { ApiResponse } from '../../api/apiResponse';
import type { ItemExcelImportResult } from '../../types/api.types';

interface Props {
  type: 'items' | 'contacts';
}

const inputClass = 'h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50';

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const ImportPage: React.FC<Props> = ({ type }) => {
  const isItems = type === 'items';
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [importResult, setImportResult] = useState<ItemExcelImportResult | null>(null);
  const title = isItems ? 'Import Items' : 'Import Contacts';

  const { selectedBranchId, setSelectedBranchId } = useBranch();
  const branches = useQuery({
    queryKey: ['my-branches', 'import-items'],
    queryFn: () => branchApi.getMine(),
    enabled: isItems,
  });
  const branchRows = branches.data?.data || [];

  const downloadTemplate = useMutation({
    mutationFn: () => isItems ? excelImportApi.downloadItemsTemplate() : excelImportApi.downloadContactsTemplate(),
    onSuccess: (blob) => {
      saveBlob(blob, isItems ? 'Items-Import-Template.xlsx' : 'Contacts-Import-Template.xlsx');
      toast.success('Template downloaded');
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to download template'),
  });
  const uploadExcel = useMutation<ApiResponse<ItemExcelImportResult | void>, any, File>({
    mutationFn: (file: File) => {
      if (isItems) {
        return excelImportApi.importItems(file);
      }
      return excelImportApi.importContacts(file);
    },
    onSuccess: (response) => {
      if (fileRef.current) fileRef.current.value = '';
      setSelectedFileName('');
      if (isItems) {
        const result = response.data as ItemExcelImportResult;
        setImportResult(result);
        const succeeded = (result.createdItems || 0) + (result.updatedItems || 0);
        if (result.failedRows > 0) {
          toast.error(`${succeeded} item(s) imported, ${result.failedRows} row(s) failed. See details below.`);
        } else {
          toast.success(`${result.createdItems} created, ${result.updatedItems} updated`);
        }
      } else {
        setImportResult(null);
        toast.success('Contacts imported successfully');
      }
    },
    onError: (error: any) => toast.error(error?.message || `Failed to import ${isItems ? 'items' : 'contacts'}`),
  });
  const submit = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error('Please choose an Excel file');
      return;
    }
    if (isItems && !selectedBranchId) {
      toast.error('Please select a branch');
      return;
    }
    uploadExcel.mutate(file);
  };
  const canSubmit = Boolean(selectedFileName) && (!isItems || Boolean(selectedBranchId));
  const downloadButton = (
    <button
      type="button"
      className="h-10 min-w-[170px] rounded border border-blue-500 bg-white px-5 text-sm font-semibold text-blue-600 hover:bg-blue-50"
      disabled={downloadTemplate.isPending}
      onClick={() => downloadTemplate.mutate()}
    >
      {downloadTemplate.isPending ? 'Downloading...' : 'Download'}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Utilities &gt; {title}</div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b px-5 py-4">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        </div>

        <div className="p-5">
          <div className={`grid grid-cols-1 gap-4 ${isItems ? 'max-w-md' : 'max-w-md'}`}>
            {isItems && (
              <label className="text-sm text-gray-600">
                Branch
                <select
                  className={`${inputClass} mt-1`}
                  disabled={branches.isLoading}
                  value={selectedBranchId ?? ''}
                  onChange={(event) => setSelectedBranchId(Number(event.target.value))}
                >
                  <option value="" disabled>
                    {branches.isLoading ? 'Loading branches...' : branchRows.length ? 'Select branch' : 'No branches found'}
                  </option>
                  {branchRows.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.branchName}</option>
                  ))}
                </select>
              </label>
            )}
            {isItems ? (
              <label className="text-sm text-gray-600">
                Download Sample
                <span className="mt-1 block">{downloadButton}</span>
              </label>
            ) : (
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="min-w-[125px]">Download Sample</span>
                {downloadButton}
              </div>
            )}

            <label className="text-sm text-gray-600">
              Browse File
              <input ref={fileRef} type="file" accept=".xls,.xlsx,.csv" className={`${inputClass} mt-1 max-w-md py-2`} onChange={(event) => { setSelectedFileName(event.target.files?.[0]?.name || ''); setImportResult(null); }} />
            </label>
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <Button type="button" isLoading={uploadExcel.isPending} onClick={submit} disabled={!canSubmit || uploadExcel.isPending}>Submit</Button>
          <Button type="button" variant="secondary" onClick={() => { if (fileRef.current) fileRef.current.value = ''; setSelectedFileName(''); setImportResult(null); }}>Close</Button>
        </div>

        {isItems && importResult && (
          <div className="border-t px-5 py-4">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700">
              <span>Rows processed: <strong>{importResult.itemRows}</strong></span>
              <span>Created: <strong className="text-green-700">{importResult.createdItems}</strong></span>
              <span>Updated: <strong className="text-blue-700">{importResult.updatedItems}</strong></span>
              <span>Failed: <strong className={importResult.failedRows > 0 ? 'text-red-700' : ''}>{importResult.failedRows}</strong></span>
            </div>

            {importResult.errors.length > 0 && (
              <div className="mt-3">
                <div className="text-sm font-semibold text-red-700">Rows that were not imported</div>
                <ul className="mt-1 max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-red-700">
                  {importResult.errors.map((err, index) => (
                    <li key={`${err.rowNumber}-${index}`}>
                      Row {err.rowNumber}{err.itemName ? ` (${err.itemName})` : ''}: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {importResult.warnings.length > 0 && (
              <div className="mt-3">
                <div className="text-sm font-semibold text-amber-700">Notes</div>
                <ul className="mt-1 max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-amber-700">
                  {importResult.warnings.map((warning, index) => (
                    <li key={`${warning.rowNumber}-${index}`}>
                      Row {warning.rowNumber}{warning.itemName ? ` (${warning.itemName})` : ''}: {warning.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
