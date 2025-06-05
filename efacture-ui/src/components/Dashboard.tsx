import React from 'react';
import { Link } from 'react-router-dom';
import { Invoice } from '../types';

interface DashboardProps {
  invoices: Invoice[];
  loading: boolean;
  error: string;
  onDownloadPdf?: (id: number) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  invoices, 
  loading, 
  error,
  onDownloadPdf 
}) => {
  // Calculate statistics
  const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const averageAmount = invoices.length > 0 ? totalAmount / invoices.length : 0;
  const readyInvoices = invoices.filter(inv => inv.status === 0);
  const submittedInvoices = invoices.filter(inv => inv.status === 1);
  const readyAmount = readyInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const submittedAmount = submittedInvoices.reduce((sum, inv) => sum + inv.total, 0);

  // Get monthly statistics
  const monthlyStats = invoices.reduce((acc, invoice) => {
    const month = new Date(invoice.date).toLocaleString('default', { month: 'long' });
    if (!acc[month]) {
      acc[month] = { count: 0, amount: 0 };
    }
    acc[month].count++;
    acc[month].amount += invoice.total;
    return acc;
  }, {} as Record<string, { count: number; amount: number }>);

  // Get top customers
  const customerStats = invoices.reduce((acc, invoice) => {
    if (!acc[invoice.customerName]) {
      acc[invoice.customerName] = { count: 0, amount: 0 };
    }
    acc[invoice.customerName].count++;
    acc[invoice.customerName].amount += invoice.total;
    return acc;
  }, {} as Record<string, { count: number; amount: number }>);

  const topCustomers = Object.entries(customerStats)
    .sort(([, a], [, b]) => b.amount - a.amount)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
        {error}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-gray-50 rounded-lg p-8 max-w-md mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Invoices Found</h3>
          <p className="text-gray-500">Get started by creating your first invoice.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-50 text-blue-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-gray-600">Total Invoices</h2>
              <p className="text-2xl font-semibold text-gray-900">{invoices.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-50 text-green-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-gray-600">Submitted</h2>
              <p className="text-2xl font-semibold text-gray-900">{submittedInvoices.length}</p>
              <p className="text-sm text-gray-500">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MAD' }).format(submittedAmount)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-50 text-yellow-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-gray-600">Ready</h2>
              <p className="text-2xl font-semibold text-gray-900">{readyInvoices.length}</p>
              <p className="text-sm text-gray-500">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MAD' }).format(readyAmount)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-50 text-purple-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-gray-600">Average Amount</h2>
              <p className="text-2xl font-semibold text-gray-900">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MAD' }).format(averageAmount)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Statistics */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Monthly Statistics</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(monthlyStats).map(([month, stats]) => (
              <div key={month} className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-600">{month}</h3>
                <p className="text-lg font-semibold text-gray-900">{stats.count} invoices</p>
                <p className="text-sm text-gray-500">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MAD' }).format(stats.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Customers */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Top Customers</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {topCustomers.map(([customer, stats]) => (
              <div key={customer} className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{customer}</h3>
                  <p className="text-sm text-gray-500">{stats.count} invoices</p>
                </div>
                <p className="text-sm font-medium text-gray-900">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MAD' }).format(stats.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Recent Invoices</h2>
          <Link 
            to="/invoices" 
            className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            View all invoices →
          </Link>
        </div>
        <div className="divide-y divide-gray-200">
          {invoices.slice(0, 5).map((invoice) => (
            <div key={invoice.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Invoice #{invoice.invoiceNumber}</p>
                  <p className="text-sm text-gray-500">{new Date(invoice.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MAD' }).format(invoice.total)}
                  </p>
                  <p className="text-sm text-gray-500">{invoice.customerName}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 