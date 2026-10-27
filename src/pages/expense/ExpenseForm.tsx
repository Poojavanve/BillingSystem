import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CirclePlus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  expenseCategoryApi,
  expenseSubCategoryApi,
  itemApi,
  paymentMethodApi,
  type ExpenseDetail,
  type ExpenseItemResponse,
  type ExpenseRequest,
} from '../../api/endpoints';
import { Button } from '../../components/ui/Button';
import { NumericInput } from '../../components/ui/NumericInput';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { useCreateFlowNavigation } from '../../hooks/useCreateFlowNavigation';
import { useBranch } from '../../hooks/useBranch';
import { hasSelectedId, isPositiveNumber } from '../../utils/validation';

interface Props { initial?: ExpenseDetail; submitText: string; loading: boolean; onSubmit: (payload: ExpenseRequest) => void; onCancel: () => void }
interface Line { itemId: number; itemName: string; quantity: number; price: number }
const inputClass = 'h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50';
const buildLine = (line: ExpenseItemResponse): Line => ({
  itemId: line.itemId || 0,
  itemName: line.itemName,
  quantity: Number(line.quantity || 0),
  price: Number(line.unitPrice || 0),
});

export const ExpenseForm: React.FC<Props> = ({ initial, submitText, loading, onSubmit, onCancel }) => {
  const { navigateToCreate } = useCreateFlowNavigation('/expenses');
  const { selectedBranchId } = useBranch();
  const [expenseCategoryId, setExpenseCategoryId] = useState(initial?.expenseCategory?.id || 0);
  const [expenseSubCategoryId, setExpenseSubCategoryId] = useState(initial?.expenseSubCategory?.id || initial?.expenseSubCategoryId || 0);
  const [expenseDate, setExpenseDate] = useState(initial?.expenseDate || new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(initial?.amount || 0);
  const [paymentMethodId, setPaymentMethodId] = useState(initial?.paymentMethod?.id || 0);
  const [notes, setNotes] = useState(initial?.notes || '');
  const [itemId, setItemId] = useState(0);
  const [itemSearch, setItemSearch] = useState('');
  const [roundOff, setRoundOff] = useState(false);
  const [lines, setLines] = useState<Line[]>(() => (initial?.items || []).map(buildLine));
  const categories = useQuery({
    queryKey: ['expense-categories', selectedBranchId, 'expense-form'],
    queryFn: () => expenseCategoryApi.getAll(''),
    enabled: selectedBranchId !== null,
  });
  const subCategories = useQuery({
    queryKey: ['expense-subcategories', selectedBranchId, 'expense-form', expenseCategoryId],
    queryFn: () => expenseSubCategoryApi.getByCategoryId(expenseCategoryId),
    enabled: selectedBranchId !== null && expenseCategoryId > 0,
  });
  const paymentMethods = useQuery({
    queryKey: ['payment-methods', selectedBranchId, 'expense-form'],
    queryFn: () => paymentMethodApi.getAll(''),
    enabled: selectedBranchId !== null,
  });
  const items = useQuery({
    queryKey: ['items', selectedBranchId, 'expense-form'],
    queryFn: () => itemApi.getAll({ page: 0, size: 1000, search: '' }),
    enabled: selectedBranchId !== null,
  });
  const categoryOptions = (categories.data?.data?.content || [])
    .filter((category) => category.status === 'ACTIVE' || category.id === expenseCategoryId);
  const subCategoryOptions = (subCategories.data?.data?.content || [])
    .filter((subCategory) => subCategory.status === 'ACTIVE' || subCategory.id === expenseSubCategoryId);
  const paymentMethodOptions = (paymentMethods.data?.data?.content || [])
    .filter((paymentMethod) => paymentMethod.status === 'ACTIVE' || paymentMethod.id === paymentMethodId);
  const itemOptions = useMemo(
    () => (items.data?.data?.content || []).map((item) => ({ id: item.id, label: item.itemName })),
    [items.data],
  );
  const realLines = lines.filter((line) => line.itemName.trim().length > 0);
  const total = realLines.reduce((sum, line) => sum + line.quantity * line.price, 0);
  const grandTotal = roundOff ? Math.round(total || amount) : (total || amount);
  const submit = () => {
    if (!expenseCategoryId || !paymentMethodId || grandTotal <= 0) return toast.error('Select category, payment type and valid amount.');
    if (!realLines.length) return toast.error('Add at least one item.');
    onSubmit({
      expenseCategoryId,
      expenseSubCategoryId: expenseSubCategoryId || undefined,
      expenseDate,
      amount: grandTotal,
      paymentMethodId,
      notes,
      items: realLines.map((line) => ({
        itemId: line.itemId || undefined,
        itemName: line.itemName.trim(),
        quantity: line.quantity,
        unitPrice: line.price,
      })),
    });
  };
  const canSubmit = hasSelectedId(expenseCategoryId) && hasSelectedId(paymentMethodId) && isPositiveNumber(grandTotal) && realLines.length > 0;
  const addRow = () => {
    const selected = itemOptions.find((option) => option.id === itemId);
    const name = selected?.label || itemSearch.trim();
    if (!name) return;
    setLines((current) => [...current, { itemId: selected?.id || 0, itemName: name, quantity: 1, price: amount || 0 }]);
    setItemId(0);
    setItemSearch('');
  };
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="border-b px-5 py-4"><h1 className="text-xl font-semibold text-gray-900">Expense Details</h1></div>
      <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
        <label className="text-sm text-gray-600">
          Category
          <div className="mt-1 flex">
            <select
              className={`${inputClass} rounded-r-none`}
              value={expenseCategoryId}
              disabled={categories.isLoading || categories.isError}
              onChange={(event) => {
                setExpenseCategoryId(Number(event.target.value));
                setExpenseSubCategoryId(0);
              }}
            >
              <option value={0}>
                {categories.isLoading
                  ? 'Loading expense categories...'
                  : categories.isError
                    ? 'Failed to load expense categories'
                    : 'Choose one thing'}
              </option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <button
              type="button"
              title="Create expense category"
              aria-label="Create expense category"
              onClick={() => navigateToCreate('/expenses/categories/create')}
              className="flex h-10 w-10 items-center justify-center rounded-r border border-l-0 border-blue-400 text-blue-500 hover:bg-blue-50"
            >
              <CirclePlus size={16} />
            </button>
          </div>
        </label>
        <label className="text-sm text-gray-600">
          Subcategory
          <div className="mt-1 flex">
            <select
              className={`${inputClass} rounded-r-none`}
              value={expenseSubCategoryId}
              disabled={!expenseCategoryId || subCategories.isLoading || subCategories.isError}
              onChange={(event) => setExpenseSubCategoryId(Number(event.target.value))}
            >
              <option value={0}>
                {!expenseCategoryId
                  ? 'Select category first'
                  : subCategories.isLoading
                    ? 'Loading expense subcategories...'
                    : subCategories.isError
                      ? 'Failed to load expense subcategories'
                      : 'Choose one thing'}
              </option>
              {subCategoryOptions.map((subCategory) => (
                <option key={subCategory.id} value={subCategory.id}>{subCategory.name}</option>
              ))}
            </select>
            <button
              type="button"
              title="Create expense subcategory"
              aria-label="Create expense subcategory"
              onClick={() => navigateToCreate('/expenses/subcategories/create')}
              className="flex h-10 w-10 items-center justify-center rounded-r border border-l-0 border-blue-400 text-blue-500 hover:bg-blue-50"
            >
              <CirclePlus size={16} />
            </button>
          </div>
        </label>
        <label className="text-sm text-gray-600">Date<input type="date" className={`${inputClass} mt-1`} value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} /></label>
        <label className="text-sm text-gray-600">
          Payment Type
          <div className="mt-1 flex">
            <select
              className={`${inputClass} rounded-r-none`}
              value={paymentMethodId}
              disabled={paymentMethods.isLoading || paymentMethods.isError}
              onChange={(event) => setPaymentMethodId(Number(event.target.value))}
            >
              <option value={0}>
                {paymentMethods.isLoading
                  ? 'Loading payment types...'
                  : paymentMethods.isError
                    ? 'Failed to load payment types'
                    : 'Choose one thing'}
              </option>
              {paymentMethodOptions.map((paymentMethod) => (
                <option key={paymentMethod.id} value={paymentMethod.id}>{paymentMethod.name}</option>
              ))}
            </select>
            <button
              type="button"
              title="Create payment type"
              aria-label="Create payment type"
              onClick={() => navigateToCreate('/expenses/payment-types/create')}
              className="flex h-10 w-9 items-center justify-center rounded-r border border-l-0 border-blue-400 text-blue-500 hover:bg-blue-50"
            >
              <CirclePlus size={15} />
            </button>
          </div>
        </label>
      </div>
      <h2 className="border-y px-5 py-4 text-lg font-semibold">Expense Items</h2>
      <div className="p-5">
        <label className="text-sm text-gray-600">
          Enter Item Name
          <div className="mt-1 flex max-w-3xl">
            <SearchableSelect
              className="rounded-r-none"
              value={itemId}
              options={itemOptions}
              onChange={setItemId}
              onSearchChange={setItemSearch}
              isLoading={items.isLoading}
              hasError={items.isError}
              placeholder={items.isLoading ? 'Loading items...' : items.isError ? 'Type item name' : 'Search item'}
              loadingPlaceholder="Loading items..."
              emptyMessage="No items found"
            />
            <button type="button" onClick={addRow} className="h-10 shrink-0 rounded-r border border-l-0 border-blue-400 px-10 text-blue-600">Add Row</button>
          </div>
        </label>
      </div>
      <div className="overflow-x-auto px-5"><table className="w-full text-sm"><thead className="bg-gray-50"><tr>{['Action', 'Item', 'QTY', 'Price/Unit', 'Total'].map((heading) => <th key={heading} className="border p-3 text-left">{heading}</th>)}</tr></thead><tbody>{lines.length ? lines.map((line, index) => <tr key={`${line.itemName}-${index}`}><td className="border p-3"><button onClick={() => setLines((current) => current.filter((_, i) => i !== index))} className="text-red-600"><Trash2 size={16} /></button></td><td className="border p-3">{line.itemName}</td><td className="border p-3"><NumericInput min={0} value={line.quantity} onValueChange={(value) => setLines((current) => current.map((entry, i) => i === index ? { ...entry, quantity: value } : entry))} className="w-20 rounded border px-2 py-1" /></td><td className="border p-3"><NumericInput min={0} value={line.price} onValueChange={(value) => setLines((current) => current.map((entry, i) => i === index ? { ...entry, price: value } : entry))} className="w-28 rounded border px-2 py-1" /></td><td className="border p-3">{(line.quantity * line.price).toFixed(2)}</td></tr>) : <tr><td colSpan={5} className="bg-gray-50 p-4 text-center italic">No items are added yet!!</td></tr>}<tr><td colSpan={2} className="border p-2 text-right font-bold">Total</td><td className="border p-2 font-bold">{lines.reduce((sum, line) => sum + line.quantity, 0)}</td><td className="border p-2" /><td className="border p-2 text-right font-bold">{total.toFixed(2)}</td></tr></tbody></table></div>
      <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-[1fr_240px]"><label className="text-sm text-gray-600">Note<textarea className="mt-1 h-20 w-full rounded border border-gray-300 p-3" value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="space-y-2"><label className="flex items-center justify-between bg-gray-50 p-3 text-sm font-semibold"><span><input type="checkbox" checked={roundOff} onChange={(event) => setRoundOff(event.target.checked)} className="mr-2" />Round Off</span><input value={roundOff ? (grandTotal - (total || amount)).toFixed(2) : '0'} readOnly className="w-24 rounded border border-gray-300 px-3 py-2 text-right" /></label><p className="flex items-center justify-between border-t p-3 text-sm font-bold"><span>Grand Total</span><NumericInput min={0} value={grandTotal.toFixed(2)} onValueChange={setAmount} className="w-24 rounded border border-gray-300 px-3 py-2 text-right" /></p></div></div>
      <div className="flex gap-3 border-t p-5"><Button onClick={submit} isLoading={loading} disabled={!canSubmit || loading}>{submitText}</Button><Button variant="secondary" onClick={onCancel}>Close</Button></div>
    </div>
  );
};
