import { BaseExtractor } from './baseExtractor.js';
import {
  cleanText,
  splitIntoSentences,
  getEvidenceSnippet,
  parseNumericValue,
  normalizePeriod,
  canonicalizePredicate,
  canonicalizeSubject,
} from '../utils/textUtils.js';

let factIdCounter = 1;

export class DeterministicExtractor extends BaseExtractor {
  constructor() {
    super('deterministic');
  }

  /**
   * Extract facts from page text using high-precision patterns.
   */
  async extract({ text, pageNumber, documentId, filename, datasetCategory }) {
    if (!text || text.trim().length < 20) {
      return [];
    }

    const sentences = splitIntoSentences(text);
    const facts = [];

    // Infer default entity from filename or dataset
    let defaultEntity = 'Unknown Entity';
    if (/delhivery/i.test(filename) || /delhivery/i.test(text.substring(0, 500))) {
      defaultEntity = 'Delhivery Limited';
    } else if (/rbi/i.test(filename) || /reserve bank/i.test(text.substring(0, 500))) {
      defaultEntity = 'Reserve Bank of India';
    } else if (/imf/i.test(filename) || /international monetary fund/i.test(text.substring(0, 500))) {
      defaultEntity = 'IMF';
    } else if (/economic-survey|economy/i.test(filename) || /economic survey/i.test(text.substring(0, 500))) {
      defaultEntity = 'Indian Economy';
    }

    for (const sentence of sentences) {
      const extractedFromSentence = this.extractFromSentence(
        sentence,
        pageNumber,
        documentId,
        filename,
        defaultEntity
      );
      facts.push(...extractedFromSentence);
    }

    return facts;
  }

  /**
   * Run multi-pattern fact detectors on a single sentence.
   */
  extractFromSentence(sentence, pageNumber, documentId, filename, defaultEntity) {
    const results = [];
    const lower = sentence.toLowerCase();

    // 1. Period extraction for the sentence
    const period = this.detectPeriod(sentence, filename);
    const scope = this.detectScope(sentence);
    const qualifier = this.detectQualifier(sentence);
    const subject = this.detectSubject(sentence, defaultEntity);

    // -------------------------------------------------------------
    // Pattern A: Revenue / Income / Sales
    // -------------------------------------------------------------
    // Prevent capturing percentages or ratios like '17.39% of sales'
    if (!/as\s+%\s+of|percentage|ratio\b/i.test(sentence)) {
      const revenueRegex = /(?:revenue(?: from operations)?|total income|sales|turnover|topline)\s*(?:increased to|grew to|reached|stood at|was|of|amounted to|is)?\s*(?:INR|Rs\.?|₹|\$|USD)?\s*([0-9,]+(?:\.[0-9]+)?\s*(?:crore|cr|lakh|million|billion|mn|bn|trillion|tn)?)/i;
      const revMatch = sentence.match(revenueRegex);
      if (revMatch && !/per cent|%|employee|pincode|facility/i.test(revMatch[0])) {
        const rawVal = revMatch[1].trim();
        // Ignore standalone single digits or percentage-like numbers without multiplier
        const parsed = parseNumericValue(rawVal);
        if (parsed.normalizedValue !== null && parsed.normalizedValue >= 1000000) {
          results.push(
            this.createFact({
              documentId,
              page: pageNumber,
              subject,
              predicate: 'revenue',
              value: rawVal,
              normalizedValue: parsed.normalizedValue,
              unit: parsed.unit || 'INR',
              period: period || 'FY2024',
              scope: scope || 'Consolidated',
              metricQualifier: qualifier || 'reported',
              evidence: sentence,
              confidence: 0.95,
            })
          );
        }
      }
    }

    // -------------------------------------------------------------
    // Pattern B: EBITDA / Adjusted EBITDA
    // -------------------------------------------------------------
    const ebitdaRegex = /(?:adjusted\s+)?ebitda\s*(?:margin|profit|was|stood at|reached|of|amounted to|is)?\s*(?:INR|Rs\.?|₹|\$)?\s*([+-]?[0-9,]+(?:\.[0-9]+)?\s*(?:crore|cr|million|billion|mn|bn|%)?)/i;
    const ebitdaMatch = sentence.match(ebitdaRegex);
    if (ebitdaMatch) {
      const rawVal = ebitdaMatch[1].trim();
      const isPercent = rawVal.includes('%');
      const parsed = parseNumericValue(rawVal);
      if (parsed.normalizedValue !== null && (!isPercent || (parsed.normalizedValue >= -100 && parsed.normalizedValue <= 100))) {
        results.push(
          this.createFact({
            documentId,
            page: pageNumber,
            subject,
            predicate: isPercent ? 'ebitda_margin' : 'ebitda',
            value: rawVal,
            normalizedValue: parsed.normalizedValue,
            unit: isPercent ? 'PERCENT' : (parsed.unit || 'INR'),
            period: period || 'FY2024',
            scope: scope || 'Consolidated',
            metricQualifier: qualifier || 'reported',
            evidence: sentence,
            confidence: 0.94,
          })
        );
      }
    }

    // -------------------------------------------------------------
    // Pattern C: Net Profit / PAT / Net Loss
    // -------------------------------------------------------------
    const profitRegex = /(?:net (?:profit|loss)|pat|profit after tax|loss for the (?:year|period))\s*(?:stood at|was|of|reached|amounted to)?\s*(?:INR|Rs\.?|₹|\$)?\s*([+-]?[0-9,]+(?:\.[0-9]+)?\s*(?:crore|cr|million|billion|mn|bn)?)/i;
    const profitMatch = sentence.match(profitRegex);
    if (profitMatch) {
      const rawVal = profitMatch[1].trim();
      const isLoss = /loss/i.test(profitMatch[0]);
      const parsed = parseNumericValue(rawVal);
      if (parsed.normalizedValue !== null && Math.abs(parsed.normalizedValue) >= 1000000) {
        const normVal = isLoss ? -Math.abs(parsed.normalizedValue) : parsed.normalizedValue;
        results.push(
          this.createFact({
            documentId,
            page: pageNumber,
            subject,
            predicate: 'net_profit',
            value: (isLoss ? '-' : '') + rawVal,
            normalizedValue: normVal,
            unit: parsed.unit || 'INR',
            period: period || 'FY2024',
            scope: scope || 'Consolidated',
            metricQualifier: qualifier || 'reported',
            evidence: sentence,
            confidence: 0.93,
          })
        );
      }
    }

    // -------------------------------------------------------------
    // Pattern D: Headcount / Employees / Workforce
    // -------------------------------------------------------------
    const headcountRegex = /(?:total\s+employees?|headcount|permanent employees?|team of|workforce of|employed)\s*(?:of|was|stood at|reached|is)?\s*([0-9,]+)\s*(?:permanent employees|full-time employees|team members|people|employees)?/i;
    const hcMatch = sentence.match(headcountRegex);
    if (hcMatch && !/%|crore|cr|million|lakh|usd|inr/i.test(sentence.substring(hcMatch.index, hcMatch.index + 30))) {
      const rawVal = hcMatch[1].replace(/,/g, '');
      const count = parseInt(rawVal, 10);
      if (!isNaN(count) && count >= 50) {
        results.push(
          this.createFact({
            documentId,
            page: pageNumber,
            subject,
            predicate: 'headcount',
            value: `${hcMatch[1]} employees`,
            normalizedValue: count,
            unit: 'COUNT',
            period: period || 'FY2024',
            scope: scope || 'Global',
            metricQualifier: qualifier || 'reported',
            evidence: sentence,
            confidence: 0.94,
          })
        );
      }
    }

    // -------------------------------------------------------------
    // Pattern E: Pin Code Coverage / Reach
    // -------------------------------------------------------------
    const pincodeRegex = /(?:servicing|covered|reach of|network across|coverage of|covered over|serving)\s*([0-9,]+)\s*\+?\s*(?:pin\s*codes|pincodes|postal codes)/i;
    const pinMatch = sentence.match(pincodeRegex);
    if (pinMatch) {
      const rawNum = pinMatch[1].replace(/,/g, '');
      const count = parseInt(rawNum, 10);
      if (!isNaN(count) && count > 1000) {
        results.push(
          this.createFact({
            documentId,
            page: pageNumber,
            subject,
            predicate: 'pin_code_coverage',
            value: `${pinMatch[1]}+ pin codes`,
            normalizedValue: count,
            unit: 'PIN_CODES',
            period: period || 'FY2024',
            scope: scope || 'National',
            metricQualifier: qualifier || 'reported',
            evidence: sentence,
            confidence: 0.96,
          })
        );
      }
    }

    // -------------------------------------------------------------
    // Pattern I: Executive Roles / Appointments / Corporate Governance
    // -------------------------------------------------------------
    const execRegex = /(?:(?:Mr|Ms|Mrs|Dr)\.?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})(?:[,\s]+(?:is\s+the|serves\s+as|appointed\s+as|designated\s+as|acts\s+as|re-appointed\s+as|,)?\s*)(Managing Director (?:&|and) Chief Executive Officer|Managing Director|Chief Executive Officer|MD & CEO|Executive Director|Independent Director|Chief Financial Officer|CFO|Chief Operating Officer|COO)/i;
    const execMatch = sentence.match(execRegex);
    if (execMatch) {
      const personName = execMatch[1].trim();
      const invalidPerson = /^(Tata|Company|Directors|Annexure|Particulars|Date|Board|Section|Report|Committee|Limited|Parent|Act|Notice|Independent|Auditors|Statements|Corporate|Management|Key|Financial)/i;
      
      if (!invalidPerson.test(personName) && personName.length >= 5 && personName.length <= 30) {
        let role = execMatch[2].trim();
        if (/Managing Director/i.test(role) && /Chief Executive Officer|CEO/i.test(role)) {
          role = 'Managing Director & CEO';
        }
        results.push(
          this.createFact({
            documentId,
            page: pageNumber,
            subject: personName,
            predicate: 'executive_role',
            value: role,
            normalizedValue: null,
            unit: 'ROLE',
            period: 'Current',
            scope: defaultEntity,
            metricQualifier: 'active',
            evidence: sentence,
            confidence: 0.95,
          })
        );
      }
    }

    // -------------------------------------------------------------
    // Pattern J: Strategic Acquisitions (Strict Filtering)
    // -------------------------------------------------------------
    const acqRegex = /(?:we\s+acquired|completed\s+(?:the\s+)?acquisition\s+of|acquired)\s+([A-Z][A-Za-z0-9\s.]+?)(?:\s+in\s+([A-Za-z]+\s+[0-9]{4}|[0-9]{4}))?(?:\s+to\s+|\s+for\s+[INRRs$₹]|\.)/i;
    const acqMatch = sentence.match(acqRegex);
    if (acqMatch) {
      let targetEntity = acqMatch[1].trim();
      // Remove leading 'the business of'
      targetEntity = targetEntity.replace(/^(?:the\s+business\s+of\s+|the\s+)/i, '').trim();

      // Reject non-corporate boilerplate words
      const invalidWords = /^(tax|asset|benefit|entity|subsidiary|financial|property|goodwill|shares|stake|equity|intangible|contract|operation|portion|balance)/i;
      if (!invalidWords.test(targetEntity) && targetEntity.length >= 3 && targetEntity.length <= 35) {
        const acqYear = acqMatch[2] ? normalizePeriod(acqMatch[2]) : (period || '2021');
        results.push(
          this.createFact({
            documentId,
            page: pageNumber,
            subject: defaultEntity,
            predicate: 'acquisition',
            value: `Acquisition of ${targetEntity}`,
            normalizedValue: null,
            unit: 'COMPANY',
            period: acqYear,
            scope: targetEntity, // Store target company in scope for exact matching
            metricQualifier: 'completed',
            evidence: sentence,
            confidence: 0.94,
          })
        );
      }
    }

    // -------------------------------------------------------------
    // Pattern F: Active Customers / Enterprise Clients
    // -------------------------------------------------------------
    const custRegex = /(?:active\s+customers?|enterprise\s+customers?|clients?\s+served|client\s+base)\s*(?:of|exceeded|reached|stood at|was|over)?\s*([0-9,]+)\s*\+?/i;
    const custMatch = sentence.match(custRegex);
    if (custMatch) {
      const rawNum = custMatch[1].replace(/,/g, '');
      const count = parseInt(rawNum, 10);
      if (!isNaN(count) && count > 100) {
        results.push(
          this.createFact({
            documentId,
            page: pageNumber,
            subject,
            predicate: 'active_customers',
            value: `${custMatch[1]}+ customers`,
            normalizedValue: count,
            unit: 'COUNT',
            period: period || 'FY2024',
            scope: scope || 'Enterprise',
            metricQualifier: qualifier || 'reported',
            evidence: sentence,
            confidence: 0.92,
          })
        );
      }
    }

    // -------------------------------------------------------------
    // Pattern G: Express Parcel Volume / Shipment Volume
    // -------------------------------------------------------------
    const volumeRegex = /(?:express parcel|shipment|package|parcel)\s+volume\s*(?:of|reached|was|stood at|handled)?\s*([0-9,]+(?:\.[0-9]+)?)\s*(?:million|mn|crore|cr|billion|bn)?/i;
    const volMatch = sentence.match(volumeRegex);
    if (volMatch) {
      const parsed = parseNumericValue(volMatch[0]);
      if (parsed.normalizedValue) {
        results.push(
          this.createFact({
            documentId,
            page: pageNumber,
            subject,
            predicate: 'shipment_volume',
            value: volMatch[0].trim(),
            normalizedValue: parsed.normalizedValue,
            unit: 'SHIPMENTS',
            period: period || 'FY2024',
            scope: 'Express Parcel',
            metricQualifier: qualifier || 'reported',
            evidence: sentence,
            confidence: 0.91,
          })
        );
      }
    }

    // -------------------------------------------------------------
    // Pattern H: Macroeconomic Facts (GDP Growth, Inflation CPI, Repo Rate)
    // -------------------------------------------------------------
    const gdpRegex = /(?:real\s+)?gdp\s*(?:growth(?: rate)?|expanded by|is projected to grow at|projected at)?\s*(?:of|by|at|stood at)?\s*([0-9]+(?:\.[0-9]+)?)\s*%/i;
    const gdpMatch = sentence.match(gdpRegex);
    if (gdpMatch) {
      const rate = parseFloat(gdpMatch[1]);
      if (!isNaN(rate)) {
        results.push(
          this.createFact({
            documentId,
            page: pageNumber,
            subject: 'Indian Economy',
            predicate: 'gdp_growth',
            value: `${rate}%`,
            normalizedValue: rate,
            unit: 'PERCENT',
            period: period || '2024-25',
            scope: 'National',
            metricQualifier: qualifier || 'reported',
            evidence: sentence,
            confidence: 0.95,
          })
        );
      }
    }

    const cpiRegex = /(?:headline\s+)?(?:cpi|consumer price index|inflation)\s*(?:moderated to|stood at|was|averaged|projected at)?\s*([0-9]+(?:\.[0-9]+)?)\s*%/i;
    const cpiMatch = sentence.match(cpiRegex);
    if (cpiMatch && !/gdp|growth/i.test(cpiMatch[0])) {
      const rate = parseFloat(cpiMatch[1]);
      if (!isNaN(rate)) {
        results.push(
          this.createFact({
            documentId,
            page: pageNumber,
            subject: 'Indian Economy',
            predicate: 'inflation_rate',
            value: `${rate}%`,
            normalizedValue: rate,
            unit: 'PERCENT',
            period: period || '2024-25',
            scope: 'CPI',
            metricQualifier: qualifier || 'reported',
            evidence: sentence,
            confidence: 0.94,
          })
        );
      }
    }



    // -------------------------------------------------------------
    // Pattern K: Extraction / Reasoning Uncertainty & Ambiguity
    // -------------------------------------------------------------
    const uncertainRegex = /(?:expects?|anticipates?|projected to be approximately|growth of approximately|estimated between)\s+([0-9]+(?:\s*-\s*[0-9]+)?\s*%(?:\s+to\s+[0-9]+%)?)/i;
    const uncMatch = sentence.match(uncertainRegex);
    if (uncMatch && results.length === 0) {
      results.push(
        this.createFact({
          documentId,
          page: pageNumber,
          subject,
          predicate: 'projected_growth_estimate',
          value: uncMatch[1].trim(),
          normalizedValue: null,
          unit: 'PERCENT_RANGE',
          period: period || 'Unspecified Forward Period',
          scope: 'Forward Estimate',
          metricQualifier: 'unverified_estimate',
          evidence: sentence,
          confidence: 0.48, // Intentionally low confidence
        })
      );
    }

    return results;
  }

  detectPeriod(text, filename) {
    const rawPeriod = normalizePeriod(text);
    if (rawPeriod) return rawPeriod;

    // Fallback to filename period
    if (/prospectus-2022|2022/i.test(filename)) return 'FY2022';
    if (/fy24|2023-24|2024/i.test(filename)) return 'FY2024';
    if (/2024-25/i.test(filename)) return '2024-25';
    if (/2025/i.test(filename)) return '2025';

    return null;
  }

  detectScope(text) {
    if (/consolidated/i.test(text)) return 'Consolidated';
    if (/standalone/i.test(text)) return 'Standalone';
    if (/express parcel/i.test(text)) return 'Express Parcel';
    if (/part truckload|ptl/i.test(text)) return 'Part Truckload';
    if (/supply chain/i.test(text)) return 'Supply Chain Services';
    if (/cross border/i.test(text)) return 'Cross Border';
    if (/north america/i.test(text)) return 'North America';
    if (/global/i.test(text)) return 'Global';
    if (/national/i.test(text)) return 'National';
    return 'Consolidated';
  }

  detectQualifier(text) {
    if (/audited/i.test(text)) return 'audited';
    if (/unaudited/i.test(text)) return 'unaudited';
    if (/adjusted/i.test(text)) return 'adjusted';
    if (/estimated|projected|forecast/i.test(text)) return 'estimated';
    if (/gross/i.test(text)) return 'gross';
    if (/net/i.test(text)) return 'net';
    return 'reported';
  }

  detectSubject(text, defaultEntity) {
    if (/delhivery/i.test(text)) return 'Delhivery Limited';
    if (/reserve bank of india|rbi\b/i.test(text)) return 'Reserve Bank of India';
    if (/imf\b|international monetary fund/i.test(text)) return 'IMF';
    if (/sahil barua/i.test(text)) return 'Sahil Barua';
    if (/sandeep barasia/i.test(text)) return 'Sandeep Barasia';
    if (/spoton/i.test(text)) return 'Spoton Logistics';
    return defaultEntity;
  }

  createFact({
    documentId,
    page,
    subject,
    predicate,
    value,
    normalizedValue,
    unit,
    period,
    scope,
    metricQualifier,
    evidence,
    confidence,
  }) {
    return {
      id: `fact_${Date.now()}_${Math.floor(Math.random() * 100000)}_${factIdCounter++}`,
      documentId,
      page,
      subject: canonicalizeSubject(subject),
      predicate: canonicalizePredicate(predicate),
      value: cleanText(value),
      normalizedValue: normalizedValue !== undefined ? normalizedValue : null,
      unit: unit || 'UNKNOWN',
      period: period || 'Unspecified',
      scope: scope || 'General',
      metricQualifier: metricQualifier || 'reported',
      evidence: cleanText(evidence),
      confidence: confidence || 0.85,
      extractor: 'deterministic',
    };
  }
}

export default DeterministicExtractor;
