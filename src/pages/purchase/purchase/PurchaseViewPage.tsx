import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { purchaseApi } from '../../../api/endpoints';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Loader } from '../../../components/ui/Loader';
import { PageHeader } from '../../../components/ui/PageHeader';
import { formatCurrency } from '../../../utils/formatCurrency';

export const PurchaseViewPage: React.FC = () => {
  const navigate = useNavigate();
  const id = Number(useParams<{ id: string }>().id);
  const { data, isLoading } = useQuery({
    queryKey: ['purchase', id],
    queryFn: () => purchaseApi.getById(id),
    enabled: id > 0,
  });

  if (isLoading) return <Loader />;

  const purchase = data?.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Purchase ${purchase?.purchaseNo || purchase?.purchaseCode || ''}`}
        actions={purchase && purchase.status !== 'CONFIRMED' && <Button onClick={() => navigate(`/purchase/${id}/edit`)}>Edit</Button>}
      />

      <Card>
        <div className="grid grid-cols-2 gap-4">
          <p><b>Supplier:</b> {purchase?.supplier?.name}</p>
          <p><b>Date:</b> {purchase?.purchaseDate}</p>
          <p><b>Warehouse:</b> {purchase?.warehouse?.name}</p>
          <p><b>Status:</b> {purchase?.status}</p>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr>
              {['Item', 'Qty', 'Price', 'Discount', 'Tax', 'Total'].map((heading) => (
                <th key={heading} className="border p-2 text-left">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {purchase?.items.map((item, index) => (
              <tr key={`${item.itemId}-${index}`}>
                <td className="border p-2">{item.itemName}</td>
                <td className="border p-2">{item.qty ?? item.quantity}</td>
                <td className="border p-2">{formatCurrency(item.unitPrice)}</td>
                <td className="border p-2">{formatCurrency(item.discountAmount || 0)}</td>
                <td className="border p-2">{formatCurrency(item.taxAmount || 0)}</td>
                <td className="border p-2">{formatCurrency(item.totalAmount || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-5 w-64 space-y-2 text-right">
          <p>Subtotal: {formatCurrency(purchase?.subTotal || 0)}</p>
          {Number(purchase?.roundOffAmount || 0) !== 0 && <p>Round Off: {formatCurrency(purchase?.roundOffAmount || 0)}</p>}
          <p>Due: {formatCurrency(purchase?.dueAmount || 0)}</p>
          <p className="text-lg font-bold">Grand Total: {formatCurrency(purchase?.grandTotal || 0)}</p>
        </div>
      </Card>
    </div>
  );
};
