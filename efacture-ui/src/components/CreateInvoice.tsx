import React, { useState } from 'react';
import { NewInvoice, NewLine } from '../types';

interface CreateInvoiceProps {
  onSubmit: (invoice: NewInvoice) => Promise<void>;
  disabled?: boolean;
}

const CreateInvoice: React.FC<CreateInvoiceProps> = ({ onSubmit, disabled = false }) => {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [vatRate, setVatRate] = useState(20); // Default VAT rate of 20%
  const [lines, setLines] = useState<NewLine[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);

  const updateLine = (index: number, field: keyof NewLine, value: string) => {
    setLines((prev) =>
      prev.map((ln, i) =>
        i === index
          ? { ...ln, [field]: field === "description" ? value : Number(value) }
          : ln
      )
    );
  };

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      { description: "", quantity: 1, unitPrice: 0 },
    ]);

  const removeLine = (index: number) =>
    setLines((prev) => prev.filter((_, i) => i !== index));

  const computeTotals = () => {
    const sub = lines.reduce(
      (sum, ln) => sum + ln.quantity * ln.unitPrice,
      0
    );
    const vat = +(sub * (vatRate / 100)).toFixed(2);
    return { subTotal: +sub.toFixed(2), vat, total: +(sub + vat).toFixed(2) };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    
    const { subTotal, vat, total } = computeTotals();

    const newInvoice: NewInvoice = {
      invoiceNumber,
      date,
      customerName,
      subTotal,
      vat,
      total,
      status: 0, // 0 = Ready
      lines: lines.map((ln) => ({
        description: ln.description,
        quantity: ln.quantity,
        unitPrice: ln.unitPrice,
      })),
    };

    await onSubmit(newInvoice);
    
    // Reset form
    setInvoiceNumber("");
    setDate("");
    setCustomerName("");
    setVatRate(20);
    setLines([{ description: "", quantity: 1, unitPrice: 0 }]);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Create New Invoice</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">VAT Rate (%)</label>
            <input
              type="number"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={vatRate}
              onChange={(e) => setVatRate(Number(e.target.value))}
              min="0"
              max="100"
              step="0.1"
              required
            />
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-800">Invoice Lines</h3>
            <button
              type="button"
              onClick={addLine}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              + Add Line
            </button>
          </div>
          {lines.map((ln, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-4 mb-4 items-end">
              <div className="col-span-6">
                <label className="block text-sm text-gray-600 mb-1">Description</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={ln.description}
                  onChange={(e) => updateLine(idx, "description", e.target.value)}
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Quantity</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  value={ln.quantity}
                  onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                  required
                />
              </div>
              <div className="col-span-3">
                <label className="block text-sm text-gray-600 mb-1">Unit Price</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  step="0.01"
                  value={ln.unitPrice}
                  onChange={(e) => updateLine(idx, "unitPrice", e.target.value)}
                  required
                />
              </div>
              {lines.length > 1 && (
                <div className="col-span-1">
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Invoice
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateInvoice; 