import React from 'react';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { numberToWords } from '../../utils/numberToWords';

export interface DocumentItemLine {
  id?: number | string;
  name: string;
  code?: string;
  batchNo?: string;
  price: number;
  qty: number;
  discount?: number;
  tax?: number;
  total: number;
}

export interface SalesDocumentSheetProps {
  type: 'INVOICE' | 'QUOTATION';
  docNumber: string;
  docDate?: string;
  validUntil?: string;
  warehouseName?: string;
  status?: string;
  paidAmount?: number;
  dueAmount?: number;
  customer?: {
    name?: string;
    mobile?: string;
    email?: string;
    address?: string;
    gstin?: string;
  };
  organization?: {
    name?: string;
    logoUrl?: string | null;
    address?: string;
    phone?: string;
    gstin?: string;
  };
  items: DocumentItemLine[];
  subTotal: number;
  discountAmount?: number;
  taxAmount?: number;
  roundOff?: number;
  grandTotal: number;
  notes?: string;
}

export const SalesDocumentSheet: React.FC<SalesDocumentSheetProps> = ({
  type,
  docNumber,
  docDate,
  validUntil,
  warehouseName,
  status = 'PAID',
  paidAmount,
  dueAmount,
  customer,
  organization,
  items = [],
  subTotal = 0,
  discountAmount = 0,
  taxAmount = 0,
  roundOff = 0,
  grandTotal = 0,
  notes,
}) => {
  const isInvoice = type === 'INVOICE';
  const orgName = organization?.name || 'NEXORA';
  const orgAddress = organization?.address || '';
  const orgGstin = organization?.gstin || '';
  const orgTagline = [orgAddress, orgGstin ? `GSTIN ${orgGstin}` : ''].filter(Boolean).join(' | ');

  const customerName = customer?.name || 'Walk-in Customer';
  const displayStatus = isInvoice
    ? status === 'PAID' ? 'Paid' : status === 'ACTIVE' ? 'Partially Paid' : status === 'CANCELLED' ? 'Cancelled' : 'Pending'
    : status || 'PENDING';

  const defaultNotes = isInvoice
    ? (notes || 'POS billing.')
    : (notes || 'Quotation valid for 30 days from issuance.');

  return (
    <div className="sales-doc-wrapper flex justify-center py-6 print:m-0 print:p-0">
      <style>{`
        :root {
          --doc-teal: #12726b;
          --doc-teal-dark: #0c4f4a;
          --doc-black: #5c5c5c;
          --doc-ink: #1c2b2a;
          --doc-paper: #ffffff;
          --doc-muted: #5c6f6d;
        }

        .doc-sheet {
          width: 800px;
          background: #ffffff;
          position: relative;
          box-shadow: 0 10px 30px rgba(0,0,0,0.12);
          color: #1c2b2a;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .doc-topbar {
          height: 14px;
          background: #5c5c5c;
        }

        .doc-header {
          position: relative;
          min-height: 180px;
          display: flex;
          background: transparent;
        }

        .doc-header-black {
          width: 58%;
          background: #5c5c5c;
          clip-path: polygon(0 0, 100% 0, 78% 100%, 0 100%);
          display: flex;
          align-items: center;
          padding: 24px 20px 24px 44px;
          color: #ffffff;
          z-index: 1;
        }

        .doc-header-teal {
          flex: 1;
          background: #12726b;
          margin-left: -14%;
          clip-path: polygon(22% 0, 100% 0, 100% 100%, 0 100%);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-end;
          padding: 24px 44px 24px 20px;
          color: #ffffff;
          z-index: 2;
        }

        .doc-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #ffffff;
        }

        .doc-logo-mark {
          width: 38px;
          height: 38px;
          background: #12726b;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 16px;
          color: #ffffff;
          flex-shrink: 0;
        }

        .doc-logo-text .doc-name {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.5px;
          line-height: 1.2;
        }

        .doc-logo-text .doc-tagline {
          font-size: 9.5px;
          color: #cfe4e2;
          max-width: 240px;
          line-height: 1.4;
          margin-top: 4px;
        }

        .doc-title {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: 2px;
          margin-bottom: 10px;
          text-align: right;
        }

        .doc-meta {
          font-size: 11.5px;
          line-height: 1.8;
          text-align: right;
        }

        .doc-meta-row {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .doc-meta-row b {
          font-weight: 600;
          color: #cfe4e2;
        }

        .doc-body {
          padding: 30px 44px 0 44px;
        }

        .doc-row-two {
          display: flex;
          justify-content: space-between;
          margin-bottom: 24px;
          gap: 20px;
        }

        .doc-label-teal {
          color: #12726b;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }

        .doc-billto .doc-party-name,
        .doc-status-block .doc-status-name {
          font-size: 15px;
          font-weight: 700;
          color: #1c2b2a;
        }

        .doc-party-detail {
          font-size: 12px;
          color: #5c6f6d;
          margin-top: 2px;
          line-height: 1.5;
        }

        .doc-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }

        .doc-table thead tr {
          background: #12726b;
          color: #ffffff;
        }

        .doc-table thead th {
          font-size: 11px;
          letter-spacing: 0.5px;
          padding: 10px 12px;
          text-align: left;
          font-weight: 700;
        }

        .doc-table thead th.right {
          text-align: right;
        }

        .doc-table tbody td {
          padding: 11px 12px;
          font-size: 12.5px;
          color: #1c2b2a;
          border-bottom: 1px solid #eef1f0;
        }

        .doc-table tbody tr:nth-child(odd) {
          background: #fafcfc;
        }

        .doc-totals-section {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-top: 20px;
          gap: 24px;
        }

        .doc-terms-box {
          flex: 1;
          max-width: 420px;
        }

        .doc-terms-box p {
          font-size: 11.5px;
          color: #5c6f6d;
          line-height: 1.6;
          margin-top: 4px;
        }

        .doc-totals-box {
          width: 280px;
          font-size: 12.5px;
        }

        .doc-totals-box .doc-line {
          display: flex;
          justify-content: space-between;
          padding: 5px 10px;
          color: #1c2b2a;
        }

        .doc-totals-box .doc-grand {
          background: #12726b;
          color: #ffffff;
          font-weight: 700;
          font-size: 14.5px;
          padding: 10px 12px;
          display: flex;
          justify-content: space-between;
          margin-top: 6px;
          border-radius: 2px;
        }

        .doc-thankyou {
          margin-top: 28px;
          font-weight: 700;
          font-size: 13px;
          color: #1c2b2a;
          letter-spacing: 0.3px;
        }

        .doc-sign {
          margin-top: 24px;
          display: flex;
          justify-content: flex-end;
        }

        .doc-sign .doc-sign-box {
          text-align: center;
          font-size: 11.5px;
          color: #1c2b2a;
          min-width: 140px;
        }

        .doc-sign .doc-sign-line {
          font-family: 'Brush Script MT', 'Segoe Script', cursive;
          font-size: 24px;
          color: #1c2b2a;
          margin-bottom: 2px;
          border-bottom: 1px solid #c7ccd2;
          padding-bottom: 4px;
        }

        .doc-footer {
          margin-top: 32px;
          background: #12726b;
          clip-path: polygon(0 0, 100% 0, 100% 100%, 5% 100%);
          padding: 16px 44px 16px 56px;
          display: flex;
          gap: 36px;
          color: #ffffff;
          font-size: 11px;
        }

        .doc-footer .doc-footer-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 130px;
          line-height: 1.4;
        }

        .doc-footer .doc-footer-item strong {
          font-size: 11px;
          font-weight: 700;
          color: #ffffff;
        }

        .doc-footer .doc-footer-item span {
          color: #cfe4e2;
        }

        .doc-bottombar {
          height: 14px;
          background: #5c5c5c;
        }

        @media print {
          body {
            background: #ffffff !important;
            padding: 0 !important;
          }
          .sales-doc-wrapper {
            padding: 0 !important;
            margin: 0 !important;
          }
          .doc-sheet {
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="doc-sheet">
        {/* Top Dark Bar */}
        <div className="doc-topbar" />

        {/* Diagonal Split Masthead Header */}
        <div className="doc-header">
          {/* Black Polygon with Logo & Org Details */}
          <div className="doc-header-black">
            <div className="doc-logo">
              {organization?.logoUrl ? (
                <img
                  src={organization.logoUrl}
                  alt={orgName}
                  className="h-10 w-10 rounded object-contain bg-white p-0.5"
                />
              ) : (
                <div className="doc-logo-mark">
                  {orgName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="doc-logo-text">
                <div className="doc-name">{orgName.toUpperCase()}</div>
                {orgTagline && <div className="doc-tagline">{orgTagline}</div>}
              </div>
            </div>
          </div>

          {/* Teal Polygon with Document Title & Metadata */}
          <div className="doc-header-teal">
            <div className="doc-title">{type}</div>
            <div className="doc-meta">
              <div className="doc-meta-row">
                <b>{isInvoice ? 'Invoice No:' : 'Quotation No:'}</b>
                <span>{docNumber}</span>
              </div>
              {docDate && (
                <div className="doc-meta-row">
                  <b>{isInvoice ? 'Invoice Date:' : 'Date:'}</b>
                  <span>{formatDate(docDate)}</span>
                </div>
              )}
              {!isInvoice && validUntil && (
                <div className="doc-meta-row">
                  <b>Valid Until:</b>
                  <span>{formatDate(validUntil)}</span>
                </div>
              )}
              {warehouseName && (
                <div className="doc-meta-row">
                  <b>Location:</b>
                  <span>{warehouseName}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Document Body */}
        <div className="doc-body">
          {/* Parties: Billed To & Status Row */}
          <div className="doc-row-two">
            <div className="doc-billto">
              <div className="doc-label-teal">{isInvoice ? 'BILLED TO' : 'QUOTATION FOR'}</div>
              <div className="doc-party-name">{customerName}</div>
              {customer?.mobile && <div className="doc-party-detail">Mobile: {customer.mobile}</div>}
              {customer?.email && <div className="doc-party-detail">Email: {customer.email}</div>}
              {customer?.address && <div className="doc-party-detail">{customer.address}</div>}
              {customer?.gstin && <div className="doc-party-detail">GSTIN: {customer.gstin}</div>}
            </div>

            <div className="doc-status-block">
              <div className="doc-label-teal">STATUS</div>
              <div className="doc-status-name">{displayStatus}</div>
              {isInvoice ? (
                <>
                  <div className="doc-party-detail">
                    Paid {formatCurrency(paidAmount ?? grandTotal)} of {formatCurrency(grandTotal)}
                  </div>
                  <div className="doc-party-detail">
                    {dueAmount && dueAmount > 0
                      ? `Balance due: ${formatCurrency(dueAmount)}`
                      : 'No balance due'}
                  </div>
                </>
              ) : (
                <>
                  {validUntil && (
                    <div className="doc-party-detail">Valid until {formatDate(validUntil)}</div>
                  )}
                  <div className="doc-party-detail">Estimated total: {formatCurrency(grandTotal)}</div>
                </>
              )}
            </div>
          </div>

          {/* Items Table */}
          <table className="doc-table">
            <thead>
              <tr>
                <th style={{ width: '45px' }}>NO.</th>
                <th>ITEM DESCRIPTION</th>
                <th className="right" style={{ width: '110px' }}>PRICE</th>
                <th className="right" style={{ width: '70px' }}>QTY</th>
                <th className="right" style={{ width: '120px' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item, index) => (
                  <tr key={item.id ?? index}>
                    <td>{String(index + 1).padStart(2, '0')}</td>
                    <td>
                      <div className="font-semibold">{item.name}</div>
                      {item.batchNo && (
                        <div className="text-[11px] text-gray-500">Batch: {item.batchNo}</div>
                      )}
                    </td>
                    <td className="text-right">{formatCurrency(item.price)}</td>
                    <td className="text-right">{item.qty}</td>
                    <td className="text-right font-semibold">{formatCurrency(item.total)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-gray-500">
                    No items in this document
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Totals & Notes Section */}
          <div className="doc-totals-section">
            <div className="doc-terms-box">
              <div className="doc-label-teal">NOTES</div>
              <p>{defaultNotes}</p>
              <p className="font-medium italic mt-2 text-gray-700">
                Amount in words: {numberToWords(grandTotal)}
              </p>
            </div>

            <div className="doc-totals-box">
              <div className="doc-line">
                <span>Subtotal:</span>
                <span>{formatCurrency(subTotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="doc-line text-red-600">
                  <span>Discount:</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="doc-line">
                  <span>Tax:</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
              )}
              {roundOff !== 0 && (
                <div className="doc-line">
                  <span>Round off:</span>
                  <span>{formatCurrency(roundOff)}</span>
                </div>
              )}
              <div className="doc-grand">
                <span>{isInvoice ? 'GRAND TOTAL:' : 'TOTAL ESTIMATE:'}</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Thank You Note */}
          <div className="doc-thankyou">THANK YOU FOR YOUR BUSINESS WITH US.</div>

          {/* Authorized Signature Block */}
          <div className="doc-sign">
            <div className="doc-sign-box">
              <div className="doc-sign-line">{orgName}</div>
              <div>Authorized Signature</div>
            </div>
          </div>
        </div>

        {/* Angled Teal Footer Banner */}
        <div className="doc-footer">
          <div className="doc-footer-item">
            <strong>Address</strong>
            <span>{orgAddress || 'Head Office'}</span>
          </div>
          <div className="doc-footer-item">
            <strong>GSTIN</strong>
            <span>{orgGstin || 'N/A'}</span>
          </div>
          <div className="doc-footer-item">
            <strong>{isInvoice ? 'Invoice' : 'Quotation'}</strong>
            <span>
              {docNumber} {docDate ? `· ${formatDate(docDate)}` : ''}
            </span>
          </div>
        </div>

        {/* Bottom Dark Bar */}
        <div className="doc-bottombar" />
      </div>
    </div>
  );
};
