import React from 'react';
import { DATE_RANGE_ERROR, isValidDateRange } from '../../utils/formatDate';

export { DATE_RANGE_ERROR, isValidDateRange };

interface DateRangeFieldsProps {
  fromDate: string;
  toDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  inputClassName: string;
  labelClassName?: string;
  fromMinDate?: string;
  fromLabel?: string;
  toLabel?: string;
}

export const DateRangeFields: React.FC<DateRangeFieldsProps> = ({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  inputClassName,
  labelClassName = 'text-sm text-gray-600',
  fromMinDate,
  fromLabel = 'From Date',
  toLabel = 'To Date',
}) => {
  const invalidRange = !isValidDateRange(fromDate, toDate);

  return (
    <>
      <label className={labelClassName}>
        {fromLabel}
        <input
          type="date"
          lang="en-GB"
          min={fromMinDate}
          className={inputClassName}
          value={fromDate}
          onChange={(event) => {
            const value = event.target.value;
            if (toDate && value && toDate < value) onToDateChange(value);
            onFromDateChange(value);
          }}
        />
      </label>
      <label className={labelClassName}>
        {toLabel}
        <input
          type="date"
          lang="en-GB"
          min={fromDate || undefined}
          className={inputClassName}
          value={toDate}
          aria-invalid={invalidRange || undefined}
          onChange={(event) => onToDateChange(event.target.value)}
        />
        {invalidRange && <span role="alert" className="mt-1 block text-xs text-red-600">{DATE_RANGE_ERROR}</span>}
      </label>
    </>
  );
};
