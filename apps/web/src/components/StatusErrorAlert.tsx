import React from 'react';
import { parseApiError } from '../services/api';

export interface StatusErrorAlertProps {
  error: any;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
}

export const StatusErrorAlert: React.FC<StatusErrorAlertProps> = ({
  error,
  onDismiss,
  onRetry,
  className = '',
}) => {
  if (!error) return null;

  const parsed = parseApiError(error);

  const getStatusBadgeStyle = (code: number) => {
    if (code === 400) return 'bg-amber-100 text-amber-800 border-amber-300';
    if (code === 401) return 'bg-rose-100 text-rose-800 border-rose-300';
    if (code === 403) return 'bg-purple-100 text-purple-800 border-purple-300';
    if (code === 404) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (code === 409) return 'bg-orange-100 text-orange-800 border-orange-300';
    if (code === 422) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (code === 429) return 'bg-orange-100 text-orange-900 border-orange-400';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  return (
    <div
      role="alert"
      className={`rounded-lg border border-red-200 bg-red-50/90 p-4 text-slate-800 shadow-sm backdrop-blur transition-all ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadgeStyle(
                parsed.statusCode
              )}`}
            >
              HTTP {parsed.statusCode} {parsed.error}
            </span>
            {parsed.code && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-slate-200 text-slate-700">
                {parsed.code}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-900 mt-1">
            {parsed.message}
          </p>

          {parsed.details && parsed.details.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-xs text-slate-700 space-y-0.5">
              {parsed.details.map((detail, idx) => (
                <li key={idx}>{detail}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-medium px-2.5 py-1 bg-white border border-slate-300 rounded shadow-xs hover:bg-slate-50 transition"
            >
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss alert"
              className="text-slate-400 hover:text-slate-600 transition p-1"
            >
              &times;
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
