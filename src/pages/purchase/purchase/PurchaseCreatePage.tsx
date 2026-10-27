import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { purchaseApi } from '../../../api/endpoints';
import { queryClient } from '../../../app/queryClient';
import { PurchaseForm, type PurchaseSubmitPayload } from './PurchaseForm';

export const PurchaseCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: (payload: PurchaseSubmitPayload) => purchaseApi.create(payload),
    onSuccess: () => {
      toast.success('Purchase created successfully');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      navigate('/purchase');
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to create purchase'),
  });

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Purchase &gt; Purchase List &gt; Create Purchase</div>
      <PurchaseForm submitText="Submit" loading={mutation.isPending} onSubmit={(payload) => mutation.mutate(payload)} onCancel={() => navigate('/purchase')} />
    </div>
  );
};
