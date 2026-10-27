import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminContactsApi, customerApi } from '../../../api/endpoints';
import { queryClient } from '../../../app/queryClient';
import { getDefaultAuthorizedPath } from '../../../auth/featurePermissions';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { CustomerForm } from './CustomerForm';
import { useAuth } from '../../../hooks/useAuth';
import { isSuperAdminRole } from '../../../auth/featurePermissions';
import { customerSchema, toCustomerRequest } from './customer.schema';
import type { CustomerFormData, CustomerFormInput } from './customer.schema';
import { useCreateFlowNavigation } from '../../../hooks/useCreateFlowNavigation';

export const CustomerCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { returnFromCreate } = useCreateFlowNavigation('/contacts/customers');
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isSuperAdmin = isSuperAdminRole(user?.role);
  const organizationId = Number(searchParams.get('organizationId'));
  const defaultPath = getDefaultAuthorizedPath(user?.permissions, user?.role);
  const [serverValidationErrors, setServerValidationErrors] = useState<Record<string, string>>({});
  const { register, handleSubmit, setValue, setError, clearErrors, formState: { errors, isValid } } = useForm<CustomerFormInput, unknown, CustomerFormData>({
    resolver: zodResolver(customerSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      openingBalanceType: '',
      isWholesale: false,
      phone: '',
      mobile: '',
      whatsappNo: '',
      billingAddress: { stateId: 0 },
      shippingAddress: { stateId: 0 },
    },
  });

  const mutation = useMutation({
    mutationFn: (data: CustomerFormData) => {
      const payload = toCustomerRequest(data);
      return isSuperAdmin ? adminContactsApi.createCustomer(organizationId, payload) : customerApi.create(payload);
    },
    onSuccess: () => {
      toast.success('Customer created successfully');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['pos-customers'] });
      queryClient.invalidateQueries({ queryKey: ['sale-order-form-customers'] });
      queryClient.invalidateQueries({ queryKey: ['sale-form-customers'] });
      returnFromCreate();
    },
    onError: (error: any) => {
      const validationErrors = error?.errors;
      if (validationErrors && typeof validationErrors === 'object' && !Array.isArray(validationErrors)) {
        setServerValidationErrors(validationErrors);
        Object.entries(validationErrors).forEach(([field, message]) => {
          setError(field as any, { type: 'server', message: String(message) });
        });
        toast.error('Please correct the validation errors');
        return;
      }
      toast.error(error?.message || 'Failed to create customer');
    },
  });

  const submit = (data: CustomerFormData) => {
    if (isSuperAdmin && (!Number.isInteger(organizationId) || organizationId <= 0)) {
      toast.error('Select an organization from the customer list before creating a customer');
      navigate('/contacts/customers');
      return;
    }
    setServerValidationErrors({});
    clearErrors();
    mutation.mutate(data);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => navigate(defaultPath)} className="text-blue-600 hover:underline">Home</button>
        <span>›</span><span>Contacts</span><span>›</span>
        <button onClick={() => navigate('/contacts/customers')} className="hover:underline">Customer List</button>
        <span>›</span><span className="text-gray-700">Create Customer</span>
      </div>
      <Card className="overflow-hidden p-0">
        <div className="border-b border-gray-200 px-5 py-4">
          <h1 className="text-xl font-semibold text-gray-900">Customer Details</h1>
        </div>
        <form onSubmit={handleSubmit(submit)} className="space-y-6">
          {Object.keys(serverValidationErrors).length > 0 && (
            <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-semibold">Please correct the following fields:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {Object.entries(serverValidationErrors).map(([field, message]) => <li key={field}><span className="font-medium">{field.replace(/([A-Z])/g, ' $1').replace('.', ' › ')}:</span> {message}</li>)}
              </ul>
            </div>
          )}
          <div className="px-5 pt-1">
            <CustomerForm register={register} setValue={setValue} errors={errors} nameLabel="Enter Your Name *" namePlaceholder="Enter your name" />
          </div>
          <div className="flex justify-end gap-3 border-t px-5 py-4">
            <Button type="button" variant="secondary" onClick={returnFromCreate}>Cancel</Button>
            <Button type="submit" isLoading={mutation.isPending} disabled={!isValid || mutation.isPending}>Create Customer</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
