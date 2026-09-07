import {
  cleanText,
  parseNumericValue,
  normalizePeriod,
  canonicalizePredicate,
  canonicalizeSubject,
} from '../utils/textUtils.js';

/**
 * Fact Normalization Service
 * Ensures all facts across documents share canonical entities, predicates, units, and numeric scales.
 */
export function normalizeFact(fact) {
  if (!fact) return null;

  const normalizedSubject = canonicalizeSubject(fact.subject);
  const normalizedPredicate = canonicalizePredicate(fact.predicate);
  const normalizedPeriod = normalizePeriod(fact.period) || fact.period || 'Unspecified';

  // Parse numeric value if not already numeric
  let normalizedValue = fact.normalizedValue;
  let unit = fact.unit;

  if (normalizedValue === undefined || normalizedValue === null) {
    const parsed = parseNumericValue(fact.value);
    normalizedValue = parsed.normalizedValue;
    if (!unit || unit === 'UNKNOWN') {
      unit = parsed.unit || 'UNKNOWN';
    }
  }

  // Standardize scopes
  let scope = fact.scope || 'Consolidated';
  if (/express\s*parcel/i.test(scope)) scope = 'Express Parcel';
  else if (/part\s*truckload|ptl/i.test(scope)) scope = 'Part Truckload';
  else if (/supply\s*chain/i.test(scope)) scope = 'Supply Chain Services';
  else if (/standalone/i.test(scope)) scope = 'Standalone';
  else if (/consolidated/i.test(scope)) scope = 'Consolidated';
  else if (/north\s*america/i.test(scope)) scope = 'North America';
  else if (/global/i.test(scope)) scope = 'Global';

  // Standardize qualifiers
  let metricQualifier = fact.metricQualifier || 'reported';
  if (/audited/i.test(metricQualifier)) metricQualifier = 'audited';
  else if (/unaudited/i.test(metricQualifier)) metricQualifier = 'unaudited';
  else if (/estimated|projected|forecast/i.test(metricQualifier)) metricQualifier = 'estimated';

  return {
    ...fact,
    subject: normalizedSubject,
    predicate: normalizedPredicate,
    normalizedValue,
    unit: unit || 'UNKNOWN',
    period: normalizedPeriod,
    scope,
    metricQualifier,
    evidence: cleanText(fact.evidence),
  };
}

export function normalizeFactsBatch(facts = []) {
  return facts.map(normalizeFact).filter(Boolean);
}

export default {
  normalizeFact,
  normalizeFactsBatch,
};
