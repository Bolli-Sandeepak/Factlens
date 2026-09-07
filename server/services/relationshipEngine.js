import { compareFacts } from '../reasoning/comparator.js';
import logger from '../utils/logger.js';

let relCounter = 1;

export class RelationshipEngine {
  /**
   * Compare all facts across documents and return structured relationships.
   * @param {Array<Object>} facts - List of all normalized facts
   * @returns {Array<Object>} List of classified relationships
   */
  generateRelationships(facts = []) {
    logger.info(`Analyzing cross-document relationships across ${facts.length} facts...`);
    const relationships = [];
    const processedPairs = new Set();

    // Group facts by predicate for efficient matching
    const factsByPredicate = new Map();
    for (const fact of facts) {
      if (!factsByPredicate.has(fact.predicate)) {
        factsByPredicate.set(fact.predicate, []);
      }
      factsByPredicate.get(fact.predicate).push(fact);
    }

    // Match within each predicate group
    for (const [predicate, predicateFacts] of factsByPredicate.entries()) {
      for (let i = 0; i < predicateFacts.length; i++) {
        for (let j = i + 1; j < predicateFacts.length; j++) {
          const factA = predicateFacts[i];
          const factB = predicateFacts[j];

          // Skip if from the same document
          if (factA.documentId === factB.documentId) continue;

          // Deduplicate pair
          const pairKey = [factA.id, factB.id].sort().join('__');
          if (processedPairs.has(pairKey)) continue;
          processedPairs.add(pairKey);

          const comparison = compareFacts(factA, factB);
          if (comparison) {
            relationships.push({
              id: `rel_${Date.now()}_${relCounter++}`,
              factAId: factA.id,
              factBId: factB.id,
              factA,
              factB,
              classification: comparison.classification,
              reasoning: comparison.reasoning,
              confidence: comparison.confidence,
              contextDiffType: comparison.contextDiffType,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    logger.success(
      `Discovered ${relationships.length} cross-document relationships ` +
      `(${relationships.filter(r => r.classification === 'CORROBORATED').length} Corroborated, ` +
      `${relationships.filter(r => r.classification === 'CONTRADICTION').length} Contradictions, ` +
      `${relationships.filter(r => r.classification === 'CONTEXTUAL_DIFFERENCE').length} Contextual Diffs, ` +
      `${relationships.filter(r => r.classification === 'UNCERTAIN').length} Uncertain).`
    );

    return relationships;
  }
}

export const relationshipEngine = new RelationshipEngine();
export default relationshipEngine;
