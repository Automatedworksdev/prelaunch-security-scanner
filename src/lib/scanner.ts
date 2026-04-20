import sslChecker from 'ssl-checker';
import axios from 'axios';

interface Issue {
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  fix?: {
    why: string;
    fix: string;
    where: string;
  };
}

interface ScanResult {
  success: true;
  score: number;
  issues: Issue[];
  summary: string;
  priorityIssue: Issue | null;
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

const issueFixData: Record<string, { why: string; fix: string; where: string }> = {
  'Invalid SSL Certificate': {
    why: 'Attackers can intercept user data sent to your site',
    fix: 'Renew SSL certificate or switch to a trusted provider',
    where: 'Your hosting provider or SSL vendor'
  },
  'Missing HSTS Header': {
    why: 'Attackers can downgrade HTTPS connections to steal data',
    fix: 'Strict-Transport-Security: max-age=31536000; includeSubDomains',
    where: 'Server config (Nginx, Apache) or web framework'
  },
  'Missing CSP Header': {
    why: 'Attackers can inject malicious scripts into your site',
    fix: "Content-Security-Policy: default-src 'self'; script-src 'self'",
    where: 'Server headers or web framework middleware'
  },
  'Missing X-Frame-Options': {
    why: 'Your site can be embedded in malicious pages',
    fix: 'X-Frame-Options: DENY',
    where: 'Server headers or web framework'
  },
  'Missing X-Content-Type-Options': {
    why: 'Browsers may execute files as dangerous code',
    fix: 'X-Content-Type-Options: nosniff',
    where: 'Server headers or web framework'
  },
  'Missing Referrer-Policy': {
    why: 'Sensitive URLs can leak to external websites',
    fix: 'Referrer-Policy: strict-origin-when-cross-origin',
    where: 'Server headers or web framework'
  }
};

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

async function enhanceDescription(issue: Issue): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    return issue.description;
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AI timeout')), 3000);
    });

    const apiPromise = axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `Explain this security issue simply for a non-technical user in 2 sentences max.

Issue: ${issue.name}
Description: ${issue.description}

Focus on:
- what the risk is
- what could happen if ignored

Keep it short and clear. No technical jargon.`
          }
        ],
        max_tokens: 100,
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 3000
      }
    );

    const response = await Promise.race([apiPromise, timeoutPromise]);
    const enhanced = response.data.choices[0]?.message?.content?.trim();
    
    if (enhanced && enhanced.length > 10) {
      return enhanced;
    }
    return issue.description;
  } catch {
    return issue.description;
  }
}

function generateSummary(issues: Issue[]): string {
  const highCount = issues.filter(i => i.severity === 'critical' || i.severity === 'high').length;
  const mediumCount = issues.filter(i => i.severity === 'medium').length;
  const lowCount = issues.filter(i => i.severity === 'low').length;

  if (highCount > 0) {
    return `Your site has ${highCount} high-risk issue${highCount > 1 ? 's' : ''} that may expose users to attacks`;
  } else if (mediumCount > 0) {
    return `Your site has ${mediumCount} medium-risk issue${mediumCount > 1 ? 's' : ''} to address`;
  } else if (lowCount > 0) {
    return `No major risks detected`;
  }
  return `No major risks detected`;
}

function getPriorityIssue(issues: Issue[]): Issue | null {
  const severityOrder = ['critical', 'high', 'medium', 'low'];
  for (const severity of severityOrder) {
    const found = issues.find(i => i.severity === severity);
    if (found) return found;
  }
  return null;
}

export async function scanUrl(url: string): Promise<ScanResult | { success: false; error: string }> {
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
      const fixData = issueFixData['Invalid SSL Certificate'];
      issues.push({
        name: 'Invalid SSL Certificate',
        severity: 'critical',
        description: fixData.why,
        fix: {
          why: fixData.why,
          fix: fixData.fix,
          where: fixData.where
        }
      });
    }
    
    if (!headers['strict-transport-security']) {
      score -= 20;
      const fixData = issueFixData['Missing HSTS Header'];
      issues.push({
        name: 'Missing HSTS Header',
        severity: 'high',
        description: fixData.why,
        fix: {
          why: fixData.why,
          fix: fixData.fix,
          where: fixData.where
        }
      });
    }
    
    if (!headers['content-security-policy']) {
      score -= 20;
      const fixData = issueFixData['Missing CSP Header'];
      issues.push({
        name: 'Missing CSP Header',
        severity: 'high',
        description: fixData.why,
        fix: {
          why: fixData.why,
          fix: fixData.fix,
          where: fixData.where
        }
      });
    }
    
    if (!headers['x-frame-options']) {
      score -= 15;
      const fixData = issueFixData['Missing X-Frame-Options'];
      issues.push({
        name: 'Missing X-Frame-Options',
        severity: 'medium',
        description: fixData.why,
        fix: {
          why: fixData.why,
          fix: fixData.fix,
          where: fixData.where
        }
      });
    }
    
    if (!headers['x-content-type-options']) {
      score -= 10;
      const fixData = issueFixData['Missing X-Content-Type-Options'];
      issues.push({
        name: 'Missing X-Content-Type-Options',
        severity: 'low',
        description: fixData.why,
        fix: {
          why: fixData.why,
          fix: fixData.fix,
          where: fixData.where
        }
      });
    }
    
    if (!headers['referrer-policy']) {
      score -= 5;
      const fixData = issueFixData['Missing Referrer-Policy'];
      issues.push({
        name: 'Missing Referrer-Policy',
        severity: 'low',
        description: fixData.why,
        fix: {
          why: fixData.why,
          fix: fixData.fix,
          where: fixData.where
        }
      });
    }
    
    score = Math.max(score, 0);
    
    // Enhance descriptions with AI (parallel, with timeout)
    const enhancedIssues = await Promise.all(
      issues.map(async (issue) => ({
        ...issue,
        description: await enhanceDescription(issue)
      }))
    );
    
    const summary = generateSummary(enhancedIssues);
    const priorityIssue = getPriorityIssue(enhancedIssues);
    
    return { success: true, score, issues: enhancedIssues, summary, priorityIssue };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    if (message.includes('timeout') || message.includes('Failed to fetch')) {
      return { success: false, error: 'Site unreachable or timed out. Please check the URL and try again.' };
    }
    
    return { success: false, error: 'Scan failed: ' + message };
  }
}
