import { useEffect, useState, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { Invoice, NewInvoice } from "./types";
import Dashboard from "./components/Dashboard";
import InvoiceList from "./components/InvoiceList";
import CreateInvoice from "./components/CreateInvoice";
import ImportCSV from "./components/ImportCSV";
import InvoiceForm from "./components/InvoiceForm";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import Users from "./components/Users";
import { API_ENDPOINTS } from "./config/api";
import { APP_CONFIG } from "./config/app";
import { Toaster, toast } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorPage from './components/ErrorPage';
import { useTranslation } from 'react-i18next';
import ProtectedRoute from './components/ProtectedRoute';
import { decodeJWT } from "./utils/jwt";

function App() {
  const { t, i18n } = useTranslation();
  // ─── AUTH STATE ───────────────────────────────────────────────────────────
  const [token, setToken] = useState<string | null>(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      const decoded = decodeJWT(storedToken);
      if (!decoded || (decoded.exp && decoded.exp * 1000 < Date.now())) {
        localStorage.removeItem("token");
        return null;
      }
      return storedToken;
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

  // ─── ACCOUNT DROPDOWN ──────────────────────────────────────────────────────
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const decoded = token ? decodeJWT(token) : null;
  const userEmail = decoded?.email || '';
  const userRole = decoded?.role || localStorage.getItem('userRole');

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

    const data = await response.json();
    
    if (!data.token) {
      throw new Error(t('errors.invalidResponse'));
    }

    // Extract user info from JWT token
    const decoded = decodeJWT(data.token);
    if (!decoded) {
      throw new Error(t('errors.invalidResponse'));
    }
    if (!decoded.role) {
      throw new Error(t('errors.invalidRole'));
    }
    if (!decoded.userId) {
      throw new Error(t('errors.invalidUserId'));
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("userRole", decoded.role);
    localStorage.setItem("userId", decoded.userId);
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
    const isAdmin = userRole === 'Admin';
    const isManager = userRole === 'Manager';
    const canAccessUsers = isAdmin || isManager;

    return (
      <nav className="bg-gradient-to-r from-white to-blue-50 shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <img
                  src={token ? APP_CONFIG.logo : APP_CONFIG.logoH}
                  alt={`${APP_CONFIG.title} Logo`}
                  className="h-8 w-auto"
                />
              </div>
              {token && (
                <div className="hidden sm:ml-8 sm:flex sm:space-x-2">
                  <NavLink
                    to="/"
                    className={({ isActive }) =>
                      `inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                        isActive
                          ? "bg-blue-50 text-blue-700 shadow-sm"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      }`
                    }
                  >
                    <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    {t('common.dashboard')}
                  </NavLink>
                  <NavLink
                    to="/invoices"
                    className={({ isActive }) =>
                      `inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                        isActive
                          ? "bg-blue-50 text-blue-700 shadow-sm"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      }`
                    }
                  >
                    <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {t('common.invoices')}
                  </NavLink>
                  {canAccessUsers && (
                    <NavLink
                      to="/users"
                      className={({ isActive }) =>
                        `inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                          isActive
                            ? "bg-blue-50 text-blue-700 shadow-sm"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                        }`
                      }
                    >
                      <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      {t('common.users')}
                    </NavLink>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={toggleLanguage}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white rounded-md border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {i18n.language === 'en' ? 'FR' : 'EN'}
              </button>
              {token && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen((open) => !open)}
                    className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-gray-700 bg-white rounded-md border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    aria-haspopup="true"
                    aria-expanded={dropdownOpen}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <span className="max-w-[150px] truncate">{userEmail}</span>
                    <svg className={`w-5 h-5 text-gray-400 transition-transform duration-150 ${dropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 animate-fadeIn">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="font-medium text-gray-900 truncate">{userEmail}</div>
                        <div className="text-sm text-gray-500 mt-0.5 flex items-center">
                          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                            userRole === 'Admin' ? 'bg-indigo-400' :
                            userRole === 'Manager' ? 'bg-amber-400' :
                            'bg-green-400'
                          }`}></span>
                          <span className="capitalize">{userRole}</span>
                        </div>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2 transition-colors duration-150"
                      >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" />
                        </svg>
                        <span>{t('common.logout')}</span>
                      </button>
                    </div>
                  )}
                </div>
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
                    <ProtectedRoute>
                      <Dashboard
                        invoices={invoices}
                        loading={loading}
                        error={error}
                        onRefresh={fetchInvoices}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/invoices"
                  element={
                    <ProtectedRoute>
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
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/invoices/create" 
                  element={
                    <ProtectedRoute>
                      <CreateInvoice onSubmit={handleCreateInvoice} disabled={importLoading} />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                      <Users token={token} />
                    </ProtectedRoute>
                  }
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
