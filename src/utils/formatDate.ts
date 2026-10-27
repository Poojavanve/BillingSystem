export const isValidIsoDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export const DATE_RANGE_ERROR = 'To Date must be greater than or equal to From Date.';

export const isValidDateRange = (fromDate: string, toDate: string) =>
  (!fromDate || isValidIsoDate(fromDate))
  && (!toDate || isValidIsoDate(toDate))
  && (!fromDate || !toDate || fromDate <= toDate);

export const formatDate = (dateString: string, format: 'short' | 'long' = 'short'): string => {
  const isoDate = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = isoDate
    ? isValidIsoDate(dateString.slice(0, 10))
      ? { day: isoDate[3], month: isoDate[2], year: isoDate[1] }
      : null
    : (() => {
        const parsed = new Date(dateString);
        if (Number.isNaN(parsed.getTime())) return null;
        return {
          day: String(parsed.getDate()).padStart(2, '0'),
          month: String(parsed.getMonth() + 1).padStart(2, '0'),
          year: String(parsed.getFullYear()),
        };
      })();

  if (!date) return dateString;
  const formatted = `${date.day}/${date.month}/${date.year}`;
  if (format === 'short' || !dateString.includes('T')) return formatted;

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return formatted;
  return `${formatted} ${parsed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};
