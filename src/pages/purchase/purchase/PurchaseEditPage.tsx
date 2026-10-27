import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { itemApi, purchaseApi } from '../../../api/endpoints';
import { queryClient } from '../../../app/queryClient';
import { Loader } from '../../../components/ui/Loader';
import { PurchaseForm, type PurchasePricingStockLine, type PurchaseSubmitPayload } from './PurchaseForm';

export const PurchaseEditPage: React.FC = () => {
  const navigate = useNavigate();
  const id = Number(useParams<{ id: string }>().id);
  const purchase = useQuery({ queryKey: ['purchase', id], queryFn: () => purchaseApi.getById(id), enabled: id > 0 });
  const detail = purchase.data?.data;

  const lines = useQuery({
    queryKey: ['purchase-edit-lines', id, detail?.items?.map((item) => item.itemId).join(',')],
    queryFn: async (): Promise<PurchasePricingStockLine[]> => {
      const items = detail?.items || [];
      const results = await Promise.all(items.map((item) => itemApi.getById(item.itemId)));
      return items.map((item, index) => {
        const fetched = results[index].data;
        const snapshotTaxPercentage = Number(item.taxPercent ?? item.gstRate ?? fetched?.gstRate ?? fetched?.taxPercentage ?? 0);
        const snapshotCessRate = Number(item.cessRate ?? 0);
        const snapshotPurchasePrice = Number(item.unitPrice ?? fetched?.purchasePrice ?? 0);
        return {
          itemId: item.itemId,
          itemName: fetched?.itemName || item.itemName,
          categoryId: fetched?.categoryId || 0,
          subCategoryId: fetched?.subCategoryId || 0,
          brandId: fetched?.brandId || 0,
          hsnId: fetched?.hsnId || 0,
          unitId: fetched?.unitId || 0,
          gstTaxability: snapshotTaxPercentage > 0 || snapshotCessRate > 0 ? 'TAXABLE' : (fetched?.gstTaxability || 'TAXABLE'),
          gstRateId: fetched?.gstRateId || 0,
          cessRate: snapshotCessRate || fetched?.cessRate || 0,
          description: fetched?.description || '',
          purchasePrice: snapshotPurchasePrice,
          purchasePriceWithTax: Number(item.taxableAmount ?? fetched?.purchasePriceWithTax ?? snapshotPurchasePrice),
          taxPercentage: snapshotTaxPercentage || fetched?.gstRate || fetched?.taxPercentage || 0,
          profitMargin: fetched?.profitMargin || 0,
          mrp: Number(item.mrp ?? fetched?.mrp ?? 0),
          salePrice: Number(item.salePrice ?? fetched?.salePrice ?? 0),
          wholesalePrice: Number(item.wholesalePrice ?? fetched?.wholesalePrice ?? 0),
          openingQuantity: item.qty ?? item.quantity ?? fetched?.openingQuantity ?? 0,
          minimumStock: fetched?.minimumStock || 0,
        };
      });
    },
    enabled: Boolean(detail?.items?.length),
  });

  const mutation = useMutation({
    mutationFn: async (payload: PurchaseSubmitPayload) => {
      const { requestCancel, ...purchasePayload } = payload;
      if (requestCancel) {
        return purchaseApi.cancel(id);
      }
      return purchaseApi.update(id, purchasePayload);
    },
    onSuccess: (_response, variables) => {
      toast.success(variables.requestCancel ? 'Purchase cancelled' : 'Purchase updated successfully');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchase', id] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      navigate('/purchase');
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to update purchase'),
  });

  if (purchase.isLoading || lines.isLoading) return <Loader />;

  const initial = detail ? {
    supplierId: detail.supplier.id,
    purchaseDate: detail.purchaseDate,
    referenceNo: detail.referenceNo || '',
    warehouseId: detail.warehouse.id,
    carrierId: detail.carrier?.id || 0,
    stateId: detail.state?.id || 0,
    notes: detail.notes || '',
    status: detail.status,
    payments: [],
    items: [],
    purchaseNo: detail.purchaseNo,
    dueAmount: detail.dueAmount,
    paidAmount: detail.paidAmount,
    paymentHistory: detail.payments || [],
    lines: lines.data || [],
  } : undefined;

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Purchase &gt; Purchase List &gt; Purchase Details</div>
      <PurchaseForm initial={initial} submitText="Update" loading={mutation.isPending} onSubmit={(payload) => mutation.mutate(payload)} onCancel={() => navigate('/purchase')} />
    </div>
  );
};
