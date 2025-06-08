import React, { useState, useMemo } from 'react';
import { Invoice, NewInvoice } from '../types';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import InvoiceForm from './InvoiceForm';

interface InvoiceListProps {
  invoices: Invoice[];
  loading: boolean;
  error: string;
  onDelete: (id: number) => void;
  onDownloadPdf: (id: number) => void;
  onSubmit: (id: number) => void;
  onCreateInvoice: (invoice: NewInvoice) => Promise<void>;
  onUpdateInvoice: (invoice: NewInvoice) => Promise<void>;
  disabled?: boolean;
  importLoading: boolean;
  onImportCSV: (file: File) => Promise<void>;
}

interface Filters {
  dateFrom: string;
  dateTo: string;
  customerName: string;
  status: string;
  amountFrom: string;
  amountTo: string;
}

const InvoiceList: React.FC<InvoiceListProps> = ({
  invoices,
  loading,
  error,
  onDelete,
  onDownloadPdf,
  onSubmit,
  onCreateInvoice,
  onUpdateInvoice,
  disabled = false,
  importLoading,
  onImportCSV
}) => {
  const { t, i18n } = useTranslation();
  const [selectedInvoice, setSelectedInvoice] = useState<number | null>(null);
  const [sortField, setSortField] = useState<keyof Invoice>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<number>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<{
    type: 'submit' | 'delete';
    count: number;
  } | null>(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | undefined>();

  const [filters, setFilters] = useState<Filters>({
    dateFrom: '',
    dateTo: '',
    customerName: '',
    status: 'all',
    amountFrom: '',
    amountTo: ''
  });

  const handleSort = (field: keyof Invoice) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      customerName: '',
      status: 'all',
      amountFrom: '',
      amountTo: ''
    });
  };

  const filteredAndSortedInvoices = useMemo(() => {
    let filtered = [...invoices];

    // Apply filters
    if (filters.dateFrom) {
      filtered = filtered.filter(invoice => new Date(invoice.date) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      filtered = filtered.filter(invoice => new Date(invoice.date) <= new Date(filters.dateTo));
    }
    if (filters.customerName) {
      filtered = filtered.filter(invoice => 
        invoice.customerName.toLowerCase().includes(filters.customerName.toLowerCase())
      );
    }
    if (filters.status !== 'all') {
      filtered = filtered.filter(invoice => invoice.status.toString() === filters.status);
    }
    if (filters.amountFrom) {
      filtered = filtered.filter(invoice => invoice.total >= Number(filters.amountFrom));
    }
    if (filters.amountTo) {
      filtered = filtered.filter(invoice => invoice.total <= Number(filters.amountTo));
    }

    // Apply sorting
    return filtered.sort((a, b) => {
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
  }, [invoices, filters, sortField, sortDirection]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const readyInvoices = filteredAndSortedInvoices
        .filter(inv => inv.status === 0)
        .map(inv => inv.id);
      setSelectedInvoices(new Set(readyInvoices));
    } else {
      setSelectedInvoices(new Set());
    }
  };

  const handleSelectInvoice = (id: number, status: number) => {
    const newSelected = new Set(selectedInvoices);
    if (status === 0) { // Only allow selecting ready invoices
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      setSelectedInvoices(newSelected);
    }
  };

  const handleBulkSubmit = async () => {
    if (selectedInvoices.size === 0) return;
    
    setShowConfirmDialog({
      type: 'submit',
      count: selectedInvoices.size
    });
  };

  const handleBulkDelete = async () => {
    if (selectedInvoices.size === 0) return;
    
    setShowConfirmDialog({
      type: 'delete',
      count: selectedInvoices.size
    });
  };

  const confirmBulkAction = async () => {
    if (!showConfirmDialog) return;

    const toastId = toast.loading(
      showConfirmDialog.type === 'submit' 
        ? t('invoice.bulk.submitting', { count: showConfirmDialog.count })
        : t('invoice.bulk.deleting', { count: showConfirmDialog.count })
    );

    // Close the confirmation dialog immediately
    setShowConfirmDialog(null);

    try {
      if (showConfirmDialog.type === 'submit') {
        await Promise.all(
          Array.from(selectedInvoices).map(id => onSubmit(id))
        );
        toast.success(t('success.bulkInvoicesSubmitted', { count: showConfirmDialog.count }), { id: toastId });
      } else {
        await Promise.all(
          Array.from(selectedInvoices).map(id => onDelete(id))
        );
        toast.success(t('success.bulkInvoicesDeleted', { count: showConfirmDialog.count }), { id: toastId });
      }
      setSelectedInvoices(new Set());
      setShowBulkActions(false);
    } catch (error) {
      toast.error(
        t('errors.bulkActionFailed', { 
          action: showConfirmDialog.type === 'submit' ? t('invoice.actions.submit') : t('invoice.actions.delete'),
          error: error instanceof Error ? error.message : t('errors.unknown')
        }),
        { id: toastId }
      );
    }
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setShowInvoiceForm(true);
  };

  const handleCreateInvoice = () => {
    setEditingInvoice(undefined);
    setShowInvoiceForm(true);
  };

  const handleInvoiceFormSubmit = async (invoice: NewInvoice) => {
    if (editingInvoice) {
      await onUpdateInvoice(invoice);
    } else {
      await onCreateInvoice(invoice);
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm(t('invoice.confirm.message', { 
      action: t('invoice.actions.delete'),
      count: 1,
      plural: '',
      warning: t('invoice.confirm.warning')
    }))) {
      onDelete(id);
    }
  };

  const handleSubmit = (id: number) => {
    if (window.confirm(t('invoice.confirm.message', { 
      action: t('invoice.actions.submit'),
      count: 1,
      plural: '',
      warning: ''
    }))) {
      onSubmit(id);
    }
  };

  // Format currency based on current language
  const formatCurrency = (amount: number) => {
    if (i18n.language === 'fr') {
      // French format: 1 234,56 MAD
      return new Intl.NumberFormat('fr-FR', { 
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount) + ' MAD';
    } else {
      // English format: MAD 1,234.56
      return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'MAD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    }
  };

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

      {/* Filters Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">{t('invoice.filters.title')}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              {showFilters ? t('invoice.filters.hide') : t('invoice.filters.show')}
              <svg 
                className={`w-4 h-4 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={resetFilters}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              {t('invoice.filters.reset')}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">{t('invoice.filters.dateRange')}</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  name="dateFrom"
                  value={filters.dateFrom}
                  onChange={handleFilterChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <input
                  type="date"
                  name="dateTo"
                  value={filters.dateTo}
                  onChange={handleFilterChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">{t('invoice.filters.customerName')}</label>
              <input
                type="text"
                name="customerName"
                value={filters.customerName}
                onChange={handleFilterChange}
                placeholder={t('invoice.filters.searchCustomer')}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">{t('invoice.filters.status')}</label>
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="all">{t('invoice.filters.all')}</option>
                <option value="0">{t('invoice.status.pending')}</option>
                <option value="1">{t('invoice.status.submitted')}</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">{t('invoice.filters.amountRange')}</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  name="amountFrom"
                  value={filters.amountFrom}
                  onChange={handleFilterChange}
                  placeholder={t('invoice.filters.min')}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <input
                  type="number"
                  name="amountTo"
                  value={filters.amountTo}
                  onChange={handleFilterChange}
                  placeholder={t('invoice.filters.max')}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedInvoices.size > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                {t('invoice.bulk.selected', { count: selectedInvoices.size })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkSubmit}
                disabled={disabled}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors ${
                  disabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {t('invoice.bulk.submit')}
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={disabled}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors ${
                  disabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {t('invoice.bulk.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {filteredAndSortedInvoices.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-gray-50 rounded-lg p-8 max-w-md mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('invoice.list.noInvoices')}</h3>
            <p className="text-gray-500">
              {Object.values(filters).some(v => v !== '' && v !== 'all') 
                ? t('invoice.list.adjustFilters')
                : t('invoice.list.getStarted')}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="relative px-6 py-3">
                    <input
                      type="checkbox"
                      className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedInvoices.size === filteredAndSortedInvoices.filter(inv => inv.status === 0).length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('invoiceNumber')}
                  >
                    <div className="flex items-center gap-2">
                      {t('invoice.list.invoiceNumber')}
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
                      {t('invoice.list.date')}
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
                      {t('invoice.list.customer')}
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
                      {t('invoice.list.amount')}
                      {sortField === 'total' && (
                        <svg className={`w-4 h-4 ${sortDirection === 'asc' ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('invoice.list.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedInvoices.map((invoice) => (
                  <React.Fragment key={invoice.id}>
                    <tr 
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedInvoice(selectedInvoice === invoice.id ? null : invoice.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedInvoices.has(invoice.id)}
                          onChange={() => handleSelectInvoice(invoice.id, invoice.status)}
                          disabled={invoice.status !== 0}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">#{invoice.invoiceNumber}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(invoice.date).toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{invoice.customerName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(invoice.total)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {invoice.status === 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditInvoice(invoice);
                              }}
                              disabled={disabled}
                              className={`text-blue-600 hover:text-blue-900 ${
                                disabled ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              title={t('invoice.actions.edit')}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                          {invoice.status === 0 ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSubmit(invoice.id);
                              }}
                              disabled={disabled}
                              className={`text-green-600 hover:text-green-900 ${
                                disabled ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              title={t('invoice.actions.submit')}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                            </button>
                          ) : (
                            <div className="text-green-600 p-1" title={t('invoice.status.submitted')}>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadPdf(invoice.id);
                            }}
                            disabled={disabled}
                            className={`text-blue-600 hover:text-blue-900 ${
                              disabled ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title={t('invoice.actions.download')}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                          {invoice.status === 0 && (
                            <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(invoice.id);
                            }}
                            disabled={disabled}
                            className={`text-red-600 hover:text-red-900 ${
                              disabled ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title={t('invoice.actions.delete')}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {selectedInvoice === invoice.id && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 bg-gray-50">
                          <div className="bg-white rounded-lg border border-gray-200 p-4">
                            <h4 className="text-sm font-medium text-gray-900 mb-3">{t('invoice.details.title')}</h4>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('invoice.details.description')}</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('invoice.details.quantity')}</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('invoice.details.unitPrice')}</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('invoice.details.total')}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {invoice.lines.map((line, index) => (
                                    <tr key={index}>
                                      <td className="px-4 py-2 text-sm text-gray-900">{line.description}</td>
                                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{line.quantity}</td>
                                      <td className="px-4 py-2 text-sm text-gray-900 text-right">
                                        {formatCurrency(line.unitPrice)}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-900 text-right">
                                        {formatCurrency(line.total)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t border-gray-200">
                                    <td colSpan={3} className="px-4 py-2 text-sm font-medium text-gray-600 text-right">{t('invoice.details.subtotal')}:</td>
                                    <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                                      {formatCurrency(invoice.subTotal)}
                                    </td>
                                  </tr>
                                  <tr>
                                    <td colSpan={3} className="px-4 py-2 text-sm font-medium text-gray-600 text-right">{t('invoice.details.vat')}:</td>
                                    <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                                      {formatCurrency(invoice.vat)}
                                    </td>
                                  </tr>
                                  <tr className="border-t border-gray-200">
                                    <td colSpan={3} className="px-4 py-2 text-sm font-bold text-gray-900 text-right">{t('invoice.details.total')}:</td>
                                    <td className="px-4 py-2 text-sm font-bold text-gray-900 text-right">
                                      {formatCurrency(invoice.total)}
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

      {/* Invoice Form Modal */}
      {showInvoiceForm && (
        <InvoiceForm
          onSubmit={handleInvoiceFormSubmit}
          onClose={() => {
            setShowInvoiceForm(false);
            setEditingInvoice(undefined);
          }}
          invoice={editingInvoice}
          disabled={disabled}
        />
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {t('invoice.confirm.title', { action: showConfirmDialog.type === 'submit' ? t('invoice.actions.submit') : t('invoice.actions.delete') })}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {t('invoice.confirm.message', { 
                action: showConfirmDialog.type === 'submit' ? t('invoice.actions.submit') : t('invoice.actions.delete'),
                count: showConfirmDialog.count,
                plural: showConfirmDialog.count !== 1 ? 's' : '',
                warning: showConfirmDialog.type === 'delete' ? t('invoice.confirm.warning') : ''
              })}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDialog(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmBulkAction}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  showConfirmDialog.type === 'submit'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {showConfirmDialog.type === 'submit' ? t('invoice.actions.submit') : t('invoice.actions.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceList; 