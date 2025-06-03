export interface InvoiceLine {
    id: number;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    invoiceId: number;
  }
  
  export interface Invoice {
    id: number;
    invoiceNumber: string;
    date: string;
    customerName: string;
    subTotal: number;
    vat: number;
    total: number;
    lines: InvoiceLine[];
  }
  
  // For creating, we don’t send `id` or `invoiceId`
  export interface NewLine {
    description: string;
    quantity: number;
    unitPrice: number;
  }
  
  export interface NewInvoice {
    invoiceNumber: string;
    date: string;
    customerName: string;
    subTotal: number;
    vat: number;
    total: number;
    lines: NewLine[];
  }

  export interface PdfUrlResponse {
    url: string;
  }
  