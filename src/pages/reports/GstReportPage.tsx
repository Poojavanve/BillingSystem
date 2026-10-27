import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api/endpoints';
import { Button } from '../../components/ui/Button';
import { Loader } from '../../components/ui/Loader';
import { DateRangeFields, DATE_RANGE_ERROR, isValidDateRange } from '../../components/form/DateRangeFields';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../auth/permissions';
import { downloadCsv, downloadExcel } from '../../utils/tableExport';

const inputClass = 'h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50';

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const today = new Date();
const defaultFromDate = toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1));
const defaultToDate = toIsoDate(today);

const money = (value: number) => value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const GstReportPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canExport = hasPermission(PERMISSIONS.GST_EXPORT);
  const [filters, setFilters] = useState({ fromDate: defaultFromDate, toDate: defaultToDate });
  const [submitted, setSubmitted] = useState<typeof filters | null>(null);

  const report = useQuery({
    queryKey: ['report', 'gst-summary', submitted],
    queryFn: async () => {
      if (!submitted || !isValidDateRange(submitted.fromDate, submitted.toDate)) throw new Error(DATE_RANGE_ERROR);
      return reportsApi.gstSummary(submitted);
    },
    enabled: Boolean(submitted) && isValidDateRange(submitted?.fromDate || '', submitted?.toDate || ''),
  });

  const data = report.data?.data;
  const rows: Array<[string, number]> = [
    ['Sales Taxable Amount', Number(data?.salesTaxableAmount || 0)],
    ['Sales CGST', Number(data?.salesCgstAmount || 0)],
    ['Sales SGST', Number(data?.salesSgstAmount || 0)],
    ['Sales IGST', Number(data?.salesIgstAmount || 0)],
    ['Sales Cess', Number(data?.salesCessAmount || 0)],
    ['Purchase Taxable Amount', Number(data?.purchaseTaxableAmount || 0)],
    ['Purchase CGST', Number(data?.purchaseCgstAmount || 0)],
    ['Purchase SGST', Number(data?.purchaseSgstAmount || 0)],
    ['Purchase IGST', Number(data?.purchaseIgstAmount || 0)],
    ['Purchase Cess', Number(data?.purchaseCessAmount || 0)],
    ['Output Tax Total', Number(data?.outputTaxTotal || 0)],
    ['Input Tax Total', Number(data?.inputTaxTotal || 0)],
    ['Net GST Liability', Number(data?.netGstLiability || 0)],
  ];

  const exportRows = rows.map(([metric, amount]) => [metric, String(amount)]);
  const exportHeaders = ['Metric', 'Amount'];
  const exportReport = (extension: 'csv' | 'xls') => {
    if (!canExport) {
      toast.error('You do not have permission to export GST reports.');
      return;
    }
    if (extension === 'csv') downloadCsv(exportHeaders, exportRows, 'gst-summary-report');
    else downloadExcel(exportHeaders, exportRows, 'gst-summary-report', 'GST Summary Report');
  };

  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-500">Home &gt; Reports &gt; GST Summary</div>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b px-5 py-4">
          <h1 className="text-xl font-semibold text-gray-900">GST Summary Filter</h1>
        </div>
        <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
          <DateRangeFields
            fromDate={filters.fromDate}
            toDate={filters.toDate}
            inputClassName={`${inputClass} mt-1`}
            onFromDateChange={(fromDate) => setFilters((current) => ({ ...current, fromDate, toDate: current.toDate && current.toDate < fromDate ? fromDate : current.toDate }))}
            onToDateChange={(toDate) => setFilters((current) => ({ ...current, toDate }))}
          />
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <Button type="button" onClick={() => {
            if (!isValidDateRange(filters.fromDate, filters.toDate)) {
              toast.error(DATE_RANGE_ERROR);
              return;
            }
            setSubmitted({ ...filters });
          }}>Submit</Button>
          <Button type="button" variant="secondary" onClick={() => setSubmitted(null)}>Close</Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-xl font-semibold text-gray-900">GST Summary Report</h2>
          <div className="flex">
            <button type="button" disabled={!canExport} onClick={() => exportReport('xls')} className="h-9 rounded-l border border-green-500 px-4 text-sm font-semibold text-green-600 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50">Export</button>
            <button type="button" disabled={!canExport} onClick={() => exportReport('csv')} className="h-9 rounded-r border border-l-0 border-green-500 px-3 text-sm font-semibold text-green-600 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50">v</button>
          </div>
        </div>
        {report.isLoading ? (
          <div className="p-10"><Loader /></div>
        ) : (
          <div className="p-5">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="border p-3 text-left">Metric</th>
                  <th className="border p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, value]) => (
                  <tr key={label} className="even:bg-gray-50">
                    <td className="border p-3 font-medium">{label}</td>
                    <td className="border p-3 text-right font-semibold">{money(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
