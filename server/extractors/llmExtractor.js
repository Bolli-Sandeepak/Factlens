import { BaseExtractor } from './baseExtractor.js';
import { cleanText, canonicalizePredicate, canonicalizeSubject } from '../utils/textUtils.js';
import logger from '../utils/logger.js';

export class LlmExtractor extends BaseExtractor {
  constructor() {
    super('llm');
    this.geminiKey = process.env.GEMINI_API_KEY;
    this.openaiKey = process.env.OPENAI_API_KEY;
    this.isEnabled = Boolean(this.geminiKey || this.openaiKey);

    if (this.isEnabled) {
      logger.info(`LLM Extractor configured with: ${this.geminiKey ? 'Gemini API' : 'OpenAI API'}`);
    } else {
      logger.debug('No LLM API keys configured. LLM extractor will remain in dormant/fallback mode.');
    }
  }

  /**
   * Extract facts via structured LLM schema call if API keys are available.
   */
  async extract({ text, pageNumber, documentId, filename, datasetCategory }) {
    if (!this.isEnabled || !text || text.trim().length < 50) {
      return [];
    }

    try {
      if (this.geminiKey) {
        return await this.extractWithGemini({ text, pageNumber, documentId, filename });
      } else if (this.openaiKey) {
        return await this.extractWithOpenAI({ text, pageNumber, documentId, filename });
      }
    } catch (err) {
      logger.warn(`LLM extraction encountered an issue on page ${pageNumber}:`, err.message);
      return [];
    }

    return [];
  }

  async extractWithGemini({ text, pageNumber, documentId, filename }) {
    const prompt = `You are a strict, high-precision fact extraction engine.
Given the following page text from document "${filename}" (Page ${pageNumber}), extract all concrete semantic, financial, and operational facts.

RULES:
1. ONLY extract facts directly stated in the text. DO NOT fabricate or extrapolate.
2. For every fact, the "evidence" field MUST be an exact verbatim sentence copied directly from the text.
3. If a statement is forward-looking or ambiguous, assign confidence < 0.6.

Output a JSON array of objects with keys:
- subject: string (e.g. "Delhivery Limited", "Reserve Bank of India")
- predicate: string (e.g. "revenue", "ebitda", "headcount", "gdp_growth", "executive_role")
- value: string (e.g. "₹8,142 Cr", "5,200", "7.2%")
- normalizedValue: number or null (e.g. 81420000000)
- unit: string (e.g. "INR", "USD", "PERCENT", "COUNT", "ROLE")
- period: string (e.g. "FY2024", "FY2023", "2024-25")
- scope: string (e.g. "Consolidated", "Standalone", "Global")
- metricQualifier: string ("reported" | "audited" | "estimated")
- evidence: string (verbatim sentence)
- confidence: number (0.0 to 1.0)

TEXT:
${text.substring(0, 4000)}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return [];

    const parsedArray = JSON.parse(candidateText);
    if (!Array.isArray(parsedArray)) return [];

    return parsedArray.map((item, idx) => ({
      id: `llm_fact_${Date.now()}_${pageNumber}_${idx}`,
      documentId,
      page: pageNumber,
      subject: canonicalizeSubject(item.subject),
      predicate: canonicalizePredicate(item.predicate),
      value: cleanText(item.value),
      normalizedValue: typeof item.normalizedValue === 'number' ? item.normalizedValue : null,
      unit: item.unit || 'UNKNOWN',
      period: item.period || 'Unspecified',
      scope: item.scope || 'General',
      metricQualifier: item.metricQualifier || 'reported',
      evidence: cleanText(item.evidence),
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.88,
      extractor: 'llm',
    }));
  }

  async extractWithOpenAI({ text, pageNumber, documentId, filename }) {
    const prompt = `Extract concrete financial, operational, and organizational facts from the text. Return a JSON array conforming to the Fact schema with verbatim evidence quotes.\n\nTEXT:\n${text.substring(0, 4000)}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    const factsList = Array.isArray(parsed) ? parsed : (parsed.facts || []);

    return factsList.map((item, idx) => ({
      id: `llm_fact_${Date.now()}_${pageNumber}_${idx}`,
      documentId,
      page: pageNumber,
      subject: canonicalizeSubject(item.subject),
      predicate: canonicalizePredicate(item.predicate),
      value: cleanText(item.value),
      normalizedValue: typeof item.normalizedValue === 'number' ? item.normalizedValue : null,
      unit: item.unit || 'UNKNOWN',
      period: item.period || 'Unspecified',
      scope: item.scope || 'General',
      metricQualifier: item.metricQualifier || 'reported',
      evidence: cleanText(item.evidence),
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.88,
      extractor: 'llm',
    }));
  }
}

export default LlmExtractor;
