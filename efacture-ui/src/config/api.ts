export const API_BASE_URL = '/api';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/auth/login`,
  },
  INVOICES: {
    LIST: `${API_BASE_URL}/invoices`,
    CREATE: `${API_BASE_URL}/invoices`,
    UPDATE: (id: number) => `${API_BASE_URL}/invoices/${id}`,
    DELETE: (id: number) => `${API_BASE_URL}/invoices/${id}`,
    PDF: (id: number) => `${API_BASE_URL}/invoices/${id}/pdf-url`,
    IMPORT: `${API_BASE_URL}/invoices/import-csv`,
    SUBMIT: (id: number) => `${API_BASE_URL}/invoices/${id}/submit`,
  },
}; 