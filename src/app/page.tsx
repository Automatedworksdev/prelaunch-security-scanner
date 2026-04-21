'use client';

import { useState } from 'react';

interface Fix {
  why: string;
  fix: string;
  where: string;
}

interface Issue {
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  fix?: Fix;
}

interface ScanResult {
  success: true;
  score: number;
  issues: Issue[];
  summary: string;
  priorityIssue: Issue | null;
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🔵';
      default: return '⚪';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
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

      if (!data.success) setError(data.error);
      else setResult(data);

    } catch {
      setError('Failed to connect to scanner. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, issueId: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(issueId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const groupedIssues = result ? {
    critical: result.issues.filter(i => i.severity === 'critical'),
    high: result.issues.filter(i => i.severity === 'high'),
    medium: result.issues.filter(i => i.severity === 'medium'),
    low: result.issues.filter(i => i.severity === 'low'),
  } : null;

  const renderIssueSection = (severity: string, issues: Issue[]) => {
    if (issues.length === 0) return null;
    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg font-semibold">{getSeverityIcon(severity)} {severity.charAt(0).toUpperCase() + severity.slice(1)} Issues</span>
          <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-sm">{issues.length}</span>
        </div>
        <div className="space-y-4">
          {issues.map((issue, i) => {
            const issueId = `${issue.name}-${i}`;
            return (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-start gap-3 mb-3">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getSeverityColor(issue.severity)}`}>
                    {getSeverityIcon(issue.severity)} {issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}
                  </span>
                  <h3 className="text-gray-900 font-semibold text-lg">{issue.name}</h3>
                </div>
                <p className="text-gray-900 text-sm mb-4">{issue.description}</p>
                {issue.fix && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-3 font-mono text-gray-800 text-sm">
                        {issue.fix.fix}
                      </div>
                      <button
                        onClick={() => issue.fix && copyToClipboard(issue.fix.fix, issueId)}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        {copiedId === issueId ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-gray-800 text-sm">
                      <span className="font-medium">Where:</span> {issue.fix.where}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            PreLaunch Security Scanner
          </h1>
          <p className="text-gray-900 text-lg">
            Instant security scan for your website
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(null); }}
              placeholder="Enter website URL (e.g. example.com)"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-800 placeholder:text-gray-400"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {loading ? 'Scanning...' : 'Scan'}
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-10 text-center border-b">
              <div className={`text-7xl font-bold mb-2 ${getScoreColor(result.score)}`}>
                {result.score}
              </div>
              <div className="text-lg text-gray-500 mb-4">Security Score</div>

              {result.score < 80 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <p className="text-amber-800 font-medium">⚠️ Fix the issues below to protect your users</p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <p className="text-green-800 font-medium">✅ Your site is well protected</p>
                </div>
              )}

              <div className="text-sm text-gray-500">
                Scanned: {scannedUrl}
              </div>
            </div>

            {result.issues.length > 0 ? (
              <div className="p-8">
                {groupedIssues && (
                  <>
                    {renderIssueSection('critical', groupedIssues.critical)}
                    {renderIssueSection('high', groupedIssues.high)}
                    {renderIssueSection('medium', groupedIssues.medium)}
                    {renderIssueSection('low', groupedIssues.low)}
                  </>
                )}

                <div className="mt-8 pt-6 border-t">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <p className="text-blue-800">🔧 Fix these issues to improve your score and protect users</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-10 text-center">
                <div className="text-green-600 text-5xl mb-4">✓</div>
                <p className="text-xl font-semibold text-gray-900 mb-2">Your site looks secure</p>
                <p className="text-gray-900">No major security issues detected</p>
              </div>
            )}

            <div className="p-6 bg-gray-50 border-t">
              <button onClick={handleReset} className="w-full border-2 border-gray-300 p-3 rounded-lg hover:bg-gray-100 transition-colors">
                Scan another site
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
