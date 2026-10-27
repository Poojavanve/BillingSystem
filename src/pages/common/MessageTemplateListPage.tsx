import React, { useMemo, useState } from 'react';
import { Edit, RefreshCw, Trash2 } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PERMISSIONS } from '../../auth/permissions';
import { messageTemplateApi } from '../../api/endpoints';
import type { MessageTemplate } from '../../types/api.types';
import { queryClient } from '../../app/queryClient';
import { Button } from '../../components/ui/Button';
import { Loader } from '../../components/ui/Loader';
import { BulkActionBar } from '../../components/common/BulkActionBar';
import { ListFooter } from '../../components/common/ListFooter';
import { ListToolbarHeader } from '../../components/common/ListToolbarHeader';
import { useAuth } from '../../hooks/useAuth';
import { useConfirmation } from '../../hooks/useConfirmation';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDate } from '../../utils/formatDate';
import { downloadCsv, downloadExcel, printTable } from '../../utils/tableExport';

interface Props {
  type: 'sms' | 'email';
}

const truncate = (value: string, maxLength = 72) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
};

export const MessageTemplateListPage: React.FC<Props> = ({ type }) => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { confirmAction, confirmationDialog } = useConfirmation();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const debouncedSearch = useDebounce(search);

  const isSms = type === 'sms';
  const title = isSms ? 'SMS Templates' : 'Email Templates';
  const singular = isSms ? 'SMS template' : 'Email template';
  const basePath = isSms ? '/sms/templates' : '/email/templates';
  const queryKey = ['message-template', type, page, pageSize, debouncedSearch];
  const exportColumns = isSms
    ? ['Name', 'Content', 'Status', 'Created at']
    : ['Name', 'Subject', 'Content', 'Status', 'Created at'];

  const canCreate = hasPermission(isSms ? PERMISSIONS.SMS_TEMPLATE_CREATE : PERMISSIONS.EMAIL_TEMPLATE_CREATE);
  const canUpdate = hasPermission(isSms ? PERMISSIONS.SMS_TEMPLATE_UPDATE : PERMISSIONS.EMAIL_TEMPLATE_UPDATE);
  const canDelete = hasPermission(isSms ? PERMISSIONS.SMS_TEMPLATE_DELETE : PERMISSIONS.EMAIL_TEMPLATE_DELETE);
  const showActions = canUpdate || canDelete;

  const records = useQuery({
    queryKey,
    queryFn: () => messageTemplateApi.getAll(type, { page, size: pageSize, search: debouncedSearch }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => messageTemplateApi.delete(type, id),
    onSuccess: async () => {
      toast.success(`${singular} deleted`);
      await queryClient.invalidateQueries({ queryKey: ['message-template', type] });
    },
    onError: (error: any) => toast.error(error?.message || `Failed to delete ${singular.toLowerCase()}`),
  });

  const rows = records.data?.data?.content || [];
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  const selectedRows = rows.filter((row) => selectedIds.includes(row.id));

  const exportRows = useMemo(
    () => selectedRows.map((row) => isSms
      ? [row.name, row.content, row.status || '', row.createdAt ? formatDate(row.createdAt) : '']
      : [row.name, row.subject || '', row.content, row.status || '', row.createdAt ? formatDate(row.createdAt) : '']
    ),
    [isSms, selectedRows]
  );

  const copy = async () => {
    await navigator.clipboard.writeText([exportColumns, ...exportRows].map((row) => row.join('\t')).join('\n'));
    toast.success(`${title} copied`);
  };

  const download = (extension: 'csv' | 'xls') => {
    if (extension === 'csv') downloadCsv(exportColumns, exportRows, `${type}-templates`);
    else downloadExcel(exportColumns, exportRows, `${type}-templates`, title);
  };

  const printPdf = () => {
    if (!printTable(exportColumns, exportRows, title)) {
      toast.error('Please allow popups to print');
    }
  };

  const deleteTemplate = async (row: MessageTemplate) => {
    const confirmed = await confirmAction({
      title: `Delete ${singular}`,
      message: `Delete "${row.name}"?`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (confirmed) remove.mutate(row.id);
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) return toast.error(`Select at least one ${singular.toLowerCase()}`);
    const confirmed = await confirmAction({
      title: `Delete ${title}`,
      message: `Delete ${selectedIds.length} selected template${selectedIds.length === 1 ? '' : 's'}?`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    for (const id of selectedIds) {
      await remove.mutateAsync(id);
    }
    setSelectedIds([]);
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(0);
    setSelectedIds([]);
  };

  const totalPages = records.data?.data?.totalPages || 1;
  const totalElements = records.data?.data?.totalElements || 0;

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; {isSms ? 'SMS' : 'Email'} &gt; {title}</div>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <ListToolbarHeader
          title={title}
          searchValue={search}
          onSearchChange={(value) => { setSearch(value); setPage(0); setSelectedIds([]); }}
          searchPlaceholder="Search templates..."
          actions={(
            <>
              <button type="button" onClick={() => records.refetch()} title="Refresh" aria-label="Refresh" className="flex h-9 w-9 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-50">
                <RefreshCw size={15} />
              </button>
              {canCreate && (
                <Button onClick={() => navigate(`${basePath}/create`)} className="min-w-[190px]">Create Template</Button>
              )}
            </>
          )}
        />

        {canDelete && (
          <BulkActionBar
            selectedCount={selectedIds.length}
            onClearSelection={() => setSelectedIds([])}
            onDelete={deleteSelected}
            onCopy={copy}
            onDownloadExcel={() => download('xls')}
            onDownloadCsv={() => download('csv')}
            onPrint={printPdf}
          />
        )}

        {records.isError && (
          <div className="mx-5 mb-4 mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Failed to load {title.toLowerCase()}.
          </div>
        )}

        <div className="overflow-x-auto px-3 pb-3 pt-3">
          {records.isLoading ? (
            <div className="p-10"><Loader /></div>
          ) : (
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {canDelete && (
                    <th className="border p-3">
                      <input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : rows.map((row) => row.id))} />
                    </th>
                  )}
                  {exportColumns.map((heading) => <th key={heading} className="border p-3 text-left">{heading}</th>)}
                  {showActions && <th className="border p-3 text-left">Action</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b even:bg-gray-50">
                    {canDelete && (
                      <td className="border p-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(row.id)}
                          onChange={() => setSelectedIds((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])}
                        />
                      </td>
                    )}
                    <td className="border p-3 font-medium">{row.name}</td>
                    {!isSms && <td className="border p-3">{row.subject || ''}</td>}
                    <td className="border p-3">{truncate(row.content || '')}</td>
                    <td className="border p-3">{row.status || ''}</td>
                    <td className="border p-3">{row.createdAt ? formatDate(row.createdAt) : ''}</td>
                    {showActions && (
                      <td className="border p-3">
                        <div className="flex gap-2">
                          {canUpdate && (
                            <button type="button" onClick={() => navigate(`${basePath}/${row.id}/edit`, { state: row })} className="text-orange-600" title="Edit template">
                              <Edit size={16} />
                            </button>
                          )}
                          {canDelete && (
                            <button type="button" onClick={() => deleteTemplate(row)} className="text-red-600" title="Delete template">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={exportColumns.length + Number(canDelete) + Number(showActions)} className="bg-gray-50 p-5 text-center">No data available in table</td></tr>}
              </tbody>
            </table>
          )}
        </div>

        <ListFooter
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
          rangeStart={page * pageSize + 1}
          rangeEnd={page * pageSize + rows.length}
          total={totalElements}
          page={page}
          totalPages={totalPages}
          onPageChange={(nextPage) => { setPage(nextPage); setSelectedIds([]); }}
        />
      </div>
      {confirmationDialog}
    </div>
  );
};

