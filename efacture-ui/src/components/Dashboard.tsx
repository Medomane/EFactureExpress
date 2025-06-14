import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Invoice } from '../types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Pie, Bar } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface DashboardProps {
  invoices: Invoice[];
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  invoices, 
  loading, 
  error,
  onRefresh
}) => {
  const { t, i18n } = useTranslation();

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

  // Calculate statistics
  const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const averageAmount = invoices.length > 0 ? totalAmount / invoices.length : 0;
  const readyInvoices = invoices.filter(inv => inv.status === 0);
  const submittedInvoices = invoices.filter(inv => inv.status === 1);
  const readyAmount = readyInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const submittedAmount = submittedInvoices.reduce((sum, inv) => sum + inv.total, 0);

  // Get monthly statistics
  const monthlyStats = invoices.reduce((acc, invoice) => {
    const month = new Date(invoice.date).toLocaleString(i18n.language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long' });
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

  // Calculate total amount for percentage calculations
  const totalCustomerAmount = topCustomers.reduce((sum, [, stats]) => sum + stats.amount, 0);

  // Prepare data for monthly line chart
  const monthlyChartData = {
    labels: Object.keys(monthlyStats),
    datasets: [
      {
        label: t('dashboard.monthlyAmount'),
        data: Object.values(monthlyStats).map(stats => stats.amount),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.4,
      },
    ],
  };

  // Calculate percentages for status distribution
  const totalInvoices = readyInvoices.length + submittedInvoices.length;
  const readyPercentage = totalInvoices > 0 ? (readyInvoices.length / totalInvoices) * 100 : 0;
  const submittedPercentage = totalInvoices > 0 ? (submittedInvoices.length / totalInvoices) * 100 : 0;

  // Prepare data for status pie chart
  const statusData = {
    labels: [
      `${t('invoice.status.pending')} (${readyPercentage.toFixed(1)}%)`,
      `${t('invoice.status.submitted')} (${submittedPercentage.toFixed(1)}%)`,
    ],
    datasets: [
      {
        data: [readyInvoices.length, submittedInvoices.length],
        backgroundColor: [
          'rgba(234, 179, 8, 0.8)',
          'rgba(34, 197, 94, 0.8)',
        ],
        borderColor: [
          'rgb(234, 179, 8)',
          'rgb(34, 197, 94)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Prepare data for top customers bar chart
  const topCustomersChartData = {
    labels: topCustomers.map(([customer]) => customer),
    datasets: [
      {
        label: t('dashboard.customerAmount'),
        data: topCustomers.map(([, stats]) => stats.amount),
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.raw || 0;
            const percentage = totalInvoices > 0 ? ((value / totalInvoices) * 100).toFixed(1) : 0;
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 flex items-center gap-2">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {error}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-white rounded-lg p-8 max-w-md mx-auto shadow-sm border border-gray-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('dashboard.noInvoices')}</h3>
          <p className="text-gray-500 mb-6">{t('dashboard.getStarted')}</p>
          <Link
            to="/invoices"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            {t('common.createInvoice')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            {t('dashboard.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('dashboard.welcome')}
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t('common.refresh')}
        </button>
      </div>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-50 text-blue-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-gray-600">{t('dashboard.totalInvoices')}</h2>
              <p className="text-2xl font-semibold text-gray-900">{invoices.length}</p>
              <p className="text-sm text-gray-500">
                {formatCurrency(totalAmount)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-50 text-green-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-gray-600">{t('invoice.status.submitted')}</h2>
              <p className="text-2xl font-semibold text-gray-900">{submittedInvoices.length}</p>
              <p className="text-sm text-gray-500">
                {formatCurrency(submittedAmount)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-50 text-yellow-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-gray-600">{t('invoice.status.pending')}</h2>
              <p className="text-2xl font-semibold text-gray-900">{readyInvoices.length}</p>
              <p className="text-sm text-gray-500">
                {formatCurrency(readyAmount)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-50 text-purple-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-gray-600">{t('dashboard.averageAmount')}</h2>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(averageAmount)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">{t('dashboard.monthlyTrend')}</h2>
          </div>
          <div className="p-6">
            <Line options={chartOptions} data={monthlyChartData} />
          </div>
        </div>

        {/* Status Distribution Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">{t('dashboard.statusDistribution')}</h2>
          </div>
          <div className="p-6" style={{ height: '300px' }}>
            <Pie options={chartOptions} data={statusData} />
          </div>
        </div>

        {/* Top Customers Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">{t('dashboard.topCustomersByAmount')}</h2>
          </div>
          <div className="p-6">
            <Bar options={chartOptions} data={topCustomersChartData} />
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">{t('dashboard.recentInvoices')}</h2>
            <Link 
              to="/invoices" 
              className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1"
            >
              {t('dashboard.viewAll')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            {invoices.slice(0, 5).map((invoice) => (
              <div key={invoice.id} className="px-6 py-4 hover:bg-gray-50 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {t('common.invoiceNumber')} {invoice.invoiceNumber}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(invoice.date).toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(invoice.total)}
                    </p>
                    <p className="text-sm text-gray-500">{invoice.customerName}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 