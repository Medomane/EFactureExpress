import React, { useState } from 'react';
import { Invoice } from '../types';

interface InvoiceListProps {
  invoices: Invoice[];
  loading: boolean;
  error: string;
  onDelete: (id: number) => Promise<void>;
  onDownloadPdf: (id: number) => Promise<void>;
}

const InvoiceList: React.FC<InvoiceListProps> = ({
  invoices,
  loading,
  error,
  onDelete,
  onDownloadPdf,
}) => {
  const [selectedInvoice, setSelectedInvoice] = useState<number | null>(null);
  const [sortField, setSortField] = useState<keyof Invoice>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: keyof Invoice) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedInvoices = [...invoices].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    return sortDirection === 'asc'
      ? Number(aValue) - Number(bValue)
      : Number(bValue) - Number(aValue);
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-gray-50 rounded-lg p-8 max-w-md mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Invoices Found</h3>
            <p className="text-gray-500">Get started by creating your first invoice.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('invoiceNumber')}
                  >
                    <div className="flex items-center gap-2">
                      Invoice #
                      {sortField === 'invoiceNumber' && (
                        <svg className={`w-4 h-4 ${sortDirection === 'asc' ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-2">
                      Date
                      {sortField === 'date' && (
                        <svg className={`w-4 h-4 ${sortDirection === 'asc' ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('customerName')}
                  >
                    <div className="flex items-center gap-2">
                      Customer
                      {sortField === 'customerName' && (
                        <svg className={`w-4 h-4 ${sortDirection === 'asc' ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('total')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Amount
                      {sortField === 'total' && (
                        <svg className={`w-4 h-4 ${sortDirection === 'asc' ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedInvoices.map((invoice) => (
                  <React.Fragment key={invoice.id}>
                    <tr 
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedInvoice(selectedInvoice === invoice.id ? null : invoice.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">#{invoice.invoiceNumber}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(invoice.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{invoice.customerName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MAD' }).format(invoice.total)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadPdf(invoice.id);
                            }}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-50 transition-colors"
                            title="Download PDF"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(invoice.id);
                            }}
                            className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 transition-colors"
                            title="Delete Invoice"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {selectedInvoice === invoice.id && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 bg-gray-50">
                          <div className="bg-white rounded-lg border border-gray-200 p-4">
                            <h4 className="text-sm font-medium text-gray-900 mb-3">Invoice Details</h4>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {invoice.lines.map((line, index) => (
                                    <tr key={index}>
                                      <td className="px-4 py-2 text-sm text-gray-900">{line.description}</td>
                                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{line.quantity}</td>
                                      <td className="px-4 py-2 text-sm text-gray-900 text-right">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MAD' }).format(line.unitPrice)}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-900 text-right">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MAD' }).format(line.total)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t border-gray-200">
                                    <td colSpan={3} className="px-4 py-2 text-sm font-medium text-gray-600 text-right">Subtotal:</td>
                                    <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MAD' }).format(invoice.subTotal)}
                                    </td>
                                  </tr>
                                  <tr>
                                    <td colSpan={3} className="px-4 py-2 text-sm font-medium text-gray-600 text-right">VAT:</td>
                                    <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MAD' }).format(invoice.vat)}
                                    </td>
                                  </tr>
                                  <tr className="border-t border-gray-200">
                                    <td colSpan={3} className="px-4 py-2 text-sm font-bold text-gray-900 text-right">Total:</td>
                                    <td className="px-4 py-2 text-sm font-bold text-gray-900 text-right">
                                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MAD' }).format(invoice.total)}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceList; 