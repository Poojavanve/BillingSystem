const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

const twoDigitWords = (val: number): string => {
  if (val < 20) return ONES[val];
  const tens = Math.floor(val / 10);
  const ones = val % 10;
  return TENS[tens] + (ones > 0 ? ' ' + ONES[ones] : '');
};

export const numberToWords = (amount?: number | null): string => {
  if (!amount || amount === 0) return 'Rupees Zero Only';
  let rupees = Math.floor(Math.abs(amount));
  let result = '';

  const crore = Math.floor(rupees / 10000000);
  rupees %= 10000000;
  const lakh = Math.floor(rupees / 100000);
  rupees %= 100000;
  const thousand = Math.floor(rupees / 1000);
  rupees %= 1000;
  const hundred = Math.floor(rupees / 100);
  const remainder = rupees % 100;

  if (crore > 0) result += `${twoDigitWords(crore)} Crore `;
  if (lakh > 0) result += `${twoDigitWords(lakh)} Lakh `;
  if (thousand > 0) result += `${twoDigitWords(thousand)} Thousand `;
  if (hundred > 0) result += `${ONES[hundred]} Hundred `;
  if (remainder > 0) {
    if (result) result += 'and ';
    result += twoDigitWords(remainder);
  }

  return `Rupees ${result.trim()} Only`;
};
