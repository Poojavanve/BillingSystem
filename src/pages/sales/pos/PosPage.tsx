import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Box, Check, ChevronDown, Flame, GitBranch, Loader2, Minus, PackageSearch, Plus, Printer, ReceiptText, Search, Trash2, UserRound, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { customerApi, itemApi, paymentMethodApi, posApi, reportsApi, warehouseApi } from '../../../api/endpoints';
import type { ItemListItem, PosItemSearchItem } from '../../../api/endpoints';
import { getDefaultAuthorizedPath } from '../../../auth/featurePermissions';
import { PERMISSIONS } from '../../../auth/permissions';
import { NumericInput } from '../../../components/ui/NumericInput';
import { useAuth } from '../../../hooks/useAuth';
import { useBranch } from '../../../hooks/useBranch';
import { useBranchAutoSelect } from '../../../hooks/useBranchAutoSelect';
import { useDebounce } from '../../../hooks/useDebounce';
import { useCreateFlowNavigation } from '../../../hooks/useCreateFlowNavigation';
import type { CustomerListItem } from '../../../types/customer.types';
import type { TopSellingItem } from '../../../types/api.types';

interface WarehouseStock { warehouseId: number; availableQty: number }
interface PosItem extends ItemListItem { warehouseStocks: WarehouseStock[] }
interface CartLine extends PosItem { quantity: number }
interface PaymentRow { key: string; paymentMethodId: number; amount: number }
type PosSearchItem = PosItemSearchItem;
type PosDisplayItem = PosItem | PosSearchItem;
interface Transaction {
  id: number;
  customerId: number;
  customerLabel: string;
  cart: CartLine[];
  payments: PaymentRow[];
  roundOff: boolean;
  lastSaleId?: number;
}

const controlClass = 'h-10 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100';
const formatMoney = (value: number | null | undefined) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatPercent = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2);
// Keeps an area scrollable (wheel/touch/keyboard) while hiding the scrollbar itself (see index.css).
const hideScrollbarClass = 'no-scrollbar';
const NON_GST_LABELS: Record<string, string> = { EXEMPT: 'Exempt', NIL_RATED: 'Nil', NON_GST: 'Non-GST' };
const gstLabel = (item: ItemListItem) => NON_GST_LABELS[item.gstTaxability || '']
  || (item.gstRate !== undefined && item.gstRate !== null ? `${formatPercent(Number(item.gstRate))}%` : '-');
const getCustomerLabel = (customer: CustomerListItem) => `${customer.customerName}${customer.mobile ? ` - ${customer.mobile}` : ''}`;
const getImage = (item: { imageUrl?: string | null; itemImageUrl?: string; image?: string; imagePath?: string; photoUrl?: string }) => {
  const image = item as { imageUrl?: string | null; itemImageUrl?: string; image?: string; imagePath?: string; photoUrl?: string };
  return image.imageUrl || image.itemImageUrl || image.image || image.imagePath || image.photoUrl || '';
};
// Line maths mirrors backend TransactionSupport.calculateLine: gross and discount are each rounded
// half-up to paise (the tiny epsilon absorbs float noise such as 100.1 * 5 = 500.4999...).
const toPaise = (value: number) => Math.round(value * 100 + 1e-6);
const baseAmount = (line: CartLine) => toPaise(Number(line.salePrice || 0) * line.quantity) / 100;
const discountAmount = (line: CartLine) => Math.round(baseAmount(line) * Number(line.discountPercentage || 0) + 1e-6) / 100;
const taxableAmount = (line: CartLine) => Math.max(0, baseAmount(line) - discountAmount(line));
// Tax mirrors backend GstCalculationServiceImpl: exclusive of price, charged on the taxable
// (discounted) amount, nothing for exempt / nil-rated / non-GST items. POS sales are treated as
// intra-state, so GST is CGST + SGST at half the rate each, each half rounded to paise separately.
const isGstTaxable = (line: CartLine) => (line.gstTaxability || 'TAXABLE') === 'TAXABLE';
const gstAmount = (line: CartLine) => isGstTaxable(line)
  ? 2 * toPaise(taxableAmount(line) * Number(line.gstRate || 0) / 200) / 100
  : 0;
const cessAmount = (line: CartLine) => isGstTaxable(line)
  ? toPaise(taxableAmount(line) * Number(line.cessRate || 0) / 100) / 100
  : 0;
const lineTotal = (line: CartLine) => taxableAmount(line) + gstAmount(line) + cessAmount(line);
const cessLabel = (item: ItemListItem) => (NON_GST_LABELS[item.gstTaxability || ''] || item.cessRate === undefined || item.cessRate === null)
  ? '-'
  : `${formatPercent(Number(item.cessRate))}%`;
// Spreads a bill-level discount over the cart in proportion to each line's current discount (or to
// line amounts when nothing is discounted yet), so the relative item-wise split is kept. Works in
// whole paise with largest-remainder rounding so the parts add up exactly to the target, caps each
// line at its own amount (passing any excess on to the other lines), and stores the resulting
// percentage at full precision so the backend recomputes the same paise amount per line.
const distributeBillDiscount = (cart: CartLine[], target: number): CartLine[] => {
  const gross = cart.map((line) => toPaise(baseAmount(line)));
  const current = cart.map((line) => toPaise(discountAmount(line)));
  const amounts = cart.map(() => 0);
  let remaining = Math.min(Math.max(toPaise(target), 0), gross.reduce((sum, value) => sum + value, 0));
  const useCurrentWeights = current.some((value) => value > 0);
  while (remaining > 0) {
    const open = cart.map((_, index) => index).filter((index) => amounts[index] < gross[index]);
    if (!open.length) break;
    let weights = open.map((index) => (useCurrentWeights ? current[index] : gross[index]));
    // Every weighted line is capped: share what's left by the remaining room on the other lines.
    if (weights.every((weight) => weight <= 0)) weights = open.map((index) => gross[index] - amounts[index]);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const raw = weights.map((weight) => remaining * weight / totalWeight);
    const shares = raw.map(Math.floor);
    let leftover = remaining - shares.reduce((sum, share) => sum + share, 0);
    raw.map((value, position) => ({ position, fraction: value - shares[position] }))
      .sort((first, second) => second.fraction - first.fraction)
      .forEach(({ position }) => { if (leftover > 0) { shares[position] += 1; leftover -= 1; } });
    open.forEach((index, position) => {
      const given = Math.min(shares[position], gross[index] - amounts[index]);
      amounts[index] += given;
      remaining -= given;
    });
  }
  return cart.map((line, index) => ({ ...line, discountPercentage: gross[index] ? amounts[index] / gross[index] * 100 : 0 }));
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));
const printHtml = (html: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);
  iframe.onload = () => {
    try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }
    catch { toast.error('Unable to open the print dialog'); }
    window.setTimeout(() => iframe.remove(), 60000);
  };
  iframe.srcdoc = html;
};
const createPaymentRow =(paymentMethodId = 0, amount = 0): PaymentRow => ({ key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, paymentMethodId, amount });
const newTransaction = (id: number, paymentMethodId = 0): Transaction => ({ id, customerId: 0, customerLabel: '', cart: [], payments: [createPaymentRow(paymentMethodId)], roundOff: false });
const mergeWarehouseItems = (warehouseItems: Array<{ warehouseId: number; items: ItemListItem[] }>): PosItem[] => {
  const items = new Map<number, PosItem>();
  warehouseItems.forEach(({ warehouseId, items: warehouseRows }) => warehouseRows.forEach((item) => {
    const current = items.get(item.id) || { ...item, availableQty: 0, warehouseStocks: [] };
    if (!current.warehouseStocks.some((stock) => stock.warehouseId === warehouseId)) {
      current.warehouseStocks.push({ warehouseId, availableQty: Number(item.availableQty || 0) });
    }
    current.availableQty = current.warehouseStocks.reduce((sum, stock) => sum + stock.availableQty, 0);
    current.warehouseId = current.warehouseStocks.find((stock) => stock.availableQty > 0)?.warehouseId || current.warehouseStocks[0]?.warehouseId;
    items.set(item.id, current);
  }));
  return [...items.values()];
};
const allocateLineStock = (line: CartLine) => {
  let remaining = line.quantity;
  const quantities: Record<number, number> = {};
  for (const stock of line.warehouseStocks) {
    const quantity = Math.min(Math.max(stock.availableQty, 0), remaining);
    if (quantity > 0) quantities[stock.warehouseId] = quantity;
    remaining -= quantity;
    if (remaining <= 0) break;
  }
  return quantities;
};

export const PosPage: React.FC = () => {
  const navigate = useNavigate();
  const { navigateToCreate } = useCreateFlowNavigation('/sales/pos');
  const { user, hasPermission } = useAuth();
  // Close returns to the page that was open before POS. React Router keeps a history index in
  // window.history.state.idx; POS's own index is captured on mount (POS stays mounted, hidden, during
  // the create-customer round trip), so Close skips any entries POS pushed and lands on the page
  // before it. If POS was the first page loaded (direct URL / refresh), fall back to the first
  // authorized route other than POS.
  const posEntryIndexRef = useRef<number | null>(null);
  if (posEntryIndexRef.current === null) {
    const index = (window.history.state as { idx?: unknown } | null)?.idx;
    posEntryIndexRef.current = typeof index === 'number' ? index : -1;
  }
  const closePos = () => {
    const entryIndex = posEntryIndexRef.current ?? -1;
    const currentIndex = (window.history.state as { idx?: unknown } | null)?.idx;
    if (entryIndex > 0 && typeof currentIndex === 'number' && currentIndex >= entryIndex) {
      navigate(-(currentIndex - entryIndex + 1));
    } else {
      navigate(getDefaultAuthorizedPath(user?.permissions, user?.role, '/sales/pos'), { replace: true });
    }
  };
  const canCreateCustomer = hasPermission(PERMISSIONS.CUSTOMER_CREATE);
  const { selectedBranchIds, setSelectedBranchIds } = useBranch();
  const { branches, isLoading: branchesLoading } = useBranchAutoSelect();
  const [transactions, setTransactions] = useState<Transaction[]>([newTransaction(1)]);
  const [activeId, setActiveId] = useState(1);
  const [nextId, setNextId] = useState(2);
  const [warehouseId, setWarehouseId] = useState(0);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  // Text being typed into the bill discount box; applied on Enter/blur so intermediate keystrokes
  // (e.g. "6" on the way to "60", or a momentary "0") don't redistribute and lose the item split.
  const [billDiscountDraft, setBillDiscountDraft] = useState<string | null>(null);
  const [billDiscountError, setBillDiscountError] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [topSearch, setTopSearch] = useState('');
  const customerRef = useRef<HTMLDivElement | null>(null);
  const branchRef = useRef<HTMLDivElement | null>(null);
  const scannerInputRef = useRef<HTMLInputElement | null>(null);
  const scannerBufferRef = useRef('');
  const scannerLastKeyAtRef = useRef(0);
  const scannerTimerRef = useRef<number | null>(null);
  const lastScanRef = useRef({ value: '', at: 0 });
  const previousBranchesRef = useRef('');
  const debouncedCustomerSearch = useDebounce(customerSearch);
  const debouncedItemSearch = useDebounce(search);
  const debouncedTopSearch = useDebounce(topSearch);
  const active = transactions.find((transaction) => transaction.id === activeId) || transactions[0];
  // Returns the previous array when the updater changes nothing, so React skips the re-render -
  // effects that call this on every render (e.g. the payment-method default below, whose
  // paymentMethodRows is a new array each render) would otherwise loop forever.
  const updateActive = useCallback((updater: (current: Transaction) => Transaction) => {
    setTransactions((current) => {
      let changed = false;
      const next = current.map((transaction) => {
        if (transaction.id !== activeId) return transaction;
        const updated = updater(transaction);
        if (updated !== transaction) changed = true;
        return updated;
      });
      return changed ? next : current;
    });
  }, [activeId]);

  // POS bills from a single branch. useBranchAutoSelect defaults to the first branch; a selection
  // carried over from other pages with several branches is narrowed to its first one.
  useEffect(() => {
    if (selectedBranchIds.length > 1) setSelectedBranchIds([selectedBranchIds[0]]);
  }, [selectedBranchIds, setSelectedBranchIds]);
  const selectBranch = (branchId: number) => {
    setSelectedBranchIds([branchId]);
    setBranchMenuOpen(false);
  };

  const selectedBranchKey = selectedBranchIds.join(',');
  const branchReady = !branchesLoading && selectedBranchIds.length === 1;
  const warehouses = useQuery({ queryKey: ['pos-warehouses', selectedBranchKey], queryFn: () => warehouseApi.getAll(), enabled: branchReady });
  const paymentMethods = useQuery({ queryKey: ['pos-payment-methods'], queryFn: () => paymentMethodApi.getAll('') });
  const customers = useQuery({ queryKey: ['pos-customers', selectedBranchKey, debouncedCustomerSearch], queryFn: () => customerApi.getAll({ page: 0, size: 100, search: debouncedCustomerSearch }), enabled: branchReady });
  const topSellingQuery = useQuery({ queryKey: ['pos-top-selling-items', selectedBranchKey], queryFn: () => reportsApi.topSellingItems(), enabled: branchReady, retry: false });
  const customerRows = customers.data?.data?.content || [];
  const warehouseRows = warehouses.data?.data || [];
  const paymentMethodRows = (paymentMethods.data?.data?.content || []).filter((method) => method.status === 'ACTIVE');
  const topSellingRows: TopSellingItem[] = topSellingQuery.data?.data || [];

  useEffect(() => {
    if (previousBranchesRef.current && previousBranchesRef.current !== selectedBranchKey) {
      setTransactions((current) => current.map((transaction) => ({ ...transaction, cart: [], payments: [createPaymentRow(transaction.payments[0]?.paymentMethodId)] })));
      setWarehouseId(0);
      if (transactions.some((transaction) => transaction.cart.length > 0)) toast('Branch selection changed. Existing carts were cleared to prevent mixing stock.');
    }
    previousBranchesRef.current = selectedBranchKey;
  }, [selectedBranchKey]);

  useEffect(() => {
    if (!warehouseId && warehouseRows.length) setWarehouseId(warehouseRows[0].id);
  }, [warehouseId, warehouseRows]);

  useEffect(() => {
    if (!paymentMethodRows.length) return;
    updateActive((current) => current.payments.length === 1 && !current.payments[0].paymentMethodId
      ? { ...current, payments: [{ ...current.payments[0], paymentMethodId: paymentMethodRows[0].id }] }
      : current);
  }, [paymentMethodRows, updateActive]);

  useEffect(() => {
    if (active.customerId || !customerRows.length) return;
    const walkIn = customerRows.find((customer) => customer.customerName.trim().toLowerCase() === 'walk-in customer');
    if (walkIn) updateActive((current) => ({ ...current, customerId: walkIn.id, customerLabel: getCustomerLabel(walkIn) }));
  }, [active.customerId, customerRows, updateActive]);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(event.target as Node)) setCustomerMenuOpen(false);
      if (branchRef.current && !branchRef.current.contains(event.target as Node)) setBranchMenuOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

  const itemsQuery = useQuery({
    queryKey: ['pos-items', selectedBranchKey, warehouseRows.map((warehouse) => warehouse.id)],
    queryFn: async () => {
      const result = await Promise.all(warehouseRows.map(async (warehouse) => {
        const response = await itemApi.getAll({ page: 0, size: 200, warehouseId: warehouse.id });
        return { warehouseId: warehouse.id, items: response.data?.content || [] };
      }));
      return mergeWarehouseItems(result);
    },
    enabled: selectedBranchIds.length > 0 && warehouseRows.length > 0,
  });
  const itemRows = itemsQuery.data || [];
  const searchItemsQuery = useQuery({
    queryKey: ['pos-item-search', selectedBranchKey, warehouseRows.map((warehouse) => warehouse.id), debouncedItemSearch.trim()],
    queryFn: async () => (await itemApi.searchPosItems(debouncedItemSearch.trim())).data || [],
    enabled: selectedBranchIds.length > 0 && warehouseRows.length > 0 && debouncedItemSearch.trim().length > 0,
    retry: false,
  });
  const topPanelSearchQuery = useQuery({
    queryKey: ['pos-top-panel-item-search', selectedBranchKey, warehouseRows.map((warehouse) => warehouse.id), debouncedTopSearch.trim()],
    queryFn: async () => (await itemApi.searchPosItems(debouncedTopSearch.trim())).data || [],
    enabled: selectedBranchIds.length > 0 && warehouseRows.length > 0 && debouncedTopSearch.trim().length > 0,
    retry: false,
  });
  const topSellingItems = topSellingRows
    .slice()
    .sort((first, second) => Number(second.quantity || 0) - Number(first.quantity || 0))
    .flatMap((sellingItem) => {
      const item = itemRows.find((candidate) => candidate.id === sellingItem.itemId);
      return item ? [item] : [];
    });
  const visibleItems: PosDisplayItem[] = debouncedTopSearch.trim() ? topPanelSearchQuery.data || [] : topSellingItems;
  const scanMatches = search.trim() ? (searchItemsQuery.data || []).slice(0, 8) : [];

  useEffect(() => {
    if (topSellingQuery.isError) toast.error('Unable to load top-selling items for the selected branches');
  }, [topSellingQuery.isError]);
  useEffect(() => {
    if (customers.isError) toast.error('Unable to load customers');
  }, [customers.isError]);
  useEffect(() => {
    if (itemsQuery.isError) toast.error('Unable to load items for the selected branches');
  }, [itemsQuery.isError]);
  useEffect(() => {
    if (searchItemsQuery.isError) toast.error('Unable to search items for the selected branches');
  }, [searchItemsQuery.isError]);
  useEffect(() => {
    if (topPanelSearchQuery.isError) toast.error('Unable to search items for the selected branches');
  }, [topPanelSearchQuery.isError]);
  useEffect(() => {
    if (topSellingQuery.isSuccess && topSellingRows.length === 0) toast('No top-selling items found for the selected branches');
  }, [topSellingQuery.isSuccess, topSellingRows.length]);

  const addItemToCart = useCallback((item: PosItem) => {
    if (Number(item.availableQty ?? 0) <= 0) { toast.error(`${item.itemName} is out of stock`); return; }
    updateActive((current) => {
      const existing = current.cart.find((line) => line.id === item.id);
      const cart = existing
       ? current.cart.map((line) => line.id === item.id ? { ...line, quantity: Math.min(line.quantity + 1, Number(line.availableQty ?? 0)) } : line)
       : [...current.cart, { ...item, availableQty: Number(item.availableQty ?? 0), discountPercentage: Number(item.discountPercentage || 0), quantity: 1 }];
      return { ...current, cart };
    });
    setSearch('');
  }, [updateActive]);

  const scanItem = useMutation({
    mutationFn: async (value: string) => {
      const trimmed = value.trim();
      if (/^\d+$/.test(trimmed)) {
       const cached = itemRows.find((item) => item.id === Number(trimmed));
       if (cached) return cached;
       const rows = await itemApi.searchPosItems(trimmed);
       return (rows.data || []).find((item) => item.id === Number(trimmed)) || null;
      }
      const rows = await itemApi.searchPosItems(trimmed);
      const matches = rows.data || [];
      const lowered = trimmed.toLowerCase();
      return matches.find((item) => item.itemName.toLowerCase() === lowered) || matches[0] || null;
    },
    onSuccess: (item) => {
      if (!item) { toast.error('No matching item found for selected branches'); return; }
      addItemToCart(item);
    },
    onError: (error: any) => toast.error(error?.message || 'Item lookup failed'),
  });

  const submitScan = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const now = Date.now();
    if (lastScanRef.current.value === trimmed && now - lastScanRef.current.at < 500) return;
    lastScanRef.current = { value: trimmed, at: now };
    scanItem.mutate(trimmed);
  }, [scanItem]);

  useEffect(() => {
    const clearBuffer = () => {
      scannerBufferRef.current = '';
      scannerLastKeyAtRef.current = 0;
      if (scannerTimerRef.current) window.clearTimeout(scannerTimerRef.current);
      scannerTimerRef.current = null;
    };
    const flush = () => { const value = scannerBufferRef.current; clearBuffer(); if (value) submitScan(value); };
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const element = document.activeElement as HTMLElement | null;
      const editable = ['input', 'textarea', 'select'].includes(element?.tagName.toLowerCase() || '') || Boolean(element?.isContentEditable);
      if (editable && element !== scannerInputRef.current) return;
      if (event.key === 'Enter' || event.key === 'Tab') { if (scannerBufferRef.current) { event.preventDefault(); flush(); } return; }
      if (event.key.length !== 1) return;
      const now = Date.now();
      if (scannerLastKeyAtRef.current && now - scannerLastKeyAtRef.current > 120) scannerBufferRef.current = '';
      scannerBufferRef.current += event.key;
      scannerLastKeyAtRef.current = now;
      if (scannerTimerRef.current) window.clearTimeout(scannerTimerRef.current);
      scannerTimerRef.current = window.setTimeout(flush, 220);
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearBuffer(); };
  }, [submitScan]);

  const totalQuantity = active.cart.reduce((sum, line) => sum + line.quantity, 0);
  const totalDiscount = active.cart.reduce((sum, line) => sum + discountAmount(line), 0);
  const totalPrice = active.cart.reduce((sum, line) => sum + baseAmount(line), 0);
  const totalGst = active.cart.reduce((sum, line) => sum + gstAmount(line), 0);
  const totalCess = active.cart.reduce((sum, line) => sum + cessAmount(line), 0);
  const totalTax = totalGst + totalCess;
  const total = active.cart.reduce((sum, line) => sum + lineTotal(line), 0);
  const grandTotal = active.roundOff ? Math.round(total) : total;
  const roundOffAmount = grandTotal - total;
  const totalPaid = active.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const amountMismatch = Math.round((totalPaid - grandTotal) * 100) / 100;
  const isPaymentWithinGrandTotal = amountMismatch <= 0.005;
  const remainingAmount = Math.max(0, -amountMismatch);
  // Discounts may not push the bill below what the items cost to buy. Compared before tax on both
  // sides (purchasePrice excludes tax), since GST/cess collected is passed on, not earned.
  const totalPurchaseCost = active.cart.reduce((sum, line) => sum + toPaise(Number(line.purchasePrice || 0) * line.quantity), 0) / 100;
  const isBelowPurchaseCost = active.cart.length > 0 && toPaise(totalPrice - totalDiscount) < toPaise(totalPurchaseCost);
  const purchaseCostError = `Price after discount can't be less than the purchase price of the items (₹${formatMoney(totalPurchaseCost)}).`;
  useEffect(() => {
    updateActive((current) => current.payments.length === 1
      ? { ...current, payments: [{ ...current.payments[0], amount: grandTotal }] }
      : current);
  }, [grandTotal, updateActive]);

  useEffect(() => { setBillDiscountError(''); }, [activeId]);
  const applyBillDiscount = () => {
    if (billDiscountDraft === null) return;
    const text = billDiscountDraft.trim();
    setBillDiscountDraft(null);
    const target = text === '' ? 0 : Number(text);
    if (!Number.isFinite(target) || target < 0) { setBillDiscountError('Enter a valid discount amount.'); return; }
    if (toPaise(target) > toPaise(totalPrice)) { setBillDiscountError("Discount can't exceed the total price."); return; }
    if (toPaise(totalPrice - target) < toPaise(totalPurchaseCost)) { setBillDiscountError(purchaseCostError); return; }
    setBillDiscountError('');
    if (toPaise(target) === toPaise(totalDiscount)) return;
    updateActive((current) => ({ ...current, cart: distributeBillDiscount(current.cart, target) }));
  };

  const updatePaymentRow = (key: string, patch: Partial<PaymentRow>) => {
    updateActive((current) => ({ ...current, payments: current.payments.map((payment) => payment.key === key ? { ...payment, ...patch } : payment) }));
  };
  // One row per payment method: a method used in one row can't be picked in another, so rows are
  // capped at the number of active methods.
  const canAddPayment = active.payments.length < paymentMethodRows.length;
  const addPaymentRow = () => updateActive((current) => {
    if (current.payments.length >= paymentMethodRows.length) return current;
    const unusedMethod = paymentMethodRows.find((method) => !current.payments.some((payment) => payment.paymentMethodId === method.id));
    return { ...current, payments: [...current.payments, createPaymentRow(unusedMethod?.id || 0, remainingAmount)] };
  });
  const removePaymentRow = (key: string) => updateActive((current) => ({
    ...current,
    payments: current.payments.length === 1 ? [createPaymentRow()] : current.payments.filter((payment) => payment.key !== key),
  }));

  const billing = useMutation({
    mutationFn: () => posApi.createBill({
      customerId: active.customerId,
      warehouseId,
      grandTotal,
      dueAmount: remainingAmount,
      paymentMethodId: active.payments[0]?.paymentMethodId || 0,
      amountPaid: totalPaid,
      payments: active.payments.map((payment) => ({
        paymentMethodId: payment.paymentMethodId,
        amount: payment.amount,
      })),
      items: active.cart.map((line) => ({ itemId: line.id, quantity: line.quantity, discountPercent: Number(line.discountPercentage || 0), warehouseQuantities: allocateLineStock(line) })),
    }),
    onSuccess: () => toast.success('POS bill created successfully'),
    onError: (error: any) => toast.error(error?.message || 'Failed to create POS bill'),
  });
  const canSubmitBill = Boolean(active.customerId)
    && Boolean(warehouseId)
    && active.cart.length > 0
    && active.cart.every((line) => line.quantity > 0 && line.quantity <= Number(line.availableQty ?? 0))
    && active.cart.every((line) => Object.values(allocateLineStock(line)).reduce((sum, quantity) => sum + quantity, 0) === line.quantity)
    && active.payments.length > 0
    && active.payments.every((payment) => Boolean(payment.paymentMethodId) && payment.amount > 0)
    && isPaymentWithinGrandTotal
    && !isBelowPurchaseCost;

  const printReceipt = async (saleId: number) => {
    const blob = await posApi.downloadReceiptPdf(saleId);
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }
      catch { window.open(url, '_blank', 'noopener,noreferrer'); }
      window.setTimeout(() => { iframe.remove(); URL.revokeObjectURL(url); }, 60000);
    };
    iframe.src = url;
  };

  const submitBill = async () => {
    if (!active.customerId) return toast.error('Please select a customer');
    if (!warehouseId) return toast.error('Please select a warehouse');
    if (!active.cart.length) return toast.error('Please add at least one item');
    if (active.cart.some((line) => line.quantity <= 0 || line.quantity > Number(line.availableQty ?? 0))) return toast.error('Check item quantities and available stock');
    if (active.cart.some((line) => Object.values(allocateLineStock(line)).reduce((sum, quantity) => sum + quantity, 0) !== line.quantity)) return toast.error('Selected branches do not have enough stock');
    if (active.payments.some((payment) => !payment.paymentMethodId)) return toast.error('Please select a payment method for every payment row');
    if (active.payments.some((payment) => payment.amount <= 0)) return toast.error('Each payment row must have an amount greater than 0');
    if (isBelowPurchaseCost) return toast.error(purchaseCostError);
    if (!isPaymentWithinGrandTotal) return toast.error(`Paid amount exceeds the total by ₹${formatMoney(amountMismatch)}.`);
    try {
      const response = await billing.mutateAsync();
      const saleId = response.data?.saleId;
      if (saleId) {
        updateActive((current) => ({ ...current, cart: [], payments: [createPaymentRow(current.payments[0]?.paymentMethodId)], lastSaleId: saleId }));
        try { await printReceipt(saleId); }
        catch (error: any) { toast.error(error?.message || 'Bill saved, but failed to open receipt for printing'); }
      }
    } catch { /* Mutation handler reports the API error. */ }
  };

  const addTransaction = () => {
    const id = nextId;
    setNextId((current) => current + 1);
    setTransactions((current) => [...current, newTransaction(id, paymentMethodRows[0]?.id || 0)]);
    setActiveId(id);
    setSearch('');
  };
  // Prints only the active transaction: an unsaved cart prints as a draft receipt, otherwise the
  // receipt of the bill last saved from this tab is reprinted.
  const printDraftReceipt = () => {
    const methodName = (id: number) => paymentMethodRows.find((method) => method.id === id)?.name || '-';
    const row = (label: string, value: string, bold = false) => `<tr${bold ? ' class="b"' : ''}><td>${label}</td><td class="r">${value}</td></tr>`;
    printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title><style>
      body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:0;padding:12px;width:280px}
      h1{font-size:15px;text-align:center;margin:0 0 2px}.c{text-align:center;color:#555;margin:0 0 8px}
      table{width:100%;border-collapse:collapse}td,th{padding:3px 0;vertical-align:top}th{text-align:left;border-bottom:1px dashed #999}
      .r{text-align:right}.b td{font-weight:bold;font-size:13px}hr{border:0;border-top:1px dashed #999;margin:6px 0}
    </style></head><body>
      <h1>${escapeHtml(selectedBranchLabel || 'Receipt')}</h1>
      <p class="c">Draft receipt - not saved<br>${escapeHtml(new Date().toLocaleString('en-IN'))}</p>
      <p>Customer: ${escapeHtml(active.customerLabel || '-')}</p>
      <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Amount</th></tr></thead><tbody>
        ${active.cart.map((line) => `<tr><td>${escapeHtml(line.itemName)}<br><small>@ ${formatMoney(line.salePrice)}${Number(line.discountPercentage || 0) ? ` - ${formatPercent(Number(line.discountPercentage))}%` : ''}</small></td><td class="r">${line.quantity}</td><td class="r">${formatMoney(lineTotal(line))}</td></tr>`).join('')}
      </tbody></table><hr><table>
        ${row('Total Quantity', String(totalQuantity))}${row('Total Price', formatMoney(totalPrice))}${row('Total Discount', formatMoney(totalDiscount))}${row('Total Tax', formatMoney(totalTax))}
        ${active.roundOff ? row('Round Off', formatMoney(roundOffAmount)) : ''}${row('Grand Total', `&#8377; ${formatMoney(grandTotal)}`, true)}
      </table><hr><table>
        ${active.payments.filter((payment) => payment.amount > 0).map((payment) => row(escapeHtml(methodName(payment.paymentMethodId)), formatMoney(payment.amount))).join('')}
        ${row('Total Paid', formatMoney(totalPaid))}${row('Remaining', formatMoney(remainingAmount))}
      </table></body></html>`);
  };
  const printCurrentTransaction = async () => {
    if (active.cart.length) { printDraftReceipt(); return; }
    if (!active.lastSaleId) { toast.error('Add items or save a bill in this transaction before printing'); return; }
    try { await printReceipt(active.lastSaleId); }
    catch (error: any) { toast.error(error?.message || 'Failed to open receipt for printing'); }
  };
  const selectedBranchLabel = branches.filter((branch) => selectedBranchIds.includes(branch.id)).map((branch) => branch.branchName).join(', ');
  const removeTransaction = (id: number) => {
    if (transactions.length === 1) { setTransactions([newTransaction(nextId, paymentMethodRows[0]?.id || 0)]); setNextId((current) => current + 1); setActiveId(nextId); return; }
    const index = transactions.findIndex((transaction) => transaction.id === id);
    const remaining = transactions.filter((transaction) => transaction.id !== id);
    setTransactions(remaining);
    if (activeId === id) setActiveId(remaining[Math.max(0, index - 1)].id);
  };
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-sky-50 text-slate-700">
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className="flex h-[38vh] min-h-[230px] max-h-[360px] w-full shrink-0 flex-col border-b border-slate-200 bg-white lg:h-auto lg:min-h-0 lg:max-h-none lg:w-[280px] lg:border-b-0 lg:border-r xl:w-[300px]">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-sky-50 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-500"><Flame size={21} /></span>
            <div><h2 className="font-bold text-slate-800">Top Selling Items</h2><p className="text-xs text-slate-500">Click item to quick add</p></div>
          </div>
          <div className="border-b border-slate-200 p-3">
            <div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={17} /><input value={topSearch} onChange={(event) => setTopSearch(event.target.value)} className={`${controlClass} pl-10`} placeholder="Search item..." /></div>
          </div>
          <div className={`grid min-h-0 flex-1 grid-cols-3 content-start gap-2 overflow-y-auto p-2 ${hideScrollbarClass}`}>
            {topSellingQuery.isLoading || itemsQuery.isLoading || warehouses.isLoading || (debouncedTopSearch.trim() && topPanelSearchQuery.isLoading) ? <div className="col-span-3 flex justify-center p-8"><Loader2 className="animate-spin text-teal-600" /></div> : visibleItems.length ? visibleItems.map((item) => {
              const image = getImage(item);
              return <button key={item.id} type="button" title={item.itemName} onClick={() => addItemToCart(item)} disabled={Number(item.availableQty ?? 0) <= 0} className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left transition hover:border-teal-300 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50">
                <span className="relative flex aspect-square w-full shrink-0 items-center justify-center bg-white text-slate-300"><Box size={24} className={image ? 'absolute hidden' : ''} />{image && <img src={image} alt={item.itemName} onError={(event) => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement?.querySelector('svg')?.classList.remove('hidden'); }} className="relative h-full w-full object-contain p-1" />}</span>
                <span className="line-clamp-2 h-9 w-full px-1.5 py-1 text-center text-xs font-semibold leading-tight text-slate-800">{item.itemName}</span>
              </button>;
            }) : <p className="col-span-3 py-8 text-center text-sm text-slate-500">{topSellingQuery.isError || itemsQuery.isError || topPanelSearchQuery.isError ? 'Unable to load selected-branch items' : debouncedTopSearch.trim() ? 'No matching items' : 'No matching top-selling items'}</p>}
          </div>
          <div className="flex justify-between border-t border-slate-200 bg-sky-50 px-3 py-3 text-xs text-slate-500"><span>Quick Items: {visibleItems.length}</span><span className="font-medium text-emerald-600">⚡ Instant Sync</span></div>
        </aside>

        <section className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden ${hideScrollbarClass}`}>
          <div className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white">
            <div className="flex items-end gap-2 bg-slate-200/70 px-2 pt-2">
              <div className="relative mb-1.5 shrink-0" ref={branchRef}>
                <button type="button" onClick={() => setBranchMenuOpen((open) => !open)} disabled={branchesLoading || branches.length <= 1} aria-haspopup="listbox" aria-expanded={branchMenuOpen} title={branches.length > 1 ? 'Change branch' : selectedBranchLabel} className={`flex h-7 max-w-[220px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition disabled:cursor-default ${branchMenuOpen ? 'border-teal-400 bg-teal-50 text-teal-700 ring-2 ring-teal-100' : 'border-teal-200 bg-white text-teal-700 enabled:hover:border-teal-300 enabled:hover:bg-teal-50'}`}>
                  <GitBranch size={13} className="shrink-0" />
                  <span className="truncate">{selectedBranchLabel || (branchesLoading ? 'Loading...' : 'Select branch')}</span>
                  {branches.length > 1 && <ChevronDown size={13} className={`shrink-0 transition-transform ${branchMenuOpen ? 'rotate-180' : ''}`} />}
                </button>
                {branchMenuOpen && <div role="listbox" aria-label="Branch" className="absolute left-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                  <p className="border-b border-slate-100 bg-sky-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Billing branch</p>
                  <div className="max-h-64 overflow-y-auto p-1.5">
                    {branches.map((branch) => {
                      const selected = selectedBranchIds[0] === branch.id;
                      return <button key={branch.id} type="button" role="option" aria-selected={selected} onClick={() => selectBranch(branch.id)} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${selected ? 'bg-teal-50 font-semibold text-teal-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-400'}`}><GitBranch size={14} /></span>
                        <span className="min-w-0 flex-1 truncate">{branch.branchName}</span>
                        {selected && <Check size={15} className="shrink-0 text-teal-600" />}
                      </button>;
                    })}
                  </div>
                </div>}
              </div>
              <div className="flex min-w-0 flex-1 items-end overflow-x-auto" role="tablist" aria-label="Transactions">
                {transactions.map((transaction, index) => {
                  const isActive = activeId === transaction.id;
                  const showDivider = !isActive && index < transactions.length - 1 && transactions[index + 1].id !== activeId;
                  return <div key={transaction.id} role="tab" aria-selected={isActive} className={`group relative flex h-9 min-w-[130px] max-w-[210px] flex-1 basis-0 items-center rounded-t-lg pl-3 pr-1.5 text-sm transition-colors ${isActive ? 'z-10 bg-white font-semibold text-teal-700 shadow-[0_-1px_4px_rgba(15,23,42,0.08)]' : 'text-slate-600 hover:bg-white/60'}`}>
                    <button type="button" onClick={() => setActiveId(transaction.id)} className="flex h-full min-w-0 flex-1 items-center gap-2 text-left">
                      <ReceiptText size={14} className={`shrink-0 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                      <span className="truncate">Transaction {transaction.id}</span>
                      {transaction.cart.length > 0 && <span className={`shrink-0 rounded-full px-1.5 text-[10px] font-bold leading-4 ${isActive ? 'bg-teal-100 text-teal-700' : 'bg-slate-300/70 text-slate-600'}`}>{transaction.cart.length}</span>}
                    </button>
                    <button type="button" onClick={() => removeTransaction(transaction.id)} className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700" aria-label={`Close transaction ${transaction.id}`} title="Close transaction"><X size={12} /></button>
                    {showDivider && <span className="pointer-events-none absolute right-0 top-2 h-5 w-px bg-slate-300 group-hover:opacity-0" />}
                  </div>;
                })}
                <button type="button" onClick={addTransaction} className="mb-1 ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-white/70 hover:text-teal-700" title="New transaction" aria-label="New transaction"><Plus size={16} /></button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 p-3 xl:grid-cols-[minmax(250px,0.8fr)_minmax(320px,1.7fr)]">
              <div className="relative" ref={customerRef}>
                <div className="flex">
                  <button type="button" onClick={() => { setCustomerMenuOpen((open) => !open); setCustomerSearch(''); }} className={`${controlClass} flex items-center gap-3 text-left ${canCreateCustomer ? 'rounded-r-none' : ''}`}><UserRound size={17} className="shrink-0 text-slate-400" /><span className={`flex-1 truncate ${active.customerLabel ? 'text-slate-800' : 'text-slate-400'}`}>{active.customerLabel || 'Select customer'}</span>{customers.isFetching ? <Loader2 className="animate-spin" size={16} /> : <ChevronDown size={17} />}</button>
                  {canCreateCustomer && <button type="button" onClick={() => navigateToCreate('/contacts/customers/create')} className="h-10 w-11 rounded-r border border-l-0 border-teal-400 text-teal-600 hover:bg-teal-50" title="Create customer"><Plus size={18} className="mx-auto" /></button>}
                </div>
                {customerMenuOpen && <div className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-auto rounded border border-teal-300 bg-white shadow-xl">
                  <div className="sticky top-0 bg-white p-2"><input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} className={`${controlClass} h-9`} placeholder="Search customer" autoFocus /></div>
                  {customerRows.map((customer) => <button key={customer.id} type="button" onClick={() => { updateActive((current) => ({ ...current, customerId: customer.id, customerLabel: getCustomerLabel(customer) })); setCustomerMenuOpen(false); }} className="block w-full border-t border-slate-100 px-4 py-3 text-left text-sm hover:bg-teal-50">{getCustomerLabel(customer)}</button>)}
                  {!customerRows.length && <p className="p-4 text-sm text-slate-500">No customers found</p>}
                </div>}
              </div>
              <div className="relative"><PackageSearch className="absolute left-3 top-3 text-teal-600" size={17} /><input ref={scannerInputRef} value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && search.trim()) { event.preventDefault(); submitScan(search); } }} onPaste={(event) => { const value = event.clipboardData.getData('text'); if (value.trim()) window.setTimeout(() => submitScan(value), 0); }} className={`${controlClass} border-2 border-teal-500 pl-10`} placeholder="Scan / Search Item" />{scanItem.isPending && <Loader2 className="absolute right-3 top-3 animate-spin text-teal-600" size={17} />}{scanMatches.length > 0 && <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded border border-slate-200 bg-white shadow-xl">{scanMatches.map((item) => <button key={item.id} type="button" onClick={() => { addItemToCart(item); setSearch(''); }} className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-2.5 text-left text-sm last:border-0 hover:bg-teal-50"><span className="truncate">{item.itemName}</span><span className="ml-3 shrink-0 font-semibold text-emerald-600">₹ {formatMoney(item.salePrice)}</span></button>)}</div>}</div>
            </div>
          </div>

          <div className="shrink-0 p-3">
            <div className={`max-h-[50vh] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${hideScrollbarClass}`}>
              <table className="w-full border-separate border-spacing-0 text-xs">
                <thead><tr className="bg-sky-50 text-[11px] uppercase tracking-wide text-slate-600">
                  {['#', 'ITEM DETAILS', 'QTY', 'PRICE (₹)', 'DISC. (%)', 'GST (%)', 'CESS (%)', 'AMOUNT (₹)', 'ACTION'].map((label) => <th key={label} className="sticky top-0 z-10 whitespace-nowrap border-b border-r border-slate-200 bg-slate-100 px-2 py-3 text-left font-bold last:border-r-0">{label}</th>)}
                </tr></thead>
                <tbody>{active.cart.length ? active.cart.map((line, index) => <tr key={line.id} className="border-b border-slate-100 hover:bg-teal-50/40">
                  <td className="border-r border-slate-100 px-2 py-3">{index + 1}</td>
                  <td className="border-r border-slate-100 px-2 py-3"><div className="flex items-center gap-2"><div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border bg-slate-50">{getImage(line) ? <img src={getImage(line)} alt={line.itemName} className="h-full w-full object-cover" /> : <Box size={16} />}</div><span className="line-clamp-2 font-semibold text-slate-800">{line.itemName}</span></div></td>
                  <td className="border-r border-slate-100 px-2 py-3"><div className="inline-flex h-8 items-center rounded border"><button type="button" onClick={() => updateActive((current) => ({ ...current, cart: current.cart.map((item) => item.id === line.id ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item) }))} className="px-2"><Minus size={12} /></button><NumericInput min={1} max={line.availableQty} integer value={line.quantity} onValueChange={(value) => updateActive((current) => ({ ...current, cart: current.cart.map((item) => item.id === line.id ? { ...item, quantity: Math.max(1, Math.min(value, Number(item.availableQty ?? 0))) } : item) }))} containerClassName="w-10" className="h-8 rounded-none border-0 px-0 text-center text-xs" /><button type="button" onClick={() => updateActive((current) => ({ ...current, cart: current.cart.map((item) => item.id === line.id ? { ...item, quantity: Math.min(Number(item.availableQty ?? 0), item.quantity + 1) } : item) }))} className="px-2"><Plus size={12} /></button></div></td>
                  <td className="border-r border-slate-100 px-2 py-3 text-right">{formatMoney(line.salePrice)}</td>
                  <td className="border-r border-slate-100 px-2 py-3"><NumericInput min={0} max={100} value={formatPercent(Number(line.discountPercentage || 0))} onValueChange={(value) => updateActive((current) => ({ ...current, cart: current.cart.map((item) => item.id === line.id ? { ...item, discountPercentage: Math.max(0, Math.min(value, 100)) } : item) }))} containerClassName="w-16" className="h-8 px-2 text-right text-xs" /></td>
                  <td className="whitespace-nowrap border-r border-slate-100 px-2 py-3 text-right" title={line.gstRateName || undefined}>{gstLabel(line)}</td>
                  <td className="whitespace-nowrap border-r border-slate-100 px-2 py-3 text-right">{cessLabel(line)}</td>
                  <td className="border-r border-slate-100 px-2 py-3 text-right font-bold" title={`Taxable ₹${formatMoney(taxableAmount(line))} + GST ₹${formatMoney(gstAmount(line))} + Cess ₹${formatMoney(cessAmount(line))}`}>{formatMoney(lineTotal(line))}</td><td className="px-2 py-3 text-center"><button type="button" onClick={() => updateActive((current) => ({ ...current, cart: current.cart.filter((item) => item.id !== line.id) }))} className="text-red-500" title="Remove item"><Trash2 size={15} /></button></td>
                </tr>) : <tr><td colSpan={10} className="py-12 text-center italic text-slate-500">No items are added yet!!</td></tr>}</tbody>
              </table>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white p-3">
            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
              <div className="flex w-full flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800">Payment</h3>
                  <button type="button" onClick={addPaymentRow} disabled={!canAddPayment} title={canAddPayment ? 'Add another payment method' : 'All payment methods are already added'} className="inline-flex h-8 items-center gap-1 rounded-md border border-dashed border-teal-300 px-3 text-xs font-semibold text-teal-600 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent"><Plus size={14} />Add Payment Method</button>
                </div>
                <div className="grid grid-cols-[1fr_1fr_32px] gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <span>Payment Method</span>
                  <span>Amount Paid</span>
                  <span />
                </div>
                <div className="flex flex-col gap-2">
                  {active.payments.map((payment) => <div key={payment.key} className="grid grid-cols-[1fr_1fr_32px] items-center gap-2">
                    <select value={payment.paymentMethodId} onChange={(event) => updatePaymentRow(payment.key, { paymentMethodId: Number(event.target.value) })} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
                      <option value={0}>Choose</option>
                      {paymentMethodRows.map((method) => <option key={method.id} value={method.id} disabled={method.id !== payment.paymentMethodId && active.payments.some((row) => row.paymentMethodId === method.id)}>{method.name}</option>)}
                    </select>
                    <NumericInput min={0} value={payment.amount || ''} onValueChange={(value) => updatePaymentRow(payment.key, { amount: value })} placeholder="0.00" className="h-10 w-full rounded-md border-slate-200 text-sm font-semibold text-slate-700" />
                    <button type="button" onClick={() => removePaymentRow(payment.key)} className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-400 transition hover:border-red-300 hover:text-red-500" title="Remove payment"><Trash2 size={15} /></button>
                  </div>)}
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Total Paid</p>
                    <p className="text-base font-bold text-emerald-700">₹ {formatMoney(totalPaid)}</p>
                  </div>
                  <div className={`rounded-md border px-3 py-2 ${remainingAmount > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide">Remaining</p>
                    <p className="text-base font-bold">₹ {formatMoney(remainingAmount)}</p>
                  </div>
                </div>
                {amountMismatch > 0.005 && <p className="-mt-1 text-xs font-medium text-rose-600">Paid amount exceeds the grand total by ₹ {formatMoney(amountMismatch)}</p>}
              </div>
              <div className="flex w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white lg:max-w-[440px] lg:justify-self-end">
                <div className="flex items-center justify-between border-b border-slate-100 bg-sky-50 px-4 py-2.5">
                  <h3 className="text-sm font-bold text-slate-800">Summary</h3>
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={active.roundOff} onChange={(event) => updateActive((current) => ({ ...current, roundOff: event.target.checked }))} className="accent-teal-600" />Round Off</label>
                </div>
                <dl className="space-y-1.5 px-4 py-3 text-sm">
                  <div className="flex justify-between"><dt className="text-slate-500">Total Quantity</dt><dd className="font-semibold text-slate-800">{totalQuantity}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Total Price</dt><dd className="font-semibold text-slate-800">₹ {formatMoney(totalPrice)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Total Tax<span className="ml-1.5 text-xs text-slate-400">(GST ₹ {formatMoney(totalGst)} + Cess ₹ {formatMoney(totalCess)})</span></dt><dd className="font-semibold text-slate-800">₹ {formatMoney(totalTax)}</dd></div>
                  <div className="flex items-center justify-between gap-3">
                    <dt><label htmlFor="pos-bill-discount" className="text-slate-500">Total Discount</label></dt>
                    <dd className="flex items-center gap-1 font-semibold text-rose-600">
                      <span>- ₹</span>
                      <input
                        id="pos-bill-discount"
                        type="text"
                        inputMode="decimal"
                        value={billDiscountDraft ?? totalDiscount.toFixed(2)}
                        disabled={!active.cart.length}
                        aria-invalid={Boolean(billDiscountError) || undefined}
                        aria-describedby={billDiscountError ? 'pos-bill-discount-error' : undefined}
                        onFocus={(event) => { setBillDiscountDraft(totalDiscount.toFixed(2)); event.currentTarget.select(); }}
                        onChange={(event) => { if (/^\d*\.?\d{0,2}$/.test(event.target.value)) { setBillDiscountDraft(event.target.value); setBillDiscountError(''); } }}
                        onBlur={applyBillDiscount}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') event.currentTarget.blur();
                          if (event.key === 'Escape') { setBillDiscountDraft(null); window.setTimeout(() => (event.target as HTMLInputElement).blur(), 0); }
                        }}
                        title="Edit to spread a bill discount across the items"
                        className="h-8 w-28 rounded-md border border-rose-200 bg-rose-50/40 px-2 text-right text-sm font-semibold text-rose-600 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </dd>
                  </div>
                  {billDiscountError && <p id="pos-bill-discount-error" role="alert" className="text-right text-xs font-medium text-red-600">{billDiscountError}</p>}
                  {active.roundOff && <div className="flex justify-between"><dt className="text-slate-500">Round Off</dt><dd className="font-semibold text-slate-800">{roundOffAmount < 0 ? '- ' : ''}₹ {formatMoney(Math.abs(roundOffAmount))}</dd></div>}
                </dl>
                <div className="mx-4 flex items-center justify-between rounded-md bg-teal-600 px-3 py-2.5 text-white">
                  <span className="text-sm font-semibold">Grand Total</span><span className="text-xl font-bold">₹ {formatMoney(grandTotal)}</span>
                </div>
                {isBelowPurchaseCost && billDiscountError !== purchaseCostError && <p role="alert" className="mx-4 mt-1.5 text-xs font-medium text-red-600">{purchaseCostError}</p>}
                <div className="grid grid-cols-3 gap-2 px-4 pb-4 pt-2">
                  <button type="button" onClick={closePos} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100"><X size={15} />Close</button>
                  <button type="button" onClick={printCurrentTransaction} disabled={!active.cart.length && !active.lastSaleId} title={!active.cart.length && !active.lastSaleId ? 'Add items or save a bill to print' : 'Print receipt for this transaction'} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-teal-600 px-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"><Printer size={15} />Print</button>
                  <button type="button" onClick={submitBill} disabled={!canSubmitBill || billing.isPending} className="inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-green-500 px-2 text-sm font-semibold text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60">{billing.isPending ? <Loader2 className="animate-spin" size={15} /> : <Printer size={15} />}Save &amp; Print</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

    </div>
  );
};
