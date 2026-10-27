import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { paymentOutApi } from '../../../api/endpoints';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Loader } from '../../../components/ui/Loader';
import { PageHeader } from '../../../components/ui/PageHeader';
import { formatCurrency } from '../../../utils/formatCurrency';

export const PaymentOutViewPage: React.FC = () => {
  const navigate = useNavigate();
  const id = Number(useParams<{ id: string }>().id);
  const { data, isLoading } = useQuery({ queryKey: ['payment-out', id], queryFn: () => paymentOutApi.getById(id), enabled: id > 0 });

  if (isLoading) return <div className="p-10"><Loader /></div>;
  const payment = data?.data;
  const inputClass = 'mt-1 h-10 w-full rounded border border-gray-300 bg-gray-50 px-3 text-sm text-gray-900';
  const purchaseIds = payment?.purchaseIds?.join(', ') || '';

  return (
    <div className="space-y-6">
      <PageHeader title={`Payment Out ${payment?.paymentNo || ''}`} actions={<Button variant="secondary" onClick={() => navigate('/purchase/payment-out')}>Back</Button>} />
      <Card>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <label className="text-sm text-gray-600">Payment Type<input className={inputClass} value={payment?.paymentType || ''} readOnly /></label>
          <label className="text-sm text-gray-600">Supplier<input className={inputClass} value={payment?.party?.name || ''} readOnly /></label>
          <label className="text-sm text-gray-600">Payment Method<input className={inputClass} value={payment?.paymentMethod?.name || ''} readOnly /></label>
          <label className="text-sm text-gray-600">Payment Date<input className={inputClass} value={payment?.paymentDate || ''} readOnly /></label>
          <label className="text-sm text-gray-600">Reference No.<input className={inputClass} value={payment?.referenceNo || ''} readOnly /></label>
          <label className="text-sm text-gray-600">Amount<input className={inputClass} value={payment ? formatCurrency(payment.amount) : ''} readOnly /></label>
          <label className="text-sm text-gray-600 md:col-span-2">Purchase IDs<input className={inputClass} value={purchaseIds} readOnly /></label>
          <label className="text-sm text-gray-600 md:col-span-2">Notes<textarea className="mt-1 min-h-24 w-full rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900" value={payment?.notes || ''} readOnly /></label>
        </div>
      </Card>
    </div>
  );
};
