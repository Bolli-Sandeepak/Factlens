import { queryAll, queryOne, runQuery, resetDatabase as resetDb } from '../database/db.js';
import logger from '../utils/logger.js';

export const dbService = {
  // Document methods
  async saveDocument({ id, filename, originalName, fileSize, pageCount, datasetCategory, status = 'completed' }) {
    await runQuery(
      `INSERT OR REPLACE INTO documents (id, filename, original_name, file_size, page_count, dataset_category, uploaded_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, filename, originalName, fileSize, pageCount, datasetCategory, new Date().toISOString(), status]
    );
  },

  async getDocuments() {
    return await queryAll(`SELECT * FROM documents ORDER BY uploaded_at DESC`);
  },

  async getDocumentById(id) {
    return await queryOne(`SELECT * FROM documents WHERE id = ?`, [id]);
  },

  async saveDocumentPages(pages = []) {
    for (const p of pages) {
      await runQuery(
        `INSERT OR REPLACE INTO document_pages (id, document_id, page_number, text_content, token_count)
         VALUES (?, ?, ?, ?, ?)`,
        [`${p.documentId}_p${p.pageNumber}`, p.documentId, p.pageNumber, p.text, p.tokenCount || 0]
      );
    }
  },

  async getDocumentPages(documentId) {
    return await queryAll(
      `SELECT * FROM document_pages WHERE document_id = ? ORDER BY page_number ASC`,
      [documentId]
    );
  },

  // Fact methods
  async saveFacts(facts = []) {
    for (const f of facts) {
      await runQuery(
        `INSERT OR REPLACE INTO facts (id, document_id, subject, predicate, value, normalized_value, unit, period, scope, metric_qualifier, page, evidence, confidence, extractor, raw_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          f.id,
          f.documentId,
          f.subject,
          f.predicate,
          f.value,
          f.normalizedValue !== undefined ? f.normalizedValue : null,
          f.unit || 'UNKNOWN',
          f.period || 'Unspecified',
          f.scope || 'Consolidated',
          f.metricQualifier || 'reported',
          f.page,
          f.evidence,
          f.confidence || 0.85,
          f.extractor || 'deterministic',
          JSON.stringify(f),
        ]
      );
    }
  },

  async getFacts({ documentId, predicate, period, search } = {}) {
    let sql = `
      SELECT f.*, d.original_name as document_filename
      FROM facts f
      LEFT JOIN documents d ON f.document_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (documentId) {
      sql += ` AND f.document_id = ?`;
      params.push(documentId);
    }
    if (predicate) {
      sql += ` AND f.predicate = ?`;
      params.push(predicate);
    }
    if (period) {
      sql += ` AND f.period = ?`;
      params.push(period);
    }
    if (search) {
      sql += ` AND (f.subject LIKE ? OR f.value LIKE ? OR f.evidence LIKE ? OR f.predicate LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    sql += ` ORDER BY f.document_id, f.page ASC`;
    const rows = await queryAll(sql, params);
    return rows.map(r => ({
      ...r,
      documentId: r.document_id,
      normalizedValue: r.normalized_value,
      metricQualifier: r.metric_qualifier,
      documentFilename: r.document_filename,
    }));
  },

  async getFactById(id) {
    return await queryOne(
      `SELECT f.*, d.original_name as document_filename
       FROM facts f
       LEFT JOIN documents d ON f.document_id = d.id
       WHERE f.id = ?`,
      [id]
    );
  },

  // Relationship methods
  async saveRelationships(relationships = []) {
    for (const r of relationships) {
      await runQuery(
        `INSERT OR REPLACE INTO relationships (id, fact_a_id, fact_b_id, classification, reasoning, confidence, context_diff_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id,
          r.factAId,
          r.factBId,
          r.classification,
          r.reasoning,
          r.confidence,
          r.contextDiffType || 'NONE',
          r.createdAt || new Date().toISOString(),
        ]
      );
    }
  },

  async getRelationships({ classification } = {}) {
    let sql = `
      SELECT 
        r.id, r.classification, r.reasoning, r.confidence, r.context_diff_type, r.created_at,
        fa.id as fact_a_id, fa.subject as fact_a_subject, fa.predicate as fact_a_predicate,
        fa.value as fact_a_value, fa.normalized_value as fact_a_norm, fa.unit as fact_a_unit,
        fa.period as fact_a_period, fa.scope as fact_a_scope, fa.page as fact_a_page,
        fa.evidence as fact_a_evidence, fa.confidence as fact_a_confidence,
        da.original_name as doc_a_filename, da.id as doc_a_id,
        fb.id as fact_b_id, fb.subject as fact_b_subject, fb.predicate as fact_b_predicate,
        fb.value as fact_b_value, fb.normalized_value as fact_b_norm, fb.unit as fact_b_unit,
        fb.period as fact_b_period, fb.scope as fact_b_scope, fb.page as fact_b_page,
        fb.evidence as fact_b_evidence, fb.confidence as fact_b_confidence,
        db.original_name as doc_b_filename, db.id as doc_b_id
      FROM relationships r
      JOIN facts fa ON r.fact_a_id = fa.id
      JOIN facts fb ON r.fact_b_id = fb.id
      JOIN documents da ON fa.document_id = da.id
      JOIN documents db ON fb.document_id = db.id
      WHERE 1=1
    `;
    const params = [];

    if (classification && classification !== 'ALL') {
      sql += ` AND r.classification = ?`;
      params.push(classification.toUpperCase());
    }

    sql += ` ORDER BY r.confidence DESC, r.created_at DESC`;
    const rows = await queryAll(sql, params);

    return rows.map(row => ({
      id: row.id,
      classification: row.classification,
      reasoning: row.reasoning,
      confidence: row.confidence,
      contextDiffType: row.context_diff_type,
      createdAt: row.created_at,
      factA: {
        id: row.fact_a_id,
        subject: row.fact_a_subject,
        predicate: row.fact_a_predicate,
        value: row.fact_a_value,
        normalizedValue: row.fact_a_norm,
        unit: row.fact_a_unit,
        period: row.fact_a_period,
        scope: row.fact_a_scope,
        page: row.fact_a_page,
        evidence: row.fact_a_evidence,
        confidence: row.fact_a_confidence,
        documentId: row.doc_a_id,
        documentFilename: row.doc_a_filename,
      },
      factB: {
        id: row.fact_b_id,
        subject: row.fact_b_subject,
        predicate: row.fact_b_predicate,
        value: row.fact_b_value,
        normalizedValue: row.fact_b_norm,
        unit: row.fact_b_unit,
        period: row.fact_b_period,
        scope: row.fact_b_scope,
        page: row.fact_b_page,
        evidence: row.fact_b_evidence,
        confidence: row.fact_b_confidence,
        documentId: row.doc_b_id,
        documentFilename: row.doc_b_filename,
      },
    }));
  },

  async getRelationshipById(id) {
    const list = await this.getRelationships();
    return list.find(r => r.id === id) || null;
  },

  async getStats() {
    const docCountRes = await queryOne(`SELECT COUNT(*) as count FROM documents`);
    const factCountRes = await queryOne(`SELECT COUNT(*) as count FROM facts`);
    const pageCountRes = await queryOne(`SELECT COUNT(*) as count FROM document_pages`);
    
    const rels = await queryAll(`SELECT classification, COUNT(*) as count FROM relationships GROUP BY classification`);
    const breakdown = {
      CORROBORATED: 0,
      CONTRADICTION: 0,
      CONTEXTUAL_DIFFERENCE: 0,
      UNCERTAIN: 0,
    };
    for (const r of rels) {
      if (breakdown[r.classification] !== undefined) {
        breakdown[r.classification] = r.count;
      }
    }

    return {
      documentsCount: docCountRes ? docCountRes.count : 0,
      pagesCount: pageCountRes ? pageCountRes.count : 0,
      factsCount: factCountRes ? factCountRes.count : 0,
      relationshipsCount: Object.values(breakdown).reduce((a, b) => a + b, 0),
      breakdown,
    };
  },

  async clearAll() {
    await resetDb();
    logger.info('Database cleared.');
  },
};

export default dbService;
