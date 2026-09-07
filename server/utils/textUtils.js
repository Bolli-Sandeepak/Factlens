/**
 * Text processing utilities for FactLens
 */

/**
 * Clean and normalize excessive whitespace, control characters, and PDF kerning artifacts.
 */
export function cleanText(text) {
  if (!text) return '';
  let cleaned = text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Repair PDF kerning word splits (deterministic dictionary of common English words broken by PDF font streams)
  cleaned = cleaned
    .replace(/\b([Oo])\s+ur\b/g, '$1ur')
    .replace(/\b([Tt])\s+he\b/g, '$1he')
    .replace(/\b([Ff])\s+or\b/g, '$1or')
    .replace(/\b([Oo])\s+f\b/g, '$1f')
    .replace(/\b([Aa])\s+nd\b/g, '$1nd')
    .replace(/\b([Tt])\s+o\b/g, '$1o')
    .replace(/\b([Ii])\s+n\b/g, '$1n')
    .replace(/\b([Ii])\s+s\b/g, '$1s')
    .replace(/\b([Aa])\s+s\b/g, '$1s')
    .replace(/\b([Aa])\s+t\b/g, '$1t')
    .replace(/\b([Bb])\s+y\b/g, '$1y')
    .replace(/\b([Cc])\s+ompany\b/g, '$1ompany')
    .replace(/\b([Bb])\s+usiness\b/g, '$1usiness')
    .replace(/\b([Ff])\s+inancial\b/g, '$1inancial')
    .replace(/\b([Ss])\s+ervices\b/g, '$1ervices')
    .replace(/\b([Ss])\s+tatement\b/g, '$1tatement')
    .replace(/\b([Pp])\s+rofit\b/g, '$1rofit')
    .replace(/\b([Oo])\s*f\s*ficer\b/g, '$1fficer')
    .replace(/\b([Cc])\s*er\s*tifications\b/g, '$1ertifications')
    .replace(/\b([Dd])\s+irector\b/g, '$1irector')
    .replace(/\b([Ee])\s+xecutive\b/g, '$1xecutive')
    .replace(/\b([Mm])\s+anaging\b/g, '$1anaging')
    .replace(/\b([Pp])\s+articulars\b/g, '$1articulars');

  // Clean trailing standalone table footnote/page numbers before end-of-sentence period (e.g. 'Officer 11.' -> 'Officer.')
  cleaned = cleaned.replace(/([a-zA-Z])\s+[0-9]{1,3}\s*\./g, '$1.');

  return cleaned;
}

/**
 * Split text into individual sentences while respecting abbreviations.
 */
export function splitIntoSentences(text) {
  if (!text) return [];
  // Split on period/question/exclamation followed by space or newline, protecting common abbreviations
  const rawSentences = text
    .replace(/(Mr|Mrs|Ms|Dr|Prof|Ltd|Pvt|Inc|Corp|Rs|FY|approx|e\.g|i\.e)\./gi, '$1__DOT__')
    .split(/(?<=[.?!])\s+(?=[A-Z0-9₹$€£"'])/g);

  return rawSentences
    .map(s => cleanText(s.replace(/__DOT__/g, '.').trim()))
    .filter(s => s.length > 10);
}

/**
 * Extract an evidence snippet around a match for high context readability.
 */
export function getEvidenceSnippet(fullText, matchIndex, matchLength, radius = 160) {
  if (!fullText) return '';
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(fullText.length, matchIndex + matchLength + radius);
  let snippet = fullText.substring(start, end).trim();
  
  if (start > 0) snippet = '...' + snippet;
  if (end < fullText.length) snippet = snippet + '...';
  
  return cleanText(snippet);
}

/**
 * Jaccard token similarity between two strings (0.0 to 1.0).
 */
export function jaccardSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = new Set(cleanText(str1).toLowerCase().split(/\W+/).filter(w => w.length > 2));
  const s2 = new Set(cleanText(str2).toLowerCase().split(/\W+/).filter(w => w.length > 2));
  if (s1.size === 0 || s2.size === 0) return 0;
  
  const intersection = new Set([...s1].filter(x => s2.has(x)));
  const union = new Set([...s1, ...s2]);
  return intersection.size / union.size;
}

/**
 * Levenshtein distance between two short strings.
 */
export function levenshteinDistance(a, b) {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = Array.from({ length: bn + 1 }, (_, i) => [i]);
  for (let j = 0; j <= an; j++) matrix[0][j] = j;
  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[bn][an];
}

/**
 * Normalized string similarity score (0.0 to 1.0).
 */
export function stringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1.0;
  
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(s1, s2);
  return 1 - (distance / maxLen);
}

/**
 * Parse and normalize numeric values with units, multipliers (crores, lakhs, millions, billions).
 */
export function parseNumericValue(valueStr) {
  if (!valueStr) return { normalizedValue: null, unit: null };

  const str = valueStr.toString().trim();

  // Check currency
  let unit = null;
  if (str.includes('₹') || /INR|rupee|crore|lakh/i.test(str)) unit = 'INR';
  else if (str.includes('$') || /USD|dollar/i.test(str)) unit = 'USD';
  else if (str.includes('€') || /EUR|euro/i.test(str)) unit = 'EUR';
  else if (str.includes('£') || /GBP|pound/i.test(str)) unit = 'GBP';
  else if (str.includes('%') || /percent/i.test(str)) unit = 'PERCENT';
  else if (/employee|staff|headcount|people/i.test(str)) unit = 'COUNT';
  else if (/pin\s*code|location|facility|center|city|station|hub/i.test(str)) unit = 'COUNT';

  // Extract base digits and decimals
  const match = str.match(/([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)/);
  if (!match) return { normalizedValue: null, unit };

  let num = parseFloat(match[1].replace(/,/g, ''));
  if (isNaN(num)) return { normalizedValue: null, unit };

  // Multipliers
  if (/(?:crore|cr\.?|crs\.?)/i.test(str)) {
    num = num * 10000000; // 1 Crore = 10,000,000
    if (!unit) unit = 'INR';
  } else if (/(?:lakh|lac|lacs|lakhs)/i.test(str)) {
    num = num * 100000; // 1 Lakh = 100,000
    if (!unit) unit = 'INR';
  } else if (/(?:billion|bn\.?|b)/i.test(str) && !/(?:bulletin|branch)/i.test(str)) {
    num = num * 1000000000;
  } else if (/(?:million|mn\.?|m)/i.test(str) && !/(?:margin|month)/i.test(str)) {
    num = num * 1000000;
  } else if (/(?:thousand|k)/i.test(str)) {
    num = num * 1000;
  } else if (/(?:trillion|tn\.?)/i.test(str)) {
    num = num * 1000000000000;
  }

  return { normalizedValue: num, unit };
}

/**
 * Standardize fiscal periods, quarters, and years.
 * e.g., "FY 2023-24", "FY24", "fiscal year 2024", "2023-2024" -> "FY2024"
 */
export function normalizePeriod(text) {
  if (!text) return null;
  const s = text.trim();

  // Check for quarters: Q1, Q2, Q3, Q4 with fiscal year
  const quarterMatch = s.match(/Q([1-4])\s*(?:FY)?\s*['’]?([0-9]{2,4})/i);
  if (quarterMatch) {
    let yr = quarterMatch[2];
    if (yr.length === 2) yr = '20' + yr;
    return `Q${quarterMatch[1]} FY${yr}`;
  }

  // Check for FY standard: FY2024, FY24, FY 2023-24
  const fyMatch = s.match(/(?:FY|Fiscal\s*Year)\s*['’]?([0-9]{2,4})(?:[-/]([0-9]{2,4}))?/i);
  if (fyMatch) {
    let yr = fyMatch[2] || fyMatch[1];
    if (yr.length === 2) yr = '20' + yr;
    return `FY${yr}`;
  }

  // Check for multi-year range like 2023-24 or 2024-25
  const rangeMatch = s.match(/(20[0-9]{2})[-/]([0-9]{2,4})/);
  if (rangeMatch) {
    let yr2 = rangeMatch[2];
    if (yr2.length === 2) yr2 = '20' + yr2;
    return `FY${yr2}`;
  }

  // Check standalone year: 2022, 2023, 2024, 2025
  const yearMatch = s.match(/\b(20[12][0-9])\b/);
  if (yearMatch) {
    return yearMatch[1];
  }

  return s;
}

/**
 * Normalize predicate to canonical form.
 */
export function canonicalizePredicate(rawPredicate) {
  if (!rawPredicate) return 'unknown';
  const p = rawPredicate.toLowerCase().trim().replace(/[-_]/g, ' ');

  if (/revenue|sales|turnover|income from operations|topline/i.test(p)) return 'revenue';
  if (/ebitda|operating profit|adjusted ebitda/i.test(p)) return 'ebitda';
  if (/net profit|pat|profit after tax|net income|profit/i.test(p)) return 'net_profit';
  if (/gross margin|operating margin|ebitda margin|profit margin/i.test(p)) return 'margin';
  if (/gdp|gross domestic product|economic growth/i.test(p)) return 'gdp_growth';
  if (/inflation|cpi|consumer price index|wpi/i.test(p)) return 'inflation_rate';
  if (/headcount|employee|workforce|staff|team size/i.test(p)) return 'headcount';
  if (/pin codes?|pincodes?|postal codes?|coverage/i.test(p)) return 'pin_code_coverage';
  if (/active customers?|clients?|client base/i.test(p)) return 'active_customers';
  if (/express parcel volume|shipment volume|parcels handled|package volume/i.test(p)) return 'shipment_volume';
  if (/facilities|gateways|service centers|sort centers|hubs/i.test(p)) return 'facilities_count';
  if (/ceo|chief executive officer|managing director|leadership|chairperson|director/i.test(p)) return 'executive_role';
  if (/headquarters|office location|registered office|located at/i.test(p)) return 'headquarters';
  if (/acquisition|acquired|merger|bought/i.test(p)) return 'acquisition';

  return p.replace(/\s+/g, '_');
}

/**
 * Standardize subject name.
 */
export function canonicalizeSubject(rawSubject) {
  if (!rawSubject) return 'Unknown Entity';
  const s = rawSubject.trim();

  if (/delhivery/i.test(s)) return 'Delhivery Limited';
  if (/reserve bank of india|rbi\b/i.test(s)) return 'Reserve Bank of India';
  if (/international monetary fund|imf\b/i.test(s)) return 'IMF';
  if (/indian economy|india gdp|government of india|economic survey/i.test(s)) return 'Indian Economy';
  if (/spoton/i.test(s)) return 'Spoton Logistics';
  if (/transition robotics/i.test(s)) return 'Transition Robotics';

  return s;
}
