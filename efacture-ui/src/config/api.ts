export const API_BASE_URL = 'http://localhost:5000';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/api/auth/login`,
  },
  INVOICES: {
    LIST: `${API_BASE_URL}/api/invoices`,
    CREATE: `${API_BASE_URL}/api/invoices`,
    UPDATE: (id: number) => `${API_BASE_URL}/api/invoices/${id}`,
    DELETE: (id: number) => `${API_BASE_URL}/api/invoices/${id}`,
    PDF: (id: number) => `${API_BASE_URL}/api/invoices/${id}/pdf-url`,
    IMPORT: `${API_BASE_URL}/api/invoices/import-csv`,
    SUBMIT: (id: number) => `${API_BASE_URL}/api/invoices/${id}/submit`,
  },
}; 