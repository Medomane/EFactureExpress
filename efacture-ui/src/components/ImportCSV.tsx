import React, { useState } from 'react';

interface ImportCSVProps {
  onImport: (file: File) => Promise<void>;
}

const ImportCSV: React.FC<ImportCSVProps> = ({ onImport }) => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState("");
  const [csvSuccess, setCsvSuccess] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError("");
    setCsvSuccess("");
    if (!e.target.files || e.target.files.length === 0) {
      setCsvFile(null);
      return;
    }
    setCsvFile(e.target.files[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) {
      setCsvError("Please select a CSV file.");
      return;
    }

    try {
      await onImport(csvFile);
      setCsvSuccess("File imported successfully");
      setCsvFile(null);
      (document.getElementById("csvInput") as HTMLInputElement).value = "";
    } catch (err) {
      setCsvError((err as Error).message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative">
        <input
          id="csvInput"
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-1.5 file:px-3
            file:rounded-md file:border-0
            file:text-sm file:font-medium
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100
            cursor-pointer"
        />
      </div>
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Upload
      </button>
      {csvError && <p className="text-sm text-red-500">{csvError}</p>}
      {csvSuccess && <p className="text-sm text-green-600">{csvSuccess}</p>}
    </form>
  );
};

export default ImportCSV; 