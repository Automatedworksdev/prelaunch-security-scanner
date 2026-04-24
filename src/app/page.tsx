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
  const [showModal, setShowModal] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

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
    setUnlocked(false);
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
            severity === 'high' ? 'bg-red-500' :
            severity === 'medium' ? 'bg-amber-500' : 'bg-blue-400'
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
                    issue.severity === 'high' ? 'bg-red-500' :
                    issue.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-400'
                  }`}></div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                    issue.severity === 'high' ? 'bg-red-50 text-red-600' :
                    issue.severity === 'medium' ? 'bg-amber-50 text-amber-600' :
                    issue.severity === 'low' ? 'bg-blue-50 text-blue-600' :
                    'bg-gray-50 text-gray-600'
                  }`}>{issue.severity}</span>
                </div>
                <h3 className="text-base font-semibold text-gray-800 mb-1">{issue.name}</h3>
                <p className="text-sm text-gray-600 mb-2 leading-relaxed">{issue.description}</p>
                {issue.fix && issue.severity === 'low' && (
                  <div className="space-y-1.5">
                    <div className="text-xs text-gray-500 font-medium mb-1">Quick fix</div>
                    <div className="bg-[#0F172A] text-green-300 text-xs font-mono rounded-lg px-2.5 py-1.5 border border-gray-800/40 mb-2">
                      {issue.fix.fix}
                    </div>
                    <button
                      onClick={() => issue.fix && copyToClipboard(issue.fix.fix, issueId)}
                      className="mt-1 w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 font-medium rounded-md hover:bg-gray-100 active:scale-95 transition-all duration-150 flex items-center justify-center gap-2"
                    >
                      {copiedId === issueId ? (
                        <>
                          <span>Copied</span>
                          <span>✓</span>
                        </>
                      ) : (
                        <>
                          <span>📋</span>
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      Apply via {issue.fix.where}
                    </p>
                  </div>
                )}
                {issue.fix && issue.severity === 'medium' && (
                  <div className="mt-3 bg-amber-50 border border-amber-100 rounded-lg p-3">
                    <p className="text-sm text-amber-700">🔒 Fix included in full report</p>
                  </div>
                )}
                {issue.fix && (issue.severity === 'high' || issue.severity === 'critical') && (
                  <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-3">
                    <p className="text-sm text-red-700">🔒 Fix hidden — unlock to secure your site</p>
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
              <div className="text-lg text-gray-500 mb-2">Security Score</div>
              
              {/* Score status message */}
              <p className={`text-sm font-medium mb-1 ${
                result.score >= 85 ? 'text-green-600' :
                result.score >= 70 ? 'text-yellow-600' :
                result.score >= 50 ? 'text-orange-600' : 'text-red-600'
              }`}>
                {result.score >= 85 ? 'Excellent — your site is well protected' :
                 result.score >= 70 ? 'Good — but there\'s room for improvement' :
                 result.score >= 50 ? 'Below average — your site is vulnerable to common attacks' :
                 'At risk — your site is missing key protections'}
              </p>
              
              {/* Engagement hook */}
              <p className="text-sm font-medium mt-3 text-gray-700">Fix all issues to reach 90+ (recommended before launch)</p>

              {result.priorityIssue && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mt-4 mb-6">
                  <p className="text-sm font-semibold text-red-700 mb-1">Fix This First</p>
                  <h3 className="font-semibold text-gray-900">
                    {result.priorityIssue.name}
                  </h3>
                  <p className="text-gray-700 text-sm mt-1">
                    {result.priorityIssue.description}
                  </p>
                  <p className="text-xs text-red-600 mt-2">
                    Fixing this could increase your score by up to <strong className="text-amber-600">+20 points</strong>
                  </p>
                </div>
              )}

              <div className="text-sm text-gray-500 mt-4">
                Scanned: {scannedUrl}
              </div>

              {shareCopied && (
                <div className="mt-3 text-sm text-green-600">✓ Copied to clipboard</div>
              )}
            </div>

            {result.issues.length > 0 ? (
              <div className="p-6">
                {/* Always show Fix This First - LOCKED, no fix code */}
                {result.priorityIssue && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                    <p className="text-sm font-semibold text-red-700 mb-1">Fix This First</p>
                    <h3 className="font-semibold text-gray-900">{result.priorityIssue.name}</h3>
                    <p className="text-gray-700 text-sm mt-1">{result.priorityIssue.description}</p>
                    <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-3">
                      <p className="text-sm text-red-700">🔒 Fix hidden — unlock to secure your site</p>
                    </div>
                  </div>
                )}

                {/* Locked section - Strong Paywall */}
                {!unlocked ? (
                  <>
                    {/* Tension line */}
                    <div className="mb-4 bg-red-100 border border-red-200 rounded-lg p-3 text-center">
                      <p className="text-red-700 font-medium">⚠️ Your site is still vulnerable</p>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                      <div className="text-2xl mb-2">🔐</div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">You are not fully protected yet</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        You still have critical issues that leave your site vulnerable.
                      </p>
                      {(groupedIssues?.critical?.length || 0) + (groupedIssues?.high?.length || 0) + (groupedIssues?.medium?.length || 0) > 0 && (
                        <div className="mb-4 text-sm text-gray-700">
                          <p className="font-medium mb-1">You still have:</p>
                          <ul className="space-y-1">
                            {(groupedIssues?.critical?.length || 0) > 0 && (
                              <li>• {groupedIssues!.critical.length} critical {groupedIssues!.critical.length === 1 ? 'issue' : 'issues'}</li>
                            )}
                            {(groupedIssues?.high?.length || 0) > 0 && (
                              <li>• {groupedIssues!.high.length} high {groupedIssues!.high.length === 1 ? 'issue' : 'issues'}</li>
                            )}
                            {(groupedIssues?.medium?.length || 0) > 0 && (
                              <li>• {groupedIssues!.medium.length} medium {groupedIssues!.medium.length === 1 ? 'issue' : 'issues'}</li>
                            )}
                          </ul>
                        </div>
                      )}
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Fix everything to:</p>
                        <ul className="space-y-1 text-sm text-gray-600">
                          <li className="flex items-center gap-2">
                            <span className="text-green-500">✔</span> Reach 90+ security score
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-500">✔</span> Prevent common attacks
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-500">✔</span> Launch with confidence
                          </li>
                        </ul>
                      </div>
                      <button
                        onClick={() => setUnlocked(true)}
                        className="w-full px-6 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors mb-2"
                      >
                        Fix all issues (£4.99)
                      </button>
                      <p className="text-xs text-gray-500 text-center">
                        Takes under 2 minutes to fix everything
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    {groupedIssues && (
                      <>
                        {renderIssueSection('critical', groupedIssues.critical)}
                        {renderIssueSection('high', groupedIssues.high)}
                        {renderIssueSection('medium', groupedIssues.medium)}
                        {renderIssueSection('low', groupedIssues.low)}
                      </>
                    )}
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
              <button onClick={handleReset} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl py-3 active:scale-95 transition-all duration-150">
                Scan a new website
              </button>
            </div>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Fix your site safely</h2>
              <p className="text-gray-600 mb-4">
                We'll implement these security fixes for you and improve your score to 80–90+
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-500">✓</span>
                  <span>We handle all technical setup</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-500">✓</span>
                  <span>No risk of breaking your site</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-500">✓</span>
                  <span>Works with your hosting</span>
                </li>
              </ul>
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => alert('Request submitted! We will contact you soon.')}
                className="w-full px-6 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors mb-3">
                Get my fix plan
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="w-full px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm">
                Maybe later
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
