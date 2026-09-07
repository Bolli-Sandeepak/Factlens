import { DeterministicExtractor } from '../extractors/deterministicExtractor.js';
import { LlmExtractor } from '../extractors/llmExtractor.js';
import { normalizeFactsBatch } from './factNormalizer.js';
import logger from '../utils/logger.js';

export class FactExtractorService {
  constructor() {
    this.deterministicExtractor = new DeterministicExtractor();
    this.llmExtractor = new LlmExtractor();
  }

  /**
   * Extract and normalize facts from all pages of a document.
   * @param {Object} params
   * @param {string} params.documentId
   * @param {string} params.filename
   * @param {Array<{ pageNumber: number, text: string }>} params.pages
   * @param {string} [params.datasetCategory]
   * @returns {Promise<Array<Object>>} Extracted and normalized facts
   */
  async extractFromDocument({ documentId, filename, pages, datasetCategory }) {
    logger.info(`Starting fact extraction for document "${filename}" (${pages.length} pages)...`);
    const allRawFacts = [];

    for (const page of pages) {
      if (!page.text || page.text.trim().length < 20) continue;

      // Run deterministic extractor
      const detFacts = await this.deterministicExtractor.extract({
        text: page.text,
        pageNumber: page.pageNumber,
        documentId,
        filename,
        datasetCategory,
      });
      allRawFacts.push(...detFacts);

      // Run optional LLM extractor if enabled
      if (this.llmExtractor.isEnabled) {
        const llmFacts = await this.llmExtractor.extract({
          text: page.text,
          pageNumber: page.pageNumber,
          documentId,
          filename,
          datasetCategory,
        });
        allRawFacts.push(...llmFacts);
      }
    }

    // Normalize facts
    const normalizedFacts = normalizeFactsBatch(allRawFacts);

    // Deduplicate facts within the same document (same subject + predicate + period + scope + value)
    const uniqueFacts = [];
    const seen = new Set();

    for (const f of normalizedFacts) {
      const key = `${f.documentId}_${f.subject}_${f.predicate}_${f.period}_${f.scope}_${f.value}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueFacts.push(f);
      }
    }

    logger.success(`Extracted ${uniqueFacts.length} unique facts from "${filename}".`);
    return uniqueFacts;
  }
}

export const factExtractorService = new FactExtractorService();
export default factExtractorService;
