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
  const [shareCopied, setShareCopied] = useState(false);

  const shareScore = async () => {
    if (!result) return;
    const currentUrl = window.location.href;
    const shareMessage = `My website scored ${result.score}/100 on security. Most sites fail basic checks. Test yours: ${currentUrl}`;
    
    // Use Web Share API if available
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Website Security Score',
          text: shareMessage,
          url: currentUrl,
        });
        return;
      } catch {
        // User cancelled or share failed, fall back to clipboard
      }
    }
    
    // Fallback: Copy full message to clipboard
    navigator.clipboard.writeText(shareMessage).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  };

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
      case 'medium': return 'bg-yellow-50 text-yellow-600 border-yellow-400';
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
      setTimeout(() => setCopiedId(null), 1500);
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
      <div className="mb-4 border-t border-gray-200 pt-6 ">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mt-6 mb-2">
          <div className={`w-1.5 h-1.5 rounded-full ${
            severity === 'critical' ? 'bg-red-600' :
            severity === 'high' ? 'bg-orange-500' :
            severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
          }`}></div>
          <span>{severity.charAt(0).toUpperCase() + severity.slice(1)} Issues</span>
          <span className="text-gray-500 text-sm font-normal">— {issues.length} {issues.length === 1 ? 'issue' : 'issues'}</span>
        </div>
        <div className="space-y-3">
          {issues.map((issue, i) => {
            const issueId = `${issue.name}-${i}`;
            return (
              <div key={i} className="bg-white border border-gray-100 rounded-xl shadow-sm p-3.5 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    issue.severity === 'critical' ? 'bg-red-600' :
                    issue.severity === 'high' ? 'bg-orange-500' :
                    issue.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}></div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                    issue.severity === 'high' ? 'bg-red-50 text-red-600' :
                    issue.severity === 'medium' ? 'bg-yellow-50 text-yellow-600' :
                    issue.severity === 'low' ? 'bg-blue-50 text-blue-600' :
                    'bg-gray-50 text-gray-600'
                  }`}>{issue.severity}</span>
                </div>
                <h3 className="text-base font-semibold text-gray-800 mb-1">{issue.name}</h3>
                <p className="text-sm text-gray-600 mb-2 leading-relaxed">{issue.description}</p>
                {issue.fix && (
                  <div className="space-y-1.5">
                    <div className="text-xs text-gray-500 font-medium mb-1">Quick fix</div>
                    <div className="bg-[#0F172A] text-green-300 text-xs font-mono rounded-lg px-2.5 py-1.5 border border-gray-800/40 mb-2">
                      {issue.fix.fix}
                    </div>
                    <button
                      onClick={() => issue.fix && copyToClipboard(issue.fix.fix, issueId)}
                      className="mt-1 w-full px-4 py-2 bg-gray-100 text-gray-800 border border-gray-200 font-medium rounded-lg hover:bg-gray-200 active:scale-95 transition-all duration-150"
                    >
                      {copiedId === issueId ? 'Copied ✓' : 'Copy'}
                    </button>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      Apply via {issue.fix.where}
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

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Your Website Might Be Exposing Users — Check Now
          </h1>
          <p className="text-gray-900 text-lg">
            Most sites miss critical security headers. Scan yours in seconds.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(null); }}
              placeholder="Enter website URL (e.g. example.com)"
              className="flex-1 px-5 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-lg placeholder:text-gray-500 bg-white transition-all duration-200"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="w-full sm:w-auto min-w-[140px] px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 active:bg-blue-800 text-white font-medium rounded-lg whitespace-nowrap transition-transform"
            >
              {loading ? 'Scanning...' : 'Scan My Site Free'}
            </button>
          </form>
          <div className="text-sm text-gray-500 text-center mt-3">
            Checks SSL, headers &amp; vulnerabilities in seconds
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">
            No signup required • Instant results
          </p>
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
              <p className="text-sm text-gray-600 mt-2">
                {result.score < 60 
                  ? "Your site has serious security gaps"
                  : result.score < 80
                  ? "Your site needs improvement"
                  : "Your site is well protected"}
              </p>

              {result.priorityIssue && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mt-4 mb-6">
                  <p className="text-sm font-semibold text-orange-700 mb-1">Fix This First</p>
                  <h3 className="font-semibold text-gray-900">
                    {result.priorityIssue.name}
                  </h3>
                  <p className="text-gray-700 text-sm mt-1">
                    {result.priorityIssue.description}
                  </p>
                  <p className="text-xs text-orange-600 mt-2">
                    Fixing this could increase your score by up to +20 points
                  </p>
                </div>
              )}

              <div className="text-sm text-gray-500 mt-4">
                Scanned: {scannedUrl}
              </div>

              <button
                onClick={shareScore}
                className="w-full mt-5 px-6 py-3 bg-gray-900 hover:bg-black text-white text-base font-semibold rounded-lg shadow-sm hover:shadow-md transition-all"
              >
                📤 Share My Score
              </button>

              {shareCopied && (
                <div className="mt-3 text-sm text-green-600">✓ Copied to clipboard</div>
              )}
              <p className="text-sm text-gray-500 mt-2 text-center">
                Show your score publicly — most sites fail basic security checks
              </p>
            </div>

            {result.issues.length > 0 ? (
              <div className="p-6">
                {groupedIssues && (
                  <>
                    {renderIssueSection('critical', groupedIssues.critical)}
                    {renderIssueSection('high', groupedIssues.high)}
                    {renderIssueSection('medium', groupedIssues.medium)}
                    {renderIssueSection('low', groupedIssues.low)}
                  </>
                )}

                <div className="mt-6 pt-5 border-t">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <p className="text-blue-800">Fix these issues to improve your score and protect users</p>
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
              <button onClick={handleReset} className="w-full bg-white border border-gray-300 text-gray-900 rounded-xl py-3 font-medium hover:bg-gray-50 active:scale-95 transition-all duration-150">
                Scan another site
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
