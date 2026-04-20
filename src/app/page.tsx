'use client';

import { useState } from 'react';

interface Issue {
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

interface ScanResult {
  success: true;
  score: number;
  issues: Issue[];
}

interface ScanError {
  success: false;
  error: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [scannedUrl, setScannedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const handleReset = () => {
    setUrl('');
    setScannedUrl('');
    setResult(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    const formattedUrl = url.startsWith('http') ? url : `https://${url}`;

    setLoading(true);
    setResult(null);
    setError(null);
    setScannedUrl(formattedUrl);

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: formattedUrl }),
      });

      const data: ScanResult | ScanError = await response.json();

      if (!data.success) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError('Failed to connect to scanner. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            PreLaunch Security Scanner
          </h1>
          <p className="text-gray-600">
            Check your site&apos;s security before launch
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              placeholder="Enter website URL (e.g. example.com)"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Scanning...' : 'Scan'}
            </button>
          </form>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Scanning...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <span className="text-red-600 text-xl">⚠</span>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Scan Failed</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-8 text-center border-b border-gray-100">
              <div className={`text-6xl font-bold mb-2 ${getScoreColor(result.score)}`}>
                {result.score}
              </div>
              <div className="text-gray-500 font-medium uppercase tracking-wide text-sm">
                Security Score (0–100)
              </div>
              {scannedUrl && (
                <div className="mt-3 text-sm text-gray-600">
                  Scanned: <span className="font-mono text-gray-800">{scannedUrl}</span>
                </div>
              )}
            </div>

            {result.issues.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {result.issues.map((issue, index) => (
                  <div key={index} className="p-6">
                    <div className="flex items-start gap-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(issue.severity)}`}>
                        {issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}
                      </span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {issue.name}
                        </h3>
                        <p className="text-gray-600 text-sm">
                          {issue.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="text-green-600 text-4xl mb-3">✓</div>
                <h3 className="font-semibold text-gray-900 mb-1">No Issues Found</h3>
                <p className="text-gray-600">Your site passed all security checks.</p>
              </div>
            )}

            <div className="p-6 bg-gray-50 border-t border-gray-100">
              <button
                onClick={handleReset}
                className="w-full py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Scan another site
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
