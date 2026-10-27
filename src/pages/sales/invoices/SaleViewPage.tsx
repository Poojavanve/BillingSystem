import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Edit3 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { customerApi, organizationApi, posApi, salesApi } from '../../../api/endpoints';
import { Button } from '../../../components/ui/Button';
import { Loader } from '../../../components/ui/Loader';
import { PageHeader } from '../../../components/ui/PageHeader';
import { SalesDocumentSheet } from '../../../components/sales/SalesDocumentSheet';
import { useAuth } from '../../../hooks/useAuth';
import { PERMISSIONS } from '../../../auth/permissions';

export const SaleViewPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: rawId } = useParams<{ id: string }>();
  const id = Number(rawId);
  const { user, hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.SALES_UPDATE);
  const canPrint = hasPermission(PERMISSIONS.SALES_INVOICE_PRINT);

  const saleQuery = useQuery({
    queryKey: ['sale', id],
    queryFn: () => salesApi.getById(id),
    enabled: id > 0,
  });

  const sale = saleQuery.data?.data;
  const customerId = sale?.customer?.id;

  const customerQuery = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customerApi.getById(customerId!),
    enabled: !!customerId && customerId > 0,
  });

  const orgId = user?.organizationId;
  const organizationQuery = useQuery({
    queryKey: ['organization-profile', orgId],
    queryFn: () => organizationApi.getById(orgId!),
    enabled: !!orgId && orgId > 0,
  });

  const downloadPdf = async () => {
    if (!sale) return;
    try {
      const blob = await posApi.downloadInvoicePdf(sale.saleId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const rawCustomerName = sale.customer?.name || (customerQuery.data?.data ? `${customerQuery.data.data.firstName || ''} ${customerQuery.data.data.lastName || ''}`.trim() : '') || 'Customer';
      const safeCustomer = rawCustomerName.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Customer';
      link.download = `INV_${safeCustomer}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Invoice ${sale.invoiceNo} downloaded`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to download invoice PDF');
    }
  };

  if (saleQuery.isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Invoice Details"
          actions={
            <Button variant="outline" onClick={() => navigate('/sales/invoices')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Invoices
            </Button>
          }
        />
        <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow">
          Invoice not found.
        </div>
      </div>
    );
  }

  const customerData = customerQuery.data?.data;
  const customerAddressObj = customerData?.billingAddress || customerData?.shippingAddress;
  const customerAddress = customerAddressObj
    ? [customerAddressObj.addressLine1, customerAddressObj.addressLine2, customerAddressObj.city, customerAddressObj.stateName, customerAddressObj.pincode].filter(Boolean).join(', ')
    : undefined;
  const resolvedCustomerName = sale.customer?.name || (customerData ? `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim() : undefined);

  const orgData = organizationQuery.data?.data;
  const orgAddressObj = typeof orgData?.address === 'object' && orgData?.address !== null ? orgData.address : null;
  const orgAddress = orgAddressObj
    ? [orgAddressObj.addressLine1, orgAddressObj.addressLine2, orgAddressObj.city, orgAddressObj.stateName, orgAddressObj.pincode].filter(Boolean).join(', ')
    : typeof orgData?.address === 'string'
    ? orgData.address
    : undefined;

  const documentItems = (sale.items || []).map((item, idx) => ({
    id: `${item.itemId}-${item.batchId}-${idx}`,
    name: item.itemName,
    batchNo: item.batchNo,
    price: item.unitPrice,
    qty: item.qty,
    discount: item.discountAmount,
    tax: item.taxAmount,
    total: item.totalAmount,
  }));

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/sales/invoices')} size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <h1 className="text-xl font-bold text-gray-900">Invoice {sale.invoiceNo}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canPrint && (
            <Button variant="outline" onClick={downloadPdf} size="sm">
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => navigate(`/sales/invoices/${sale.saleId}/edit`)} size="sm">
              <Edit3 className="mr-2 h-4 w-4" /> Edit Invoice
            </Button>
          )}
        </div>
      </div>

      <SalesDocumentSheet
        type="INVOICE"
        docNumber={sale.invoiceNo}
        docDate={sale.invoiceDate}
        warehouseName={sale.warehouse?.name}
        status={sale.status}
        paidAmount={sale.paidAmount}
        dueAmount={sale.dueAmount}
        customer={{
          name: resolvedCustomerName,
          mobile: customerData?.mobile,
          email: customerData?.email,
          address: customerAddress,
          gstin: customerData?.gstNumber,
        }}
        organization={{
          name: orgData?.name || user?.organizationName || 'NEXORA',
          logoUrl: orgData?.logoUrl || user?.organizationLogoUrl,
          address: orgAddress,
          phone: orgData?.phone,
          gstin: orgData?.gstNumber,
        }}
        items={documentItems}
        subTotal={sale.subTotal}
        discountAmount={sale.discountAmount}
        taxAmount={sale.taxAmount}
        roundOff={sale.roundOff}
        grandTotal={sale.grandTotal}
        notes={sale.notes}
      />
    </div>
  );
};
