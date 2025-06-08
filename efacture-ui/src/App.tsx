import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, NavLink } from "react-router-dom";
import { Invoice, NewInvoice } from "./types";
import Dashboard from "./components/Dashboard";
import InvoiceList from "./components/InvoiceList";
import CreateInvoice from "./components/CreateInvoice";
import ImportCSV from "./components/ImportCSV";
import InvoiceForm from "./components/InvoiceForm";
import { API_ENDPOINTS } from "./config/api";
import { Toaster, toast } from 'react-hot-toast';

function App() {
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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // ─── LISTING STATE ─────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);

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
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error("Invalid credentials");
      }

      const data = await response.json();
      localStorage.setItem("token", data.token);
      setToken(data.token);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "An error occurred");
    }
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
      toast.success("Invoice created successfully");
    } catch (err: any) {
      throw err;
    }
  };

  const handleUpdateInvoice = async (invoice: NewInvoice) => {
    if (!invoice.id) {
      toast.error("Cannot update invoice: Missing invoice ID");
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
      toast.success("Invoice updated successfully");
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
      console.log(data);
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
    const toastId = toast.loading('Importing CSV file...');
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(API_ENDPOINTS.INVOICES.IMPORT, {
        method: "POST",
        headers: { Authorization: token ? `Bearer ${token}` : "" },
        body: formData,
      });

      if (response.status === 401) {
        localStorage.removeItem("token");
        setToken(null);
        return;
      }

      if (!response.ok) throw new Error("Failed to import CSV");
      
      await fetchInvoices();
      toast.success('CSV file imported successfully!', { id: toastId });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(`Failed to import CSV: ${errorMessage}`, { id: toastId });
    } finally {
      setImportLoading(false);
    }
  };

  // ─── AUTH HANDLING ─────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-sm">
          <div>
            <h2 className="text-center text-3xl font-bold text-gray-900">Sign in to your account</h2>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                {loginError}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Toaster position="top-right" />
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <img
                    src="/favicon.png"
                    alt="EFacture Logo"
                    className="h-8 w-8 mr-2"
                  />
                  <h1 className="text-xl font-bold text-gray-900">EFacture</h1>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <NavLink
                    to="/"
                    className={({ isActive }) =>
                      `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        isActive
                          ? 'border-blue-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`
                    }
                  >
                    Dashboard
                  </NavLink>
                  <NavLink
                    to="/invoices"
                    className={({ isActive }) =>
                      `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        isActive
                          ? 'border-blue-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`
                    }
                  >
                    Invoices
                  </NavLink>
                </div>
              </div>
              <div className="flex items-center">
                <button
                  onClick={handleLogout}
                  className="ml-3 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<Dashboard invoices={invoices} loading={loading} error={error} onDownloadPdf={handleDownloadPdf} />} />
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
                      New Invoice
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
      </div>
    </BrowserRouter>
  );
}

export default App;
