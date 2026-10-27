import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Download, Edit3 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { customerApi, organizationApi, quotationApi } from '../../../api/endpoints';
import { Button } from '../../../components/ui/Button';
import { Loader } from '../../../components/ui/Loader';
import { PageHeader } from '../../../components/ui/PageHeader';
import { SalesDocumentSheet } from '../../../components/sales/SalesDocumentSheet';
import { useAuth } from '../../../hooks/useAuth';
import { useConfirmation } from '../../../hooks/useConfirmation';
import { queryClient } from '../../../app/queryClient';
import { PERMISSIONS } from '../../../auth/permissions';

export const QuotationViewPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: rawId } = useParams<{ id: string }>();
  const id = Number(rawId);
  const { user, hasPermission } = useAuth();
  const canCreateInvoice = hasPermission(PERMISSIONS.SALES_CREATE);
  const { confirmAction, confirmationDialog } = useConfirmation();

  const quotationQuery = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => quotationApi.getById(id),
    enabled: id > 0,
  });

  const quotation = quotationQuery.data?.data;
  const customerId = quotation?.customer?.id;

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

  const convertMutation = useMutation({
    mutationFn: (quotationId: number) => quotationApi.convertToInvoice(quotationId),
    onSuccess: (res) => {
      toast.success(`Quotation converted to Invoice ${res.data.invoiceNo}`);
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      navigate(`/sales/invoices/${res.data.saleId}`);
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to convert quotation to invoice');
    },
  });

  const downloadPdf = async () => {
    if (!quotation) return;
    try {
      const blob = await quotationApi.downloadPdf(quotation.quotationId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const rawCustomerName = quotation.customer?.name || (customerQuery.data?.data ? `${customerQuery.data.data.firstName || ''} ${customerQuery.data.data.lastName || ''}`.trim() : '') || 'Customer';
      const safeCustomer = rawCustomerName.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Customer';
      link.download = `QTN_${safeCustomer}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Quotation ${quotation.quotationNo} downloaded`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to download quotation PDF');
    }
  };

  const handleConvert = async () => {
    if (!quotation) return;
    const confirmed = await confirmAction({
      title: 'Convert Quotation to Invoice',
      message: `Are you sure you want to convert quotation ${quotation.quotationNo} to a sales invoice?`,
      confirmText: 'Convert',
      variant: 'info',
    });
    if (confirmed) {
      convertMutation.mutate(quotation.quotationId);
    }
  };

  if (quotationQuery.isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Quotation Details"
          actions={
            <Button variant="outline" onClick={() => navigate('/sales/quotations')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quotations
            </Button>
          }
        />
        <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow">
          Quotation not found.
        </div>
      </div>
    );
  }

  const customerData = customerQuery.data?.data;
  const customerAddressObj = customerData?.billingAddress || customerData?.shippingAddress;
  const customerAddress = customerAddressObj
    ? [customerAddressObj.addressLine1, customerAddressObj.addressLine2, customerAddressObj.city, customerAddressObj.stateName, customerAddressObj.pincode].filter(Boolean).join(', ')
    : undefined;
  const resolvedCustomerName = quotation.customer?.name || (customerData ? `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim() : undefined);

  const orgData = organizationQuery.data?.data;
  const orgAddressObj = typeof orgData?.address === 'object' && orgData?.address !== null ? orgData.address : null;
  const orgAddress = orgAddressObj
    ? [orgAddressObj.addressLine1, orgAddressObj.addressLine2, orgAddressObj.city, orgAddressObj.stateName, orgAddressObj.pincode].filter(Boolean).join(', ')
    : typeof orgData?.address === 'string'
    ? orgData.address
    : undefined;

  const documentItems = (quotation.items || []).map((item, idx) => ({
    id: `${item.itemId}-${idx}`,
    name: item.itemName,
    price: item.unitPrice,
    qty: item.qty,
    discount: item.discountAmount,
    tax: item.taxAmount,
    total: item.totalAmount,
  }));

  const canConvert = canCreateInvoice && !quotation.convertedSaleId && !['CONVERTED', 'CANCELLED', 'REJECTED'].includes(quotation.status?.toUpperCase() || '');

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/sales/quotations')} size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <h1 className="text-xl font-bold text-gray-900">Quotation {quotation.quotationNo}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={downloadPdf} size="sm">
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
          <Button onClick={() => navigate(`/sales/quotations/${quotation.quotationId}/edit`)} size="sm">
            <Edit3 className="mr-2 h-4 w-4" /> Edit Quotation
          </Button>
          {canConvert && (
            <Button onClick={handleConvert} disabled={convertMutation.isPending} size="sm" className="bg-teal-700 hover:bg-teal-800 text-white">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Convert to Invoice
            </Button>
          )}
        </div>
      </div>

      <SalesDocumentSheet
        type="QUOTATION"
        docNumber={quotation.quotationNo}
        docDate={quotation.quotationDate}
        validUntil={quotation.validUntil}
        warehouseName={quotation.warehouse?.name}
        status={quotation.status}
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
        subTotal={quotation.subTotal}
        discountAmount={quotation.discountAmount}
        taxAmount={quotation.taxAmount}
        roundOff={quotation.roundOff}
        grandTotal={quotation.grandTotal}
        notes={quotation.notes}
      />

      {confirmationDialog}
    </div>
  );
};
