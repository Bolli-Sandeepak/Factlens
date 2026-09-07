/**
 * Base Abstract Extractor Class
 */
export class BaseExtractor {
  constructor(name = 'base') {
    this.name = name;
  }

  /**
   * Extract facts from page text.
   * @param {Object} params
   * @param {string} params.text - The page text
   * @param {number} params.pageNumber - The 1-based page number
   * @param {string} params.documentId - Document ID
   * @param {string} params.filename - Document filename
   * @param {string} [params.datasetCategory] - Optional dataset hint
   * @returns {Promise<Array<Object>>} Array of extracted Fact objects
   */
  async extract({ text, pageNumber, documentId, filename, datasetCategory }) {
    throw new Error('Method extract() must be implemented by subclass');
  }
}

export default BaseExtractor;
