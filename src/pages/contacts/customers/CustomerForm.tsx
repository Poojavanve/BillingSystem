import type { FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { Input } from '../../../components/ui/Input';
import { stateOptionName, useStates } from '../../../hooks/useStates';
import type { State } from '../../../api/endpoints';
import type { CustomerFormInput } from './customer.schema';

interface CustomerFormProps {
  register: UseFormRegister<CustomerFormInput>;
  setValue?: UseFormSetValue<CustomerFormInput>;
  errors: FieldErrors<CustomerFormInput>;
  hideContactFields?: boolean;
  nameLabel?: string;
  namePlaceholder?: string;
}

const selectClassName = 'h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50';
const selectLabelClassName = 'mb-1 block text-sm text-gray-600';
const sectionClassName = 'border-t border-gray-200 pt-5';
const sectionHeaderClassName = 'mb-4 flex items-center justify-between';

type AddressKey = 'billingAddress' | 'shippingAddress';

interface AddressFieldsProps extends CustomerFormProps {
  addressKey: AddressKey;
  states: State[];
  statesLoading: boolean;
  statesError: boolean;
}

const AddressFields = ({ addressKey, register, errors, states, statesLoading, statesError }: AddressFieldsProps) => {
  const title = addressKey === 'billingAddress' ? 'Billing Address' : 'Shipping Address';
  const addressErrors = errors[addressKey];
  const stateField = register(`${addressKey}.stateId`, { setValueAs: Number });

  return (
    <section className={sectionClassName}>
      <div className={sectionHeaderClassName}>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <span className="text-xs font-medium text-gray-500">Optional</span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Address Line 1" placeholder="Enter address line 1" error={addressErrors?.addressLine1?.message} {...register(`${addressKey}.addressLine1`)} />
        <Input label="Address Line 2" placeholder="Enter address line 2" error={addressErrors?.addressLine2?.message} {...register(`${addressKey}.addressLine2`)} />
        <Input label="City" placeholder="Enter city" error={addressErrors?.city?.message} {...register(`${addressKey}.city`)} />
        <Input label="Pincode" placeholder="Enter pincode" error={addressErrors?.pincode?.message} {...register(`${addressKey}.pincode`)} />
        <div>
          <label className={selectLabelClassName}>State</label>
          <select className={selectClassName} disabled={statesLoading || statesError} {...stateField}>
            <option value={0}>{statesLoading ? 'Loading states...' : statesError ? 'Failed to load states' : 'Select state'}</option>
            {states.map((state) => <option key={state.id} value={state.id}>{stateOptionName(state)}</option>)}
          </select>
          {addressErrors?.stateId?.message && <p className="mt-1 text-sm text-red-600">{addressErrors.stateId.message}</p>}
        </div>
      </div>
    </section>
  );
};

export const CustomerForm = ({ register, errors, hideContactFields = false, nameLabel = 'First Name *', namePlaceholder = 'Enter first name' }: CustomerFormProps) => {
  const { states, isLoading: statesLoading, isError: statesError } = useStates();
  const phoneField = register('phone');
  const whatsappField = register('whatsappNo');

  return (
  <div className="space-y-6">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Input label={nameLabel} placeholder={namePlaceholder} error={errors.firstName?.message} {...register('firstName')} />
      {!hideContactFields && <Input label="Last Name *" placeholder="Enter last name" error={errors.lastName?.message} {...register('lastName')} />}
      <Input label="Email" type="email" placeholder="Enter email address" error={errors.email?.message} {...register('email')} />
      {!hideContactFields && <>
        <Input
          label="Phone Number *"
          type="tel"
          placeholder="Enter phone number"
          maxLength={10}
          error={errors.phone?.message}
          {...phoneField}
          onChange={(event) => {
            event.target.value = event.target.value.replace(/\D/g, '').slice(0, 10);
            phoneField.onChange(event);
          }}
        />
        <Input
          label="WhatsApp Number *"
          type="tel"
          placeholder="Enter WhatsApp number"
          maxLength={10}
          error={errors.whatsappNo?.message}
          {...whatsappField}
          onChange={(event) => {
            const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, 10);
            event.target.value = digitsOnly;
            whatsappField.onChange(event);
          }}
        />
      </>}
      <Input label="PAN Number" placeholder="Enter PAN number" error={errors.panNumber?.message} {...register('panNumber', { setValueAs: (value) => value.toUpperCase() })} />
      <Input label="Credit Limit" inputMode="decimal" placeholder="0.00" error={errors.creditLimit?.message} {...register('creditLimit')} />
      <Input label="Opening Balance" inputMode="decimal" placeholder="0.00" error={errors.openingBalance?.message} {...register('openingBalance')} />
      <div>
        <label className={selectLabelClassName}>Opening Balance Type</label>
        <select className={selectClassName} {...register('openingBalanceType')}>
          <option value="">Select balance type</option><option value="RECEIVABLE">Receivable</option><option value="PAYABLE">Payable</option>
        </select>
      </div>
      <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700"><input type="checkbox" className="h-4 w-4" {...register('isWholesale')} />Wholesale Customer</label>
    </div>

    {(['billingAddress', 'shippingAddress'] as const).map((addressKey) => {
      return (
        <AddressFields
          key={addressKey}
          addressKey={addressKey}
          register={register}
          errors={errors}
          states={states}
          statesLoading={statesLoading}
          statesError={statesError}
        />
      );
    })}
  </div>
  );
};
