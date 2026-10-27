import React from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { itemApi } from '../../api/endpoints';
import type { ItemRequest } from '../../api/endpoints';
import { queryClient } from '../../app/queryClient';
import { getValidationErrors, hasValidationErrors } from '../../utils/apiValidation';
import { useCreateFlowNavigation } from '../../hooks/useCreateFlowNavigation';
import { ItemForm } from './ItemForm';

export const ItemCreatePage: React.FC = () => {
  const { returnFromCreate } = useCreateFlowNavigation('/items');
  const mutation = useMutation({
    mutationFn: async ({ payload, imageFile }: { payload: ItemRequest; imageFile: File | null }) => {
      // Item creation (the API call that actually persists the record) must not be re-run
      // just because the logo upload afterwards fails - the item already exists by then.
      const created = await itemApi.create(payload);
      const id = created.data?.id;
      let imageUploadFailed = false;
      if (imageFile && id) {
        try {
          await itemApi.uploadLogo(id, imageFile);
        } catch {
          imageUploadFailed = true;
        }
      }
      return { id, imageUploadFailed };
    },
    onSuccess: async ({ imageUploadFailed }) => {
      if (imageUploadFailed) {
        toast.error('Item created successfully, but image upload failed.');
      } else {
        toast.success('Item created successfully');
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['items'] }),
        queryClient.invalidateQueries({ queryKey: ['purchase-form-items'] }),
        queryClient.invalidateQueries({ queryKey: ['sale-form-items'] }),
        queryClient.invalidateQueries({ queryKey: ['sale-order-form-items'] }),
        queryClient.invalidateQueries({ queryKey: ['quotation-form-items'] }),
      ]);
      returnFromCreate();
    },
    onError: (error: any) => {
      if (!hasValidationErrors(error)) toast.error(error?.message || 'Failed to create item');
    },
  });
  return <div className="space-y-5"><div className="text-sm text-gray-500">Home &gt; Items &gt; Item List &gt; Create Item</div><ItemForm submitText="Submit" loading={mutation.isPending} validationErrors={getValidationErrors(mutation.error)} onFieldChange={mutation.reset} onSubmit={(payload, imageFile) => mutation.mutate({ payload, imageFile })} onCancel={returnFromCreate} /></div>;
};
