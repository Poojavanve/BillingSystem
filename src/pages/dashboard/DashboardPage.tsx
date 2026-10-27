import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownCircle,
  ArrowUp,
  ArrowUpCircle,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  PackageSearch,
  ShoppingBag,
  ShoppingCart,
  Tags,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  BarChart2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  dashboardApi,
  expenseApi,
  purchaseApi,
  reportsApi,
  salesApi,
} from '../../api/endpoints';
import { PERMISSIONS } from '../../auth/permissions';
import { isSuperAdminRole } from '../../auth/featurePermissions';
import { useAuth } from '../../hooks/useAuth';
import { useBranch } from '../../hooks/useBranch';
import type {
  DashboardLowStockItem,
  DashboardRecentInvoice,
  DashboardTrendingItem,
  PurchaseListItem,
  SaleListItem,
} from '../../types/api.types';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { DateRangeFields } from '../../components/form/DateRangeFields';
import { Loader } from '../../components/ui/Loader';

const TREND_COLORS = ['#f70768', '#ff5b16', '#5856d6', '#16a8e2', '#22c55e', '#f5b800'];

const numberValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isCompleted = (status?: string, balance?: number) => {
  const normalized = status?.toUpperCase() || '';
  return ['PAID', 'COMPLETED', 'COMPLETE', 'CLOSED'].includes(normalized) || numberValue(balance) <= 0;
};

const isConfirmedPurchase = (status?: string) => (status?.toUpperCase() || '') === 'CONFIRMED';

type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last7Days'
  | 'custom';

type FixedDatePreset = Exclude<DatePreset, 'custom'>;
type TrendGranularity = 'day' | 'month';

interface DashboardDateRange {
  fromDate: string;
  toDate: string;
  label: string;
}

interface TrendBucket {
  key: string;
  label: string;
  granularity: TrendGranularity;
}

const DEFAULT_DATE_PRESET: FixedDatePreset = 'today';

const DATE_PRESET_OPTIONS: Array<{ value: DatePreset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7Days', label: 'Last 7 Days' },
  { value: 'custom', label: 'Custom' },
];

const dateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const monthInputKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const tryParseDateInput = (value?: string) => {
  const token = value?.slice(0, 10) || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(token)) return null;
  const [year, month, day] = token.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
};

const parseDateInput = (value: string) => tryParseDateInput(value) || new Date();

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const normalizeDateRange = (fromDate: string, toDate: string, label: string): DashboardDateRange => {
  const from = parseDateInput(fromDate);
  const to = parseDateInput(toDate);
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  return { fromDate: dateInputValue(start), toDate: dateInputValue(end), label };
};

const getPresetDateRange = (preset: FixedDatePreset): DashboardDateRange => {
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let start = current;
  let end = current;
  const label = DATE_PRESET_OPTIONS.find((option) => option.value === preset)?.label || 'Date Range';

  if (preset === 'last7Days') {
    start = addDays(current, -6);
  } else if (preset === 'yesterday') {
    start = addDays(current, -1);
    end = start;
  }

  return { fromDate: dateInputValue(start), toDate: dateInputValue(end), label };
};

const buildTrendBuckets = (fromDate: string, toDate: string): TrendBucket[] => {
  const start = parseDateInput(fromDate);
  const end = parseDateInput(toDate);
  const orderedStart = start <= end ? start : end;
  const orderedEnd = start <= end ? end : start;
  const dayCount = Math.round((orderedEnd.getTime() - orderedStart.getTime()) / 86400000) + 1;
  const granularity: TrendGranularity = dayCount <= 45 ? 'day' : 'month';
  const buckets: TrendBucket[] = [];

  if (granularity === 'day') {
    for (let date = new Date(orderedStart); date <= orderedEnd; date = addDays(date, 1)) {
      buckets.push({
        key: dateInputValue(date),
        label: formatDate(dateInputValue(date)),
        granularity,
      });
    }
    return buckets;
  }

  for (
    let date = new Date(orderedStart.getFullYear(), orderedStart.getMonth(), 1);
    date <= new Date(orderedEnd.getFullYear(), orderedEnd.getMonth(), 1);
    date = new Date(date.getFullYear(), date.getMonth() + 1, 1)
  ) {
    buckets.push({
      key: monthInputKey(date),
      label: formatDate(dateInputValue(date)),
      granularity,
    });
  }
  return buckets;
};

const trendBucketKey = (value: string | undefined, granularity: TrendGranularity) => {
  const date = tryParseDateInput(value);
  if (!date) return '';
  return granularity === 'day' ? dateInputValue(date) : monthInputKey(date);
};

const metricValue = (value: number, currency = false) =>
  currency ? formatCurrency(numberValue(value)) : numberValue(value).toLocaleString('en-IN');

/* ── Metric Card ── */
interface MetricCardProps {
  title: string;
  value: number;
  color: string;
  icon: React.ReactNode;
  currency?: boolean;
  subLabel?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, color, icon, currency = false, subLabel }) => (
  <div
    className="flex min-h-[88px] items-center justify-between rounded-xl bg-white px-4 py-3 shadow-[0_2px_10px_rgba(79,70,229,0.10)] dark:bg-[#111827]"
  >
    <div>
      <p className="max-w-[130px] text-[11px] leading-5 text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-0.5 text-[19px] font-bold leading-tight" style={{ color }}>{metricValue(value, currency)}</p>
      {subLabel && <p className="mt-0.5 text-[10px] text-slate-400">{subLabel}</p>}
    </div>
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow"
      style={{ background: `linear-gradient(145deg, ${color}, ${color}bb)` }}
    >
      {icon}
    </div>
  </div>
);

/* ── Glance Card (smaller compact variant) ── */
interface TodayCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  currency?: boolean;
}

const GlanceCard: React.FC<TodayCardProps> = ({ label, value, icon, color, currency = true }) => (
  <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-[0_1px_8px_rgba(79,70,229,0.09)] dark:bg-[#111827]">
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
      style={{ background: color }}
    >
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{currency ? formatCurrency(value) : value.toLocaleString('en-IN')}</p>
    </div>
  </div>
);

/* ── Panel ── */
const Panel: React.FC<React.PropsWithChildren<{ title: string; action?: React.ReactNode; className?: string }>> = ({
  title, action, className = '', children,
}) => (
  <section className={`overflow-hidden rounded-xl bg-white shadow-[0_2px_10px_rgba(79,70,229,0.10)] dark:bg-[#111827] ${className}`}>
    <div className="flex min-h-11 items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-700">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

const ViewAllButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button type="button" onClick={onClick} className="rounded border border-sky-400 px-2 py-1 text-[11px] font-medium text-sky-600 transition hover:bg-sky-50">
    View All
  </button>
);

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════ */
export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const { selectedBranchId } = useBranch();
  const canLoadBranchData = !isSuperAdminRole(user?.role) || Boolean(selectedBranchId);
  const defaultDateRange = useMemo(() => getPresetDateRange(DEFAULT_DATE_PRESET), []);
  const [datePreset, setDatePreset] = useState<DatePreset>(DEFAULT_DATE_PRESET);
  const [customFromDate, setCustomFromDate] = useState(defaultDateRange.fromDate);
  const [customToDate, setCustomToDate] = useState(defaultDateRange.toDate);
  const selectedDateRange = useMemo(
    () => datePreset === 'custom'
      ? normalizeDateRange(customFromDate, customToDate, 'Custom')
      : getPresetDateRange(datePreset),
    [customFromDate, customToDate, datePreset],
  );
  const { fromDate, toDate } = selectedDateRange;
  const dashboardDateParams = useMemo(() => ({ fromDate, toDate }), [fromDate, toDate]);

  // Keep the From/To inputs showing the active preset's range so editing them
  // starts from the right baseline instead of a stale leftover custom range.
  useEffect(() => {
    if (datePreset === 'custom') return;
    setCustomFromDate(fromDate);
    setCustomToDate(toDate);
  }, [datePreset, fromDate, toDate]);
  const trendBuckets = useMemo(() => buildTrendBuckets(fromDate, toDate), [fromDate, toDate]);

  const canViewDashboard   = hasPermission(PERMISSIONS.DASHBOARD_VIEW);
  const canViewSales       = hasPermission(PERMISSIONS.SALES_VIEW);
  const canViewPurchases   = hasPermission(PERMISSIONS.PURCHASE_VIEW);
  const canViewExpenses    = hasPermission(PERMISSIONS.EXPENSE_VIEW);
  const canViewLowStock    = hasPermission(PERMISSIONS.REPORT_LOW_STOCK_VIEW);
  const canViewTopItems    = hasPermission(PERMISSIONS.REPORT_TOP_SELLING_ITEMS_VIEW);

  // The server scopes these requests through X-Branch-Id. It must also be part
  // of the cache key, otherwise a previously selected branch can be displayed
  // while a different branch is active.
  const summaryQuery   = useQuery({ queryKey: ['dashboard-summary', selectedBranchId, fromDate, toDate], queryFn: () => dashboardApi.getSummary(dashboardDateParams), enabled: canViewDashboard && canLoadBranchData, retry: false, refetchOnMount: 'always', staleTime: 0 });
  const salesQuery     = useQuery({ queryKey: ['dashboard-sales', selectedBranchId, fromDate, toDate], queryFn: () => salesApi.getAll({ page: 0, size: 200, fromDate, toDate }), enabled: canViewSales && canLoadBranchData, retry: false, refetchOnMount: 'always', staleTime: 0 });
  const purchasesQuery = useQuery({ queryKey: ['dashboard-purchases', selectedBranchId, fromDate, toDate], queryFn: () => purchaseApi.getAll({ page: 0, size: 200, fromDate, toDate }), enabled: canViewPurchases && canLoadBranchData, retry: false, refetchOnMount: 'always', staleTime: 0 });
  const expensesQuery  = useQuery({ queryKey: ['dashboard-expenses', selectedBranchId, fromDate, toDate], queryFn: () => expenseApi.getAll({ page: 0, size: 200, fromDate, toDate }), enabled: canViewExpenses && canLoadBranchData, retry: false, refetchOnMount: 'always', staleTime: 0 });
  const lowStockQuery  = useQuery({ queryKey: ['dashboard-low-stock', selectedBranchId], queryFn: () => reportsApi.lowStock(), enabled: canViewLowStock && canLoadBranchData, retry: false, refetchOnMount: 'always', staleTime: 0 });
  const topItemsQuery  = useQuery({ queryKey: ['dashboard-top-selling-items', selectedBranchId, fromDate, toDate], queryFn: () => reportsApi.topSellingItems(dashboardDateParams), enabled: canViewTopItems && canLoadBranchData, retry: false, refetchOnMount: 'always', staleTime: 0 });
  const dashboardQueries = [summaryQuery, salesQuery, purchasesQuery, expensesQuery, lowStockQuery, topItemsQuery];
  // isLoading is only true while a query has no data yet and is in flight, so this
  // is true solely on the very first fetch (post-login / hard refresh) and settles
  // to false once every enabled query has either data or an error - never both.
  const isInitialDashboardLoading = dashboardQueries.some((query) => query.isLoading);
  const isDashboardFetching = dashboardQueries.some((query) => query.isFetching);
  const retryFailedQueries = () => {
    dashboardQueries.forEach((query) => {
      if (query.isError) void query.refetch();
    });
  };

  const summary   = summaryQuery.data?.data;
  const sales     = salesQuery.data?.data?.content || [];
  const purchases = purchasesQuery.data?.data?.content || [];
  const expenses  = expensesQuery.data?.data?.content || [];

  /* ── Metrics ── */
  const metrics = useMemo(() => {
    const pendingSales       = sales.filter((s) => !isCompleted(s.status, s.dueAmount)).length;
    const completedSales     = sales.filter((s) => isCompleted(s.status, s.dueAmount)).length;
    const pendingPurchases   = purchases.filter((p) => !isConfirmedPurchase(p.status)).length;
    const completedPurchases = purchases.filter((p) => isConfirmedPurchase(p.status)).length;
    return {
      pendingSaleOrders:      summary?.pendingSaleOrders      ?? pendingSales,
      completedSaleOrders:    summary?.completedSaleOrders    ?? completedSales,
      paymentReceivables:     summary?.paymentReceivables     ?? sales.reduce((t, s) => t + numberValue(s.dueAmount), 0),
      paymentPayables:        summary?.paymentPayables        ?? purchases.reduce((t, p) => t + numberValue(p.dueAmount), 0),
      pendingPurchaseOrders:  summary?.pendingPurchaseOrders  ?? pendingPurchases,
      completedPurchaseOrders:summary?.completedPurchaseOrders?? completedPurchases,
      totalExpense:           summary?.totalExpense ?? summary?.todayExpense ?? expenses.reduce((t, e) => t + numberValue(e.amount), 0),
      totalCustomers:         summary?.totalCustomers         ?? 0,
    };
  }, [expenses, purchases, sales, summary]);

  /* ── Extended financial metrics ── */
  const financialMetrics = useMemo(() => {
    const totalRevenue   = sales.reduce((t, s) => t + numberValue(s.grandTotal), 0);
    const totalCost      = purchases.filter((purchase) => isConfirmedPurchase(purchase.status)).reduce((t, purchase) => t + numberValue(purchase.grandTotal), 0);
    const totalExpenses  = expenses.reduce((t, e) => t + numberValue(e.amount), 0);
    const netProfit      = summary?.netProfit != null
      ? numberValue(summary.netProfit)
      : totalRevenue - totalCost - totalExpenses;
    const paidSalesAmt   = sales.filter((s) => isCompleted(s.status, s.dueAmount)).reduce((t, s) => t + numberValue(s.grandTotal), 0);
    const unpaidSalesAmt = sales.filter((s) => !isCompleted(s.status, s.dueAmount)).reduce((t, s) => t + numberValue(s.dueAmount), 0);
    const paidSalesCount   = sales.filter((s) => isCompleted(s.status, s.dueAmount)).length;
    const unpaidSalesCount = sales.filter((s) => !isCompleted(s.status, s.dueAmount)).length;
    const paidPurchAmt   = purchases.filter((p) => isCompleted(p.status, p.dueAmount)).reduce((t, p) => t + numberValue(p.grandTotal), 0);
    const unpaidPurchAmt = purchases.filter((p) => !isCompleted(p.status, p.dueAmount)).reduce((t, p) => t + numberValue(p.dueAmount), 0);
    return { totalRevenue, totalCost, totalExpenses, netProfit, paidSalesAmt, unpaidSalesAmt, paidSalesCount, unpaidSalesCount, paidPurchAmt, unpaidPurchAmt };
  }, [sales, purchases, expenses, summary?.netProfit]);

  /* ── Selected-period totals ── */
  const glanceTotals = useMemo(() => {
    return {
      sales: summary?.totalSales ?? sales.reduce((total, sale) => total + numberValue(sale.grandTotal), 0),
      purchase: summary?.totalPurchase ?? purchases.reduce((total, purchase) => total + numberValue(purchase.grandTotal), 0),
      collection: summary?.totalCollection ?? 0,
      expense: summary?.totalExpense ?? expenses.reduce((total, expense) => total + numberValue(expense.amount), 0),
    };
  }, [expenses, purchases, sales, summary]);

  /* ── Sale vs Purchase chart ── */
  const chartData = useMemo(() => {
    const grouped = new Map(trendBuckets.map((bucket) => [bucket.key, { month: bucket.label, sales: 0, purchases: 0 }]));
    const granularity = trendBuckets[0]?.granularity || 'month';
    sales.forEach((sale) => {
      const entry = grouped.get(trendBucketKey(sale.invoiceDate, granularity));
      if (entry) entry.sales += numberValue(sale.grandTotal);
    });
    purchases.forEach((purchase) => {
      const entry = grouped.get(trendBucketKey(purchase.purchaseDate, granularity));
      if (entry) entry.purchases += numberValue(purchase.grandTotal);
    });
    return [...grouped.values()];
  }, [purchases, sales, trendBuckets]);

  /* ── Expense trend chart ── */
  const expenseTrendData = useMemo(() => {
    const grouped = new Map(trendBuckets.map((bucket) => [bucket.key, { month: bucket.label, expense: 0 }]));
    const granularity = trendBuckets[0]?.granularity || 'month';
    expenses.forEach((expense) => {
      const entry = grouped.get(trendBucketKey(expense.expenseDate, granularity));
      if (entry) entry.expense += numberValue(expense.amount);
    });
    return [...grouped.values()];
  }, [expenses, trendBuckets]);

  /* ── Net Profit trend ── */
  const profitTrendData = useMemo(() => {
    const grouped = new Map(trendBuckets.map((bucket) => [bucket.key, { month: bucket.label, revenue: 0, cost: 0, expense: 0 }]));
    const granularity = trendBuckets[0]?.granularity || 'month';
    sales.forEach((sale) => {
      const entry = grouped.get(trendBucketKey(sale.invoiceDate, granularity));
      if (entry) entry.revenue += numberValue(sale.grandTotal);
    });
    purchases.forEach((purchase) => {
      const entry = grouped.get(trendBucketKey(purchase.purchaseDate, granularity));
      if (entry) entry.cost += numberValue(purchase.grandTotal);
    });
    expenses.forEach((expense) => {
      const entry = grouped.get(trendBucketKey(expense.expenseDate, granularity));
      if (entry) entry.expense += numberValue(expense.amount);
    });
    return [...grouped.values()].map((entry) => ({ ...entry, profit: entry.revenue - entry.cost - entry.expense }));
  }, [expenses, purchases, sales, trendBuckets]);

  /* ── Sales payment status for pie ── */
  const salesPaymentStatus = useMemo(() => [
    { name: 'Collected', value: financialMetrics.paidSalesAmt, count: financialMetrics.paidSalesCount, color: '#22c55e' },
    { name: 'Outstanding', value: financialMetrics.unpaidSalesAmt, count: financialMetrics.unpaidSalesCount, color: '#ff3d5a' },
  ], [financialMetrics]);

  /* ── Purchase payment status for pie ── */
  const purchasePaymentStatus = useMemo(() => [
    { name: 'Paid', value: financialMetrics.paidPurchAmt, color: '#22c55e' },
    { name: 'Unpaid', value: financialMetrics.unpaidPurchAmt, color: '#ff9f0a' },
  ], [financialMetrics]);

  /* ── Trending items ── */
  const trendingItems = useMemo<DashboardTrendingItem[]>(() => {
    if (summary?.trendingItems?.length) return summary.trendingItems.slice(0, 6);
    return (topItemsQuery.data?.data || []).slice(0, 6).map((item) => ({
      itemId: item.itemId, itemName: item.itemName,
      quantity: numberValue(item.quantity), totalAmount: numberValue(item.totalAmount),
    }));
  }, [summary?.trendingItems, topItemsQuery.data?.data]);

  /* ── Recent invoices ── */
  const recentInvoices = useMemo<DashboardRecentInvoice[]>(() => {
    return [...sales]
      .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
      .slice(0, 6)
      .map((sale: SaleListItem) => ({
        saleId: sale.saleId, invoiceDate: sale.invoiceDate, saleCode: sale.invoiceNo,
        customerName: sale.customerName, grandTotal: numberValue(sale.grandTotal),
        balance: numberValue(sale.dueAmount),
        status: isCompleted(sale.status, sale.dueAmount) ? 'PAID' : sale.status || 'DUE',
      }));
  }, [sales]);

  /* ── Recent purchases ── */
  const recentPurchases = useMemo(() =>
    [...purchases]
      .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
      .slice(0, 6)
      .map((p: PurchaseListItem) => ({
        purchaseId: p.purchaseId, purchaseNo: p.purchaseNo || p.purchaseCode || '-',
        purchaseDate: p.purchaseDate,
        supplierName: p.supplierName, grandTotal: numberValue(p.grandTotal),
        dueAmount: numberValue(p.dueAmount),
        status: p.status || 'CREATED',
      })),
    [purchases]);

  /* ── Low stock ── */
  const lowStockItems = useMemo<DashboardLowStockItem[]>(() => {
    if (summary?.lowStockDetails?.length) return summary.lowStockDetails.slice(0, 6);
    if (Array.isArray(summary?.lowStockItems)) return (summary.lowStockItems as DashboardLowStockItem[]).slice(0, 6);
    return (lowStockQuery.data?.data || []).slice(0, 6).map((item) => ({
      itemId: item.itemId, itemName: item.itemName, brand: item.brandName || '',
      category: item.categoryName || 'General',
      minimumStock: numberValue(item.minimumStock ?? item.reorderLevel),
      currentStock: numberValue(item.currentStock ?? item.availableQty),
    }));
  }, [lowStockQuery.data?.data, summary?.lowStockDetails, summary?.lowStockItems]);

  const hasAnyError = [summaryQuery, salesQuery, purchasesQuery, expensesQuery, lowStockQuery, topItemsQuery].some((q) => q.isError);

  if (!canViewDashboard) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Your account does not have the <strong>DASHBOARD_VIEW</strong> permission.
      </div>
    );
  }

  if (isInitialDashboardLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader size="lg" label="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {hasAnyError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <span>Some dashboard sections could not be loaded. Available information is shown below.</span>
          <button
            type="button"
            onClick={retryFailedQueries}
            className="shrink-0 rounded border border-amber-400 px-3 py-1 font-semibold text-amber-800 transition hover:bg-amber-100"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl bg-white px-4 py-3 shadow-[0_2px_10px_rgba(79,70,229,0.10)] dark:bg-[#111827] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300">
            <CalendarDays size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Dashboard Period</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {formatDate(fromDate)} - {formatDate(toDate)}
            </p>
          </div>
          {isDashboardFetching && (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400" role="status">
              <Loader size="xs" />
              Refreshing...
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:w-auto lg:min-w-[520px]">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Range</span>
            <select
              value={datePreset}
              onChange={(event) => setDatePreset(event.target.value as DatePreset)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-sky-900/40"
            >
              {DATE_PRESET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <DateRangeFields
            fromDate={customFromDate}
            toDate={customToDate}
            fromLabel="From"
            toLabel="To"
            labelClassName="block text-[10px] font-semibold uppercase text-slate-400"
            inputClassName="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-sky-900/40"
            onFromDateChange={(value) => { setCustomFromDate(value); setDatePreset('custom'); }}
            onToDateChange={(value) => { setCustomToDate(value); setDatePreset('custom'); }}
          />
        </div>
      </div>

      <div className="relative min-h-[60vh]">
        {/* ── Total at a Glance ── */}
        <div className="mb-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Total at a Glance</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <GlanceCard label="Total Sales" value={glanceTotals.sales} icon={<ShoppingCart size={18} />} color="#1684ed" />
            <GlanceCard label="Total Purchase" value={glanceTotals.purchase} icon={<ShoppingBag size={18} />} color="#f5b800" />
            <GlanceCard label="Total Collection" value={glanceTotals.collection} icon={<CircleDollarSign size={18} />} color="#22c55e" />
            <GlanceCard label="Total Expense" value={glanceTotals.expense} icon={<TrendingDown size={18} />} color="#ef4444" />
          </div>
        </div>

        {/* ── Metric Cards ── */}
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Business Overview</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Pending Sale Orders"       value={metrics.pendingSaleOrders}       color="#18baf0" icon={<ShoppingCart size={20} />} />
            <MetricCard title="Completed Sale Orders"     value={metrics.completedSaleOrders}     color="#20bf55" icon={<CheckCircle2 size={20} />} />
            <MetricCard title="Payment Receivables"       value={metrics.paymentReceivables}      color="#ff3d5a" icon={<ArrowDownCircle size={20} />} currency />
            <MetricCard title="Due Payment"               value={metrics.paymentPayables}         color="#ff9f0a" icon={<ArrowUpCircle size={20} />} currency />
            <MetricCard title="Pending Purchase Orders"   value={metrics.pendingPurchaseOrders}   color="#27aee9" icon={<Tags size={20} />} />
            <MetricCard title="Completed Purchase Orders" value={metrics.completedPurchaseOrders} color="#13b981" icon={<CheckCircle2 size={20} />} />
            <MetricCard title="Total Customers"           value={metrics.totalCustomers}          color="#ff7a12" icon={<Users size={20} />} />
          </div>
        </div>

        {/* ── Financial Performance Cards ── */}
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Financial Performance ({selectedDateRange.label})</p>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard title="Total Revenue" value={financialMetrics.totalRevenue} color="#1684ed" icon={<Wallet size={20} />} currency />
            <MetricCard title="Total Purchase Cost" value={financialMetrics.totalCost} color="#f5b800" icon={<ShoppingBag size={20} />} currency />
            <MetricCard title="Total Expenses" value={financialMetrics.totalExpenses} color="#ef4444" icon={<TrendingDown size={20} />} currency />
            <MetricCard
              title="Net Profit"
              value={financialMetrics.netProfit}
              color={financialMetrics.netProfit >= 0 ? '#22c55e' : '#ef4444'}
              icon={<BarChart2 size={20} />}
              currency
              subLabel={financialMetrics.netProfit >= 0 ? 'Profitable' : 'Loss'}
            />
          </div>
        </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title={`Sale vs. Purchase - ${selectedDateRange.label}`} className="xl:col-span-2">
          <div className="h-[280px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={52} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => formatCurrency(numberValue(value))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar name="Purchase Bills" dataKey="purchases" fill="#f5b800" radius={[6, 6, 0, 0]} maxBarSize={20} />
                <Bar name="Sale Invoices"  dataKey="sales"     fill="#1684ed" radius={[6, 6, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title={`Expense Trend - ${selectedDateRange.label}`}>
          <div className="h-[280px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={expenseTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={52} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => formatCurrency(numberValue(value))} />
                <Area type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" strokeWidth={2} fill="url(#expenseGrad)" dot={{ r: 3, fill: '#ef4444' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* ── Net Profit Trend + Payment Status Charts ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title={`Net Profit Trend - ${selectedDateRange.label}`} className="xl:col-span-2">
          <div className="h-[260px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={52} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => formatCurrency(numberValue(value))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line name="Revenue" type="monotone" dataKey="revenue" stroke="#1684ed" strokeWidth={2} dot={{ r: 3, fill: '#1684ed' }} />
                <Line name="Purchase Cost" type="monotone" dataKey="cost" stroke="#f5b800" strokeWidth={2} dot={{ r: 3, fill: '#f5b800' }} />
                <Line name="Expenses" type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} />
                <Line name="Net Profit" type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2.5} strokeDasharray="5 3" dot={{ r: 3, fill: '#22c55e' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel title="Sales Collection Status">
            <div className="h-[115px] p-3">
              {salesPaymentStatus.some((s) => s.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={salesPaymentStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={48} paddingAngle={2}>
                      {salesPaymentStatus.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(numberValue(value))} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">No sales data</div>
              )}
            </div>
          </Panel>

          <Panel title="Purchase Payment Status">
            <div className="h-[115px] p-3">
              {purchasePaymentStatus.some((s) => s.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={purchasePaymentStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={48} paddingAngle={2}>
                      {purchasePaymentStatus.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(numberValue(value))} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">No purchase data</div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      {/* ── Trending Items (horizontal bar) + Total Expense ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Top Selling Items" className="xl:col-span-2">
          <div className="divide-y divide-slate-50 dark:divide-slate-700">
            {trendingItems.length ? trendingItems.map((item, index) => {
              const max = Math.max(...trendingItems.map((t) => t.quantity), 1);
              const pct = Math.round((item.quantity / max) * 100);
              return (
                <div key={item.itemId} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-5 shrink-0 text-[11px] font-bold text-slate-400">#{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{item.itemName}</p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: TREND_COLORS[index % TREND_COLORS.length] }} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{item.quantity.toLocaleString('en-IN')} units</p>
                    <p className="text-[10px] text-slate-400">{formatCurrency(item.totalAmount)}</p>
                  </div>
                </div>
              );
            }) : (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <PackageSearch size={32} />
                <p className="mt-2 text-xs">No sales data available</p>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Category Distribution">
          <div className="h-[260px] p-3">
            {trendingItems.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={trendingItems} dataKey="quantity" nameKey="itemName" cx="50%" cy="46%" innerRadius={52} outerRadius={80} paddingAngle={2}>
                    {trendingItems.map((item, index) => (
                      <Cell key={item.itemId} fill={TREND_COLORS[index % TREND_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => numberValue(value).toLocaleString('en-IN')} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-slate-400">
                <TrendingUp size={32} />
                <p className="mt-2 text-xs">No data</p>
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* ── Recent Invoices + Recent Purchases ── */}
      <div className="space-y-5">
        <Panel title="Recent Sales Invoices" action={canViewSales ? <ViewAllButton onClick={() => navigate('/sales/invoices')} /> : undefined}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-xs">
              <thead className="bg-slate-50 text-left text-[10px] uppercase text-slate-500 dark:bg-[#1f2937]">
                <tr>
                  {['#', 'Date', 'Invoice', 'Customer', 'Total', 'Balance', 'Status'].map((h) => (
                    <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentInvoices.length ? recentInvoices.map((inv, index) => (
                  <tr key={`${inv.saleId}-${inv.saleCode}`}
                    className="border-b border-slate-50 text-slate-700 last:border-0 dark:border-slate-700 dark:text-slate-300"
                  >
                    <td className="px-3 py-2.5">{index + 1}</td>
                    <td className="px-3 py-2.5">{formatDate(inv.invoiceDate)}</td>
                    <td className="px-3 py-2.5 font-medium">{inv.saleCode}</td>
                    <td className="px-3 py-2.5">{inv.customerName}</td>
                    <td className="px-3 py-2.5 font-semibold">{formatCurrency(inv.grandTotal)}</td>
                    <td className="px-3 py-2.5">{formatCurrency(inv.balance)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${inv.status.toUpperCase() === 'PAID' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-700'}`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400">No recent invoices</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Recent Purchases" action={canViewPurchases ? <ViewAllButton onClick={() => navigate('/purchase')} /> : undefined}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-xs">
              <thead className="bg-slate-50 text-left text-[10px] uppercase text-slate-500 dark:bg-[#1f2937]">
                <tr>
                  {['#', 'Date', 'Purchase', 'Supplier', 'Total', 'Due', 'Status'].map((h) => (
                    <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentPurchases.length ? recentPurchases.map((p, index) => (
                  <tr key={p.purchaseId}
                    className="border-b border-slate-50 text-slate-700 last:border-0 dark:border-slate-700 dark:text-slate-300"
                  >
                    <td className="px-3 py-2.5">{index + 1}</td>
                    <td className="px-3 py-2.5">{formatDate(p.purchaseDate)}</td>
                    <td className="px-3 py-2.5 font-medium">{p.purchaseNo}</td>
                    <td className="px-3 py-2.5 font-medium">{p.supplierName}</td>
                    <td className="px-3 py-2.5 font-semibold">{formatCurrency(p.grandTotal)}</td>
                    <td className="px-3 py-2.5 font-semibold text-rose-500">{formatCurrency(p.dueAmount)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isConfirmedPurchase(p.status) ? 'bg-green-100 text-green-600' : p.status.toUpperCase() === 'CANCELLED' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400">No recent purchases</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* ── Low Stock Items ── */}
      <Panel title="Low Stock Alert" action={canViewLowStock ? <ViewAllButton onClick={() => navigate('/reports/low-stock')} /> : undefined}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-xs">
            <thead className="bg-slate-50 text-left text-[10px] uppercase text-slate-500 dark:bg-[#1f2937]">
              <tr>
                {['#', 'Item Name', 'Category', 'Brand', 'Min Stock', 'Current Stock', 'Status'].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lowStockItems.length ? lowStockItems.map((item, index) => {
                const critical = numberValue(item.currentStock) === 0;
                return (
                  <tr key={`${item.itemId}-${index}`} className="border-b border-slate-50 text-slate-700 last:border-0 dark:border-slate-700 dark:text-slate-300">
                    <td className="px-3 py-2.5">{index + 1}</td>
                    <td className="px-3 py-2.5 font-medium">{item.itemName}</td>
                    <td className="px-3 py-2.5">{item.category || 'General'}</td>
                    <td className="px-3 py-2.5">{item.brand || '—'}</td>
                    <td className="px-3 py-2.5">{numberValue(item.minimumStock).toFixed(2)}</td>
                    <td className="px-3 py-2.5 font-semibold text-rose-500">{numberValue(item.currentStock).toFixed(2)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${critical ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                        {critical ? 'Out of Stock' : 'Low'}
                      </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400">All stock levels are healthy</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      </div>

      {/* Scroll-to-top */}
      <button
        type="button"
        onClick={() => document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-12 right-5 z-20 flex h-9 w-9 items-center justify-center rounded-lg bg-[#1684ed] text-white shadow-lg transition hover:bg-[#1270cc]"
        aria-label="Scroll to top"
      >
        <ArrowUp size={18} />
      </button>
    </div>
  );
};
