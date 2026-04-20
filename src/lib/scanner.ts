import sslChecker from 'ssl-checker';
import axios from 'axios';

interface Issue {
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

function normalizeUrl(url: string): string {
  let normalized = url.trim().toLowerCase();
  
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }
  
  normalized = normalized.replace(/\/+$/, '');
  
  return normalized;
}

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  }
}

async function checkSSL(url: string): Promise<{ valid: boolean; expiry?: string; error?: string }> {
  const domain = extractDomain(url);
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('SSL check timeout')), 5000);
  });
  
  try {
    const sslPromise = sslChecker(domain);
    const result = await Promise.race([sslPromise, timeoutPromise]);
    
    return {
      valid: result.valid,
      expiry: result.validTo ? new Date(result.validTo).toISOString() : undefined
    };
  } catch (error) {
    return { valid: false, error: 'SSL check failed or unsupported domain' };
  }
}

async function checkHeaders(url: string): Promise<Record<string, string | undefined>> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Headers check timeout')), 5000);
  });
  
  try {
    const requestPromise = axios.get(url, {
      timeout: 5000,
      maxRedirects: 5,
      maxContentLength: 1000000,
      validateStatus: () => true,
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner/1.0)'
      }
    });
    
    const response = await Promise.race([requestPromise, timeoutPromise]);
    
    const headers = (response.headers || {}) as Record<string, string | undefined>;
    return {
      'strict-transport-security': headers['strict-transport-security'],
      'content-security-policy': headers['content-security-policy'],
      'x-frame-options': headers['x-frame-options'],
      'x-content-type-options': headers['x-content-type-options'],
      'referrer-policy': headers['referrer-policy']
    };
  } catch (error) {
    return {};
  }
}

export async function scanUrl(url: string): Promise<{ success: true; score: number; issues: Issue[] } | { success: false; error: string }> {
  const normalizedUrl = normalizeUrl(url);
  
  let score = 100;
  const issues: Issue[] = [];
  
  try {
    const [sslResult, headers] = await Promise.all([
      checkSSL(normalizedUrl),
      checkHeaders(normalizedUrl)
    ]);
    
    if (!sslResult.valid) {
      score -= 30;
      issues.push({
        name: 'Invalid SSL Certificate',
        severity: 'critical',
        description: 'SSL certificate is invalid or expired. Data transmission is not secure.'
      });
    }
    
    if (!headers['strict-transport-security']) {
      score -= 20;
      issues.push({
        name: 'Missing HSTS Header',
        severity: 'high',
        description: 'Strict-Transport-Security header is missing. Site may be vulnerable to downgrade attacks.'
      });
    }
    
    if (!headers['content-security-policy']) {
      score -= 20;
      issues.push({
        name: 'Missing CSP Header',
        severity: 'high',
        description: 'Content-Security-Policy header is missing. Site is more vulnerable to XSS attacks.'
      });
    }
    
    if (!headers['x-frame-options']) {
      score -= 15;
      issues.push({
        name: 'Missing X-Frame-Options',
        severity: 'medium',
        description: 'X-Frame-Options header is missing. Site may be vulnerable to clickjacking.'
      });
    }
    
    if (!headers['x-content-type-options']) {
      score -= 10;
      issues.push({
        name: 'Missing X-Content-Type-Options',
        severity: 'low',
        description: 'X-Content-Type-Options header is missing. MIME type sniffing is possible.'
      });
    }
    
    if (!headers['referrer-policy']) {
      score -= 5;
      issues.push({
        name: 'Missing Referrer-Policy',
        severity: 'low',
        description: 'Referrer-Policy header is missing. May leak sensitive URL data to third parties.'
      });
    }
    
    score = Math.max(score, 0);
    
    return { success: true, score, issues };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    if (message.includes('timeout') || message.includes('Failed to fetch')) {
      return { success: false, error: 'Site unreachable or timed out. Please check the URL and try again.' };
    }
    
    return { success: false, error: 'Scan failed: ' + message };
  }
}
