import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { Invoice, NewInvoice } from "./types";
import Dashboard from "./components/Dashboard";
import InvoiceList from "./components/InvoiceList";
import CreateInvoice from "./components/CreateInvoice";
import ImportCSV from "./components/ImportCSV";
import InvoiceForm from "./components/InvoiceForm";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import { API_ENDPOINTS } from "./config/api";
import { APP_CONFIG } from "./config/app";
import { Toaster, toast } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorPage from './components/ErrorPage';
import { useTranslation } from 'react-i18next';

function App() {
  const { t, i18n } = useTranslation();
  // ─── AUTH STATE ───────────────────────────────────────────────────────────
  const [token, setToken] = useState<string | null>(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      try {
        // Check if token is expired
        const payload = JSON.parse(atob(storedToken.split('.')[1]));
        if (payload.exp * 1000 < Date.now()) {
          localStorage.removeItem("token");
          return null;
        }
        return storedToken;
      } catch {
        localStorage.removeItem("token");
        return null;
      }
    }
    return null;
  });

  // ─── LISTING STATE ─────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);

  // ─── LANGUAGE STATE ───────────────────────────────────────────────────────
  const [language] = useState(() => {
    const savedLanguage = localStorage.getItem('language');
    return savedLanguage || 'fr';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
    i18n.changeLanguage(language);
  }, [language]);

  // ─── FETCH LIST ────────────────────────────────────────────────────────────
  const fetchInvoices = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(API_ENDPOINTS.INVOICES.LIST, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      
      if (response.status === 401) {
        // Token is invalid or expired
        localStorage.removeItem("token");
        setToken(null);
        return;
      }
      
      if (!response.ok) throw new Error("Failed to fetch invoices");
      const data = await response.json();
      setInvoices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchInvoices();
    }
  }, [token]);

  // ─── HANDLERS ─────────────────────────────────────────────────────────────
  const handleLogin = async (email: string, password: string) => {
    const response = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(t('errors.invalidCredentials'));
    }

    

    if (!response.ok) {
      throw new Error(t('errors.invalidCredentials'));
    }

    const data = await response.json();
    
    if (!data.token) {
      throw new Error(t('errors.invalidResponse'));
    }

    // Extract role from JWT token
    const tokenPayload = JSON.parse(atob(data.token.split('.')[1]));
    
    // Get role from claims
    const roleClaim = tokenPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
    if (!roleClaim) {
      throw new Error(t('errors.invalidRole'));
    }

    // Map the role to our UserRole enum
    const role = roleClaim === 'Admin' ? 'Admin' : 
                roleClaim === 'Manager' ? 'Manager' : 
                roleClaim === 'Clerk' ? 'Clerk' : null;
    console.log(role);
    if (!role) {
      throw new Error(t('errors.invalidRole'));
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("userRole", role);
    setToken(data.token);    
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  const handleCreateInvoice = async (newInvoice: NewInvoice) => {
    try {
      const response = await fetch(API_ENDPOINTS.INVOICES.CREATE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(newInvoice),
      });

      if (response.status === 401) {
        localStorage.removeItem("token");
        setToken(null);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw errorData;
      }
      
      await fetchInvoices();
      toast.success(t('success.invoiceCreated'));
    } catch (err: any) {
      throw err;
    }
  };

  const handleUpdateInvoice = async (invoice: NewInvoice) => {
    if (!invoice.id) {
      toast.error(t('errors.failedToUpdateInvoice'));
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.INVOICES.UPDATE(invoice.id), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(invoice),
      });

      if (response.status === 401) {
        localStorage.removeItem("token");
        setToken(null);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw errorData;
      }
      
      await fetchInvoices();
      toast.success(t('success.invoiceUpdated'));
    } catch (err: any) {
      throw err;
    }
  };

  const handleDeleteInvoice = async (id: number) => {
    try {
      const response = await fetch(API_ENDPOINTS.INVOICES.DELETE(id), {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });

      if (response.status === 401) {
        localStorage.removeItem("token");
        setToken(null);
        return;
      }

      if (!response.ok) throw new Error("Failed to delete invoice");
      
      await fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDownloadPdf = async (id: number) => {
    try {
      const response = await fetch(API_ENDPOINTS.INVOICES.PDF(id), {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });

      if (response.status === 401) {
        localStorage.removeItem("token");
        setToken(null);
        return;
      }

      if (!response.ok) throw new Error("Failed to download PDF");
      const data = await response.json();
      window.open(data.url, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleSubmitInvoice = async (id: number) => {
    try {
      const response = await fetch(API_ENDPOINTS.INVOICES.SUBMIT(id), {
        method: "POST",
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });

      if (response.status === 401) {
        localStorage.removeItem("token");
        setToken(null);
        return;
      }

      if (!response.ok) throw new Error("Failed to submit invoice");
      
      await fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleImportCSV = async (file: File) => {
    setImportLoading(true);
    setError("");
    const toastId = toast.loading(t('common.importingCSV'));
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(API_ENDPOINTS.INVOICES.IMPORT, {
        method: "POST",
        headers: { Authorization: token ? `Bearer ${token}` : "" },
        body: formData,
      });

      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("token");
        setToken(null);
        return;
      }

      if (!response.ok) {
        let errorMessages: string[] = [];
        
        // Handle general errors
        if (data.errors && Array.isArray(data.errors)) {
          errorMessages = [...data.errors];
        }
        
        // Handle row-specific errors
        if (data.rowErrors && Array.isArray(data.rowErrors)) {
          const rowErrorMessages = data.rowErrors.map((rowError: { rowNumber: number; errors: string[] }) => {
            return `Row ${rowError.rowNumber}:\n${rowError.errors.join('\n')}`;
          });
          errorMessages = [...errorMessages, ...rowErrorMessages];
        }

        if (errorMessages.length > 0) {
          throw new Error(errorMessages.join('\n'));
        }
        
        throw new Error(t('errors.failedToImportCSV'));
      }
      
      await fetchInvoices();
      toast.success(t('success.csvImported'), { id: toastId });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.anErrorOccurred');
      setError(errorMessage);
      // If the error message contains multiple lines (from array of errors), show them in a more readable format
      const displayMessage = errorMessage.includes('\n') 
        ? `${t('errors.failedToImportCSV')}:\n${errorMessage}`
        : `${t('errors.failedToImportCSV')}: ${errorMessage}`;
      toast.error(displayMessage, { 
        id: toastId,
        duration: 5000, // Show for 5 seconds since there might be multiple errors
      });
    } finally {
      setImportLoading(false);
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'fr' : 'en';
    i18n.changeLanguage(newLang);
  };

  // ─── RENDER NAVBAR ─────────────────────────────────────────────────────────
  const renderNavbar = () => {
    return (
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <img
                  src={token ? APP_CONFIG.logo : APP_CONFIG.logoH}
                  alt={`${APP_CONFIG.title} Logo`}
                  className="h-8 mr-2"
                />
              </div>
              {token && (
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <NavLink
                    to="/"
                    className={({ isActive }) =>
                      `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        isActive
                          ? "border-blue-500 text-gray-900"
                          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                      }`
                    }
                  >
                    {t('common.dashboard')}
                  </NavLink>
                  <NavLink
                    to="/invoices"
                    className={({ isActive }) =>
                      `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        isActive
                          ? "border-blue-500 text-gray-900"
                          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                      }`
                    }
                  >
                    {t('common.invoices')}
                  </NavLink>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleLanguage}
                className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                {i18n.language === 'en' ? 'FR' : 'EN'}
              </button>
              {token && (
                <button
                  onClick={handleLogout}
                  className="ml-3 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {t('common.logout')}
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>
    );
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <ErrorBoundary
      fallback={
        <ErrorPage
          title="Application Error"
          message="Something went wrong in the application. Please try refreshing the page."
          onRetry={() => window.location.reload()}
        />
      }
    >
      <BrowserRouter>
        <div className="min-h-screen bg-gray-100">
          <Toaster position="top-right" />
          {renderNavbar()}

          {!token ? (
            <Routes>
              <Route
                path="/login"
                element={
                  <LoginPage
                    onLogin={handleLogin}
                    onToggleLanguage={toggleLanguage}
                    currentLanguage={i18n.language}
                  />
                }
              />
              <Route
                path="/register"
                element={
                  <RegisterPage
                    onToggleLanguage={toggleLanguage}
                    currentLanguage={i18n.language}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          ) : (
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
              <Routes>
                <Route
                  path="/"
                  element={
                    <Dashboard
                      invoices={invoices}
                      loading={loading}
                      error={error}
                      onRefresh={fetchInvoices}
                    />
                  }
                />
                <Route
                  path="/invoices"
                  element={
                    <div>
                      <div className="mb-6 flex items-center justify-between">
                        <ImportCSV onImport={handleImportCSV} loading={importLoading} />
                        <button
                          onClick={() => setShowInvoiceForm(true)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors ${
                            importLoading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          {t('common.newInvoice')}
                        </button>
                      </div>

                      <div className="bg-white rounded-lg border border-gray-200">
                        <InvoiceList 
                          invoices={invoices} 
                          loading={loading} 
                          error={error} 
                          onDelete={handleDeleteInvoice}
                          onDownloadPdf={handleDownloadPdf}
                          onSubmit={handleSubmitInvoice}
                          onCreateInvoice={handleCreateInvoice}
                          onUpdateInvoice={handleUpdateInvoice}
                          disabled={importLoading}
                          importLoading={importLoading}
                          onImportCSV={handleImportCSV}
                        />
                      </div>

                      {showInvoiceForm && (
                        <InvoiceForm
                          onSubmit={handleCreateInvoice}
                          onClose={() => setShowInvoiceForm(false)}
                          disabled={importLoading}
                        />
                      )}
                    </div>
                  } 
                />
                <Route 
                  path="/invoices/create" 
                  element={<CreateInvoice onSubmit={handleCreateInvoice} disabled={importLoading} />} 
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          )}
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
