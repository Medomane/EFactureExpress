import React from 'react';
import { useTranslation } from 'react-i18next';

interface ErrorPageProps {
  title?: string;
  message?: string;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  onRetry?: () => void;
}

const ErrorPage: React.FC<ErrorPageProps> = ({
  title,
  message,
  error,
  errorInfo,
  onRetry
}) => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">
            {title || t('errors.applicationError')}
          </h2>
          <p className="text-gray-600 mb-4">
            {message || t('errors.somethingWentWrong')}
          </p>
          {process.env.NODE_ENV === 'development' && error && (
            <div className="mt-4 p-4 bg-gray-100 rounded text-left">
              <p className="text-sm font-mono text-red-500">
                {error.toString()}
              </p>
              {errorInfo && (
                <p className="text-xs font-mono text-gray-500 mt-2">
                  {errorInfo.componentStack}
                </p>
              )}
            </div>
          )}
          <div className="mt-4">
            <button
              onClick={onRetry || (() => window.location.reload())}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              {t('common.retry')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage; 