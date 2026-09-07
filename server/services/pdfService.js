import fs from 'fs';
import pdfParse from 'pdf-parse';
import { cleanText } from '../utils/textUtils.js';
import logger from '../utils/logger.js';

/**
 * Extract text from PDF buffer with exact page numbers.
 * @param {Buffer|string} input - PDF buffer or file path
 * @returns {Promise<{ pageCount: number, pages: Array<{ pageNumber: number, text: string, tokenCount: number }> }>}
 */
export async function extractTextFromPdf(input) {
  let dataBuffer;
  if (typeof input === 'string') {
    dataBuffer = fs.readFileSync(input);
  } else if (Buffer.isBuffer(input)) {
    dataBuffer = input;
  } else {
    throw new Error('Invalid PDF input type: expected Buffer or filepath string');
  }

  const pages = [];
  let currentPage = 0;

  const options = {
    pagerender: function (pageData) {
      return pageData.getTextContent().then(function (textContent) {
        let text = '';
        if (textContent && textContent.items) {
          for (const item of textContent.items) {
            text += (item.str || '') + ' ';
          }
        }
        currentPage++;
        const cleaned = cleanText(text);
        const tokenCount = cleaned.split(/\s+/).filter(Boolean).length;
        pages.push({
          pageNumber: currentPage,
          text: cleaned,
          tokenCount,
        });
        return text;
      });
    },
  };

  try {
    const parsedData = await pdfParse(dataBuffer, options);
    logger.info(`Successfully parsed ${parsedData.numpages} pages.`);

    // If for any reason pages weren't populated in custom callback, fallback to full text
    if (pages.length === 0 && parsedData.text) {
      const fullCleaned = cleanText(parsedData.text);
      pages.push({
        pageNumber: 1,
        text: fullCleaned,
        tokenCount: fullCleaned.split(/\s+/).filter(Boolean).length,
      });
    }

    return {
      pageCount: parsedData.numpages || pages.length,
      pages,
    };
  } catch (err) {
    logger.error(`PDF parsing failed: ${err.message}`);
    throw new Error(`Failed to extract text from PDF: ${err.message}`);
  }
}

export default {
  extractTextFromPdf,
};
