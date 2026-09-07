import assert from 'assert';
import { parseNumericValue, normalizePeriod, canonicalizePredicate } from '../server/utils/textUtils.js';
import { compareFacts } from '../server/reasoning/comparator.js';
import { extractTextFromPdf } from '../server/services/pdfService.js';
import { factExtractorService } from '../server/services/factExtractor.js';

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✔\x1b[0m ${description}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${description}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function asyncTest(description, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔\x1b[0m ${description}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${description}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n======================================================');
console.log('FactLens High-Precision Test Suite & Regression Checks');
console.log('======================================================\n');

// -------------------------------------------------------------
// Group 1: Fact Normalization
// -------------------------------------------------------------
console.log('Group 1: Normalization & Canonicalization');

test('Parses INR Crores into exact integer', () => {
  const parsed = parseNumericValue('₹8,142 Cr');
  assert.strictEqual(parsed.normalizedValue, 81420000000);
  assert.strictEqual(parsed.unit, 'INR');
});

test('Parses USD Millions into exact integer', () => {
  const parsed = parseNumericValue('$100M');
  assert.strictEqual(parsed.normalizedValue, 100000000);
  assert.strictEqual(parsed.unit, 'USD');
});

test('Normalizes fiscal periods consistently', () => {
  assert.strictEqual(normalizePeriod('FY 2023-24'), 'FY2024');
  assert.strictEqual(normalizePeriod('FY24'), 'FY2024');
  assert.strictEqual(normalizePeriod('Q4 FY24'), 'Q4 FY2024');
});

test('Canonicalizes predicate aliases', () => {
  assert.strictEqual(canonicalizePredicate('revenue from operations'), 'revenue');
  assert.strictEqual(canonicalizePredicate('annual revenue'), 'revenue');
  assert.strictEqual(canonicalizePredicate('adjusted ebitda'), 'ebitda');
});

// -------------------------------------------------------------
// Group 2: False-Positive Prevention (Strict Filtering)
// -------------------------------------------------------------
console.log('\nGroup 2: Preventing False Matches (Precision Tests)');

test('Prevents matching percentage ratio (17.39%) with absolute revenue (46 Cr)', () => {
  const factA = {
    id: 'f1',
    documentId: 'doc_1',
    subject: 'Delhivery Limited',
    predicate: 'revenue',
    value: '17.39%',
    normalizedValue: 17.39,
    unit: 'PERCENT',
    period: 'FY2024',
    scope: 'Consolidated',
  };

  const factB = {
    id: 'f2',
    documentId: 'doc_2',
    subject: 'Delhivery Limited',
    predicate: 'revenue',
    value: '46 Cr',
    normalizedValue: 460000000,
    unit: 'INR',
    period: 'FY2022',
    scope: 'Consolidated',
  };

  const result = compareFacts(factA, factB);
  assert.strictEqual(result, null, 'Should NOT compare PERCENT unit with INR currency');
});

test('Prevents matching different acquisition targets (Spoton vs Primaseller)', () => {
  const factA = {
    id: 'f1',
    documentId: 'doc_1',
    subject: 'Delhivery Limited',
    predicate: 'acquisition',
    value: 'Acquisition of Spoton Logistics',
    unit: 'COMPANY',
    period: '2021',
    scope: 'Spoton Logistics',
  };

  const factB = {
    id: 'f2',
    documentId: 'doc_2',
    subject: 'Delhivery Limited',
    predicate: 'acquisition',
    value: 'Acquisition of Primaseller Inc',
    unit: 'COMPANY',
    period: '2021',
    scope: 'Primaseller Inc',
  };

  const result = compareFacts(factA, factB);
  assert.strictEqual(result, null, 'Should NOT match different corporate acquisitions');
});

// -------------------------------------------------------------
// Group 3: Four Core Classifications
// -------------------------------------------------------------
console.log('\nGroup 3: Verified Four Classification Cases');

test('Case 1: Corroboration (Same Entity, Same Period, Equivalent Expression)', () => {
  const factA = {
    id: 'f1',
    documentId: 'doc_1',
    subject: 'Delhivery Limited',
    predicate: 'acquisition',
    value: 'Acquisition of Spoton',
    unit: 'COMPANY',
    period: '2021',
    scope: 'Spoton',
    confidence: 0.95,
  };

  const factB = {
    id: 'f2',
    documentId: 'doc_2',
    subject: 'Delhivery Limited',
    predicate: 'acquisition',
    value: 'Acquisition of Spoton Logistics',
    unit: 'COMPANY',
    period: '2021',
    scope: 'Spoton Logistics',
    confidence: 0.94,
  };

  const result = compareFacts(factA, factB);
  assert.ok(result);
  assert.strictEqual(result.classification, 'CORROBORATED');
});

test('Case 2: Genuine Contradiction (Same Context, Incompatible Values)', () => {
  const factA = {
    id: 'f1',
    documentId: 'doc_1',
    subject: 'Acme Corporation',
    predicate: 'headcount',
    value: '5,200 employees',
    normalizedValue: 5200,
    unit: 'COUNT',
    period: 'FY2024',
    scope: 'Global',
    metricQualifier: 'reported',
    confidence: 0.95,
  };

  const factB = {
    id: 'f2',
    documentId: 'doc_2',
    subject: 'Acme Corporation',
    predicate: 'headcount',
    value: '4,700 employees',
    normalizedValue: 4700,
    unit: 'COUNT',
    period: 'FY2024',
    scope: 'Global',
    metricQualifier: 'reported',
    confidence: 0.92,
  };

  const result = compareFacts(factA, factB);
  assert.ok(result);
  assert.strictEqual(result.classification, 'CONTRADICTION');
});

test('Case 3: Contextual Difference (Reconciled by Fiscal Period)', () => {
  const factA = {
    id: 'f1',
    documentId: 'doc_1',
    subject: 'Delhivery Limited',
    predicate: 'revenue',
    value: '₹7,225 Cr',
    normalizedValue: 72250000000,
    unit: 'INR',
    period: 'FY2023',
    scope: 'Consolidated',
    metricQualifier: 'reported',
    confidence: 0.95,
  };

  const factB = {
    id: 'f2',
    documentId: 'doc_2',
    subject: 'Delhivery Limited',
    predicate: 'revenue',
    value: '₹8,142 Cr',
    normalizedValue: 81420000000,
    unit: 'INR',
    period: 'FY2024',
    scope: 'Consolidated',
    metricQualifier: 'reported',
    confidence: 0.95,
  };

  const result = compareFacts(factA, factB);
  assert.ok(result);
  assert.strictEqual(result.classification, 'CONTEXTUAL_DIFFERENCE');
  assert.strictEqual(result.contextDiffType, 'TEMPORAL');
});

test('Case 4: Uncertainty (Forward-Looking Vague Range)', () => {
  const factA = {
    id: 'f1',
    documentId: 'doc_1',
    subject: 'Acme Corporation',
    predicate: 'projected_growth_estimate',
    value: '20-30%',
    normalizedValue: null,
    unit: 'PERCENT',
    period: 'Unspecified',
    scope: 'Forward Estimate',
    metricQualifier: 'unverified_estimate',
    confidence: 0.48,
  };

  const factB = {
    id: 'f2',
    documentId: 'doc_2',
    subject: 'Acme Corporation',
    predicate: 'projected_growth_estimate',
    value: '25%',
    normalizedValue: 25,
    unit: 'PERCENT',
    period: 'FY2025',
    scope: 'Forward Estimate',
    metricQualifier: 'estimated',
    confidence: 0.85,
  };

  const result = compareFacts(factA, factB);
  assert.ok(result);
  assert.strictEqual(result.classification, 'UNCERTAIN');
});

// -------------------------------------------------------------
// Group 4: Live PDF Ingestion Check
// -------------------------------------------------------------
console.log('\nGroup 4: Live PDF Extraction on Starter Dataset');

await asyncTest('Parses Delhivery Q4 presentation with exact pages', async () => {
  const res = await extractTextFromPdf('./starter-datasets/delhivery/03-delhivery-q4-fy24-earnings-presentation.pdf');
  assert.strictEqual(res.pageCount, 27);
  assert.strictEqual(res.pages.length, 27);
});

await asyncTest('Extracts structured facts with clean precision', async () => {
  const res = await extractTextFromPdf('./starter-datasets/delhivery/03-delhivery-q4-fy24-earnings-presentation.pdf');
  const facts = await factExtractorService.extractFromDocument({
    documentId: 'doc_test_3',
    filename: '03-delhivery-q4-fy24-earnings-presentation.pdf',
    pages: res.pages,
    datasetCategory: 'Delhivery',
  });

  assert.ok(facts.length > 0);
  facts.forEach(f => {
    assert.ok(f.page >= 1);
    assert.ok(f.evidence.length > 5);
  });
});

console.log('\n======================================================');
console.log(`Results: ${passed} passed, ${failed} failed.`);
console.log('======================================================\n');

if (failed > 0) process.exit(1);
