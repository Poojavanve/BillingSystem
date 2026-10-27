import React, { useEffect, useMemo, useState } from 'react';
import { CirclePlus, Trash2 } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { customerApi, itemApi, quotationApi, warehouseApi } from '../../../api/endpoints';
import { queryClient } from '../../../app/queryClient';
import { CountryStateSelect } from '../../../components/form/CountryStateSelect';
import { DateRangeFields, DATE_RANGE_ERROR, isValidDateRange } from '../../../components/form/DateRangeFields';
import { Button } from '../../../components/ui/Button';
import { Loader } from '../../../components/ui/Loader';
import { NumericInput } from '../../../components/ui/NumericInput';
import { useCreateFlowNavigation } from '../../../hooks/useCreateFlowNavigation';
import { hasSelectedId, isPositiveNumber } from '../../../utils/validation';

interface Line {
  itemId: number;
  itemName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
}

const inputClass = 'h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50';
const loadButtonClass = 'mt-1 flex h-10 w-full items-center justify-center rounded border border-gray-300 bg-white px-3 text-sm font-medium text-blue-600 outline-none transition-colors hover:border-blue-400 hover:bg-blue-50 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50';
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const lineTotal = (line: Line) => {
  const base = money(line.quantity * line.unitPrice);
  const discountAmount = money(base * line.discountPercent / 100);
  const taxableAmount = base - discountAmount;
  const taxAmount = money(taxableAmount * line.taxPercent / 100);
  return money(taxableAmount + taxAmount);
};

export const QuotationEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { navigateToCreate } = useCreateFlowNavigation('/sales/quotations');
  const { id: rawId } = useParams<{ id: string }>();
  const id = Number(rawId);

  const quotationQuery = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => quotationApi.getById(id),
    enabled: id > 0,
  });

  const [customerId, setCustomerId] = useState(0);
  const [quotationDate, setQuotationDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [status, setStatus] = useState('PENDING');
  const [stateId, setStateId] = useState(0);
  const [warehouseId, setWarehouseId] = useState(0);
  const [selectedItem, setSelectedItem] = useState(0);
  const [notes, setNotes] = useState('');
  const [roundOff, setRoundOff] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);

  const quotation = quotationQuery.data?.data;

  useEffect(() => {
    if (!quotation) return;
    setCustomerId(quotation.customer?.id || 0);
    setQuotationDate(quotation.quotationDate || new Date().toISOString().slice(0, 10));
    setValidUntil(quotation.validUntil || '');
    setStatus(quotation.status || 'PENDING');
    setWarehouseId(quotation.warehouse?.id || 0);
    setNotes(quotation.notes || '');
    setRoundOff(Number(quotation.roundOff || 0) !== 0);
    if (quotation.items?.length) {
      setLines(
        quotation.items.map((item) => ({
          itemId: item.itemId,
          itemName: item.itemName,
          quantity: item.qty || 1,
          unitPrice: item.unitPrice || 0,
          discountPercent: item.discountAmount ? money((item.discountAmount / (item.qty * item.unitPrice)) * 100) : 0,
          taxPercent: item.taxAmount ? money((item.taxAmount / ((item.qty * item.unitPrice) - (item.discountAmount || 0))) * 100) : 0,
        }))
      );
    }
  }, [quotation]);

  const customers = useQuery({ queryKey: ['quotation-form-customers'], queryFn: () => customerApi.getAll({ page: 0, size: 100, search: '' }) });
  const warehouses = useQuery({ queryKey: ['quotation-form-warehouses'], queryFn: () => warehouseApi.getAll() });
  const items = useQuery({ queryKey: ['quotation-form-items', warehouseId], queryFn: () => itemApi.getAll({ page: 0, size: 100, search: '', warehouseId: warehouseId || undefined }), enabled: warehouseId > 0 });

  const mutation = useMutation({
    mutationFn: (payload: any) => quotationApi.update(id, payload),
    onSuccess: async () => {
      toast.success('Quotation updated successfully');
      await queryClient.invalidateQueries({ queryKey: ['quotations'] });
      await queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      navigate(`/sales/quotations/${id}`);
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to update quotation'),
  });

  const warehouseRows = warehouses.data?.data || [];

  const addItem = () => {
    const item = items.data?.data?.content.find((entry) => entry.id === selectedItem);
    if (!item) {
      toast.error('Select an item to load.');
      return;
    }
    setLines((current) =>
      current.some((line) => line.itemId === item.id)
        ? current
        : [...current, { itemId: item.id, itemName: item.itemName, quantity: 1, unitPrice: item.salePrice, discountPercent: 0, taxPercent: 0 }]
    );
  };

  const update = (index: number, field: keyof Line, value: number) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, [field]: value } : line)));

  const updateAmount = (index: number, newAmount: number) => {
    setLines((current) => current.map((line, i) => {
      if (i !== index) return line;
      const qty = line.quantity > 0 ? line.quantity : 1;
      const unitPrice = money(newAmount / qty);
      return { ...line, unitPrice };
    }));
  };

  const total = useMemo(() => lines.reduce((sum, line) => sum + lineTotal(line), 0), [lines]);
  const grandTotal = roundOff ? Math.round(total) : total;

  const submit = () => {
    if (!isValidDateRange(quotationDate, validUntil)) {
      toast.error(DATE_RANGE_ERROR);
      return;
    }
    if (!customerId || !warehouseId || !lines.length || lines.some((line) => line.quantity <= 0 || line.unitPrice <= 0)) {
      toast.error('Select customer, warehouse, items and valid quantities/prices.');
      return;
    }
    mutation.mutate({
      customerId,
      quotationDate,
      validUntil: validUntil || undefined,
      warehouseId,
      stateId,
      salesPersonId: 0,
      roundOff: money(grandTotal - total),
      status,
      notes,
      items: lines.map(({ itemId, quantity, unitPrice, discountPercent, taxPercent }) => ({
        itemId,
        quantity,
        unitPrice,
        discountPercent,
        taxPercent,
      })),
    });
  };
  const canSubmit = isValidDateRange(quotationDate, validUntil)
    && hasSelectedId(customerId)
    && hasSelectedId(warehouseId)
    && lines.length > 0
    && lines.every((line) => isPositiveNumber(line.quantity) && isPositiveNumber(line.unitPrice));

  if (quotationQuery.isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Sale &gt; Quotation List &gt; Edit Quotation</div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b px-5 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">
            Edit Quotation {quotation?.quotationNo ? `(${quotation.quotationNo})` : ''}
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
          <label className="text-sm text-gray-600">Customer
            <select className={`${inputClass} mt-1`} value={customerId} onChange={(event) => setCustomerId(Number(event.target.value))}>
              <option value={0}>Select Customer</option>
              {customers.data?.data?.content.map((customer) => <option key={customer.id} value={customer.id}>{customer.customerName}</option>)}
            </select>
          </label>
          <DateRangeFields
            fromDate={quotationDate}
            toDate={validUntil}
            fromLabel="Date"
            toLabel="Valid Until"
            inputClassName={`${inputClass} mt-1`}
            onFromDateChange={(value) => { setQuotationDate(value); if (validUntil && value && validUntil < value) setValidUntil(value); }}
            onToDateChange={setValidUntil}
          />
          <label className="text-sm text-gray-600">Quotation Status
            <select className={`${inputClass} mt-1`} value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="CONVERTED">Converted</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
          <CountryStateSelect stateId={stateId} onStateChange={setStateId} className={inputClass} />
        </div>

        <h2 className="border-y px-5 py-4 text-lg font-semibold">Items</h2>
        <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-[210px_1fr_130px]">
          <label className="text-sm text-gray-600">Warehouse
            <select className={`${inputClass} mt-1`} value={warehouseId} onChange={(event) => setWarehouseId(Number(event.target.value))}>
              {warehouseRows.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-gray-600">Enter Item Name
            <div className="mt-1 flex">
              <select className={`${inputClass} rounded-r-none`} value={selectedItem} onChange={(event) => setSelectedItem(Number(event.target.value))}>
                <option value={0}>Scan Barcode/Search Item/Brand Name</option>
                {items.data?.data?.content.map((item) => <option key={item.id} value={item.id}>{item.itemName}</option>)}
              </select>
              <button type="button" onClick={() => navigateToCreate('/items/create')} className="flex h-10 w-11 items-center justify-center rounded-r border border-l-0 border-blue-400 text-blue-500" title="Create item" aria-label="Create item"><CirclePlus size={18} /></button>
            </div>
          </label>
          <label className="text-sm text-gray-600">Sold Items
            <button type="button" onClick={addItem} className={loadButtonClass}>Load</button>
          </label>
        </div>

        <div className="overflow-x-auto px-5">
          <table className="w-full border-collapse text-sm">
            <thead><tr>{['ACTION', 'ITEM', 'MRP', 'QTY', 'UNIT', 'PRICE/UNIT', 'AMOUNT', 'DISCOUNT', 'TAX', 'TOTAL'].map((heading) => <th key={heading} className="border p-2 text-left">{heading}</th>)}</tr></thead>
            <tbody>
              {lines.length ? lines.map((line, index) => {
                const base = line.quantity * line.unitPrice;
                const rowTotal = lineTotal(line);
                return (
                  <tr key={line.itemId}>
                    <td className="border p-2"><button onClick={() => setLines((current) => current.filter((_, i) => i !== index))} className="text-red-500"><Trash2 size={16} /></button></td>
                    <td className="border p-2">{line.itemName}</td>
                    <td className="border p-2">{line.unitPrice.toFixed(2)}</td>
                    <td className="border p-2"><NumericInput min={0} value={line.quantity} onValueChange={(value) => update(index, 'quantity', value)} className="w-16 rounded border px-2 py-1" /></td>
                    <td className="border p-2">Nos</td>
                    <td className="border p-2"><NumericInput min={0} value={line.unitPrice} onValueChange={(value) => update(index, 'unitPrice', value)} className="w-20 rounded border px-2 py-1" /></td>
                    <td className="border p-2"><NumericInput min={0} value={base} onValueChange={(value) => updateAmount(index, value)} className="w-24 rounded border px-2 py-1" /></td>
                    <td className="border p-2"><NumericInput min={0} value={line.discountPercent} onValueChange={(value) => update(index, 'discountPercent', value)} className="w-16 rounded border px-2 py-1" /></td>
                    <td className="border p-2"><NumericInput min={0} value={line.taxPercent} onValueChange={(value) => update(index, 'taxPercent', value)} className="w-16 rounded border px-2 py-1" /></td>
                    <td className="border p-2 font-semibold">{rowTotal.toFixed(2)}</td>
                  </tr>
                );
              }) : <tr><td colSpan={10} className="bg-gray-50 p-4 text-center italic">No items are added yet!!</td></tr>}
              <tr><td colSpan={3} className="border p-2 text-right font-bold">Total</td><td className="border p-2 font-bold">{lines.reduce((sum, line) => sum + line.quantity, 0)}</td><td colSpan={5} className="border p-2" /><td className="border p-2 text-right font-bold">{total.toFixed(2)}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-[1fr_275px]">
          <label className="text-sm text-gray-600">Note
            <textarea className="mt-1 h-20 w-full rounded border p-3" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <div className="space-y-2">
            <label className="flex items-center justify-between bg-gray-50 p-3 text-sm font-semibold"><span><input type="checkbox" checked={roundOff} onChange={(event) => setRoundOff(event.target.checked)} className="mr-2" />Round Off</span><input value={roundOff ? (grandTotal - total).toFixed(2) : '0'} readOnly className="w-28 rounded border px-3 py-2 text-right" /></label>
            <p className="flex items-center justify-between border-t p-3 text-sm font-bold"><span>Grand Total</span><input value={grandTotal.toFixed(2)} readOnly className="w-28 rounded border px-3 py-2 text-right" /></p>
          </div>
        </div>

        <div className="flex gap-3 border-t p-5">
          <Button onClick={submit} isLoading={mutation.isPending} disabled={!canSubmit || mutation.isPending}>Update</Button>
          <Button variant="secondary" onClick={() => navigate(`/sales/quotations/${id}`)}>Cancel</Button>
        </div>
      </div>
    </div>
  );
};