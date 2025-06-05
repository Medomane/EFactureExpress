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
    status: number; // 0 = Ready, 1 = Submitted
  }
  
  // For creating, we don't send `id` or `invoiceId`
  export interface NewLine {
    description: string;
    quantity: number;
    unitPrice: number;
  }
  
  export interface NewInvoice {
    id?: number; // Optional id for updates
    invoiceNumber: string;
    date: string;
    customerName: string;
    subTotal: number;
    vat: number;
    total: number;
    status: number; // 0 = Ready, 1 = Submitted
    lines: NewLine[];
  }

  export interface PdfUrlResponse {
    url: string;
  }
  