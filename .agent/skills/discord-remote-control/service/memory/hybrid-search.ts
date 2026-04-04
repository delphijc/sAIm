/**
 * Hybrid Memory Search using RRF (Reciprocal Rank Fusion)
 * Combines ACT-R scoring, Hebbian associations, and FTS5 signals
 * into a unified ranked result set
 */

import { findSimilarMemories, getAssociatedMemories } from "./db.ts";
import type { SemanticMemory } from "./db.ts";

export interface HybridSearchOptions {
  sessionId?: string;
  limit?: number;
  weights?: {
    actr?: number;      // ACT-R activation weight (default 0.6)
    hebbian?: number;   // Hebbian association weight (default 0.3)
    confidence?: number; // Confidence boost weight (default 0.1)
  };
}

/**
 * RRF (Reciprocal Rank Fusion) combines multiple ranking signals
 * Formula: score = sum(1 / (k + rank)) for each ranking signal
 * k=60 is a standard constant to smooth lower-ranked results
 */
function rrfScore(
  actrRank: number,
  hebbianRank: number,
  confidenceRank: number,
  k: number = 60
): number {
  const actrComponent = actrRank > 0 ? 1 / (k + actrRank) : 0;
  const hebbianComponent = hebbianRank > 0 ? 1 / (k + hebbianRank) : 0;
  const confidenceComponent = confidenceRank > 0 ? 1 / (k + confidenceRank) : 0;
  return actrComponent + hebbianComponent + confidenceComponent;
}

/**
 * Retrieve Hebbian associates for a set of memory IDs
 * Returns memories linked to the primary results via high-weight associations
 */
function getHebbianAssociates(retrievedIds: string[]): SemanticMemory[] {
  try {
    return getAssociatedMemories(retrievedIds, 10);
  } catch (e) {
    console.warn("Failed to retrieve Hebbian associates:", e);
    return [];
  }
}

/**
 * Hybrid search combining ACT-R, Hebbian, and confidence signals
 * Uses RRF fusion to create a unified ranking
 */
export async function hybridSearch(
  query: string,
  options: HybridSearchOptions = {}
): Promise<SemanticMemory[]> {
  const limit = options.limit || 5;
  const weights = {
    actr: options.weights?.actr || 0.6,
    hebbian: options.weights?.hebbian || 0.3,
    confidence: options.weights?.confidence || 0.1,
  };

  // Step 1: Primary FTS5 + ACT-R retrieval (fetch extra to combine with associates)
  const primaryResults = await findSimilarMemories(
    query,
    options.sessionId,
    Math.max(10, limit * 2)
  );

  if (primaryResults.length === 0) {
    return [];
  }

  // Step 2: Retrieve Hebbian associates of primary results
  const primaryIds = primaryResults
    .map((m) => m.id)
    .filter((id): id is string => !!id);

  const associates = getHebbianAssociates(primaryIds);

  // Step 3: RRF Fusion - combine signals with weighted scoring
  const allResults = new Map<string, SemanticMemory & { rffScore: number }>();

  // Rank primary results by ACT-R score
  primaryResults.forEach((mem, idx) => {
    if (mem.id) {
      const actrRank = idx + 1; // ACT-R is primary ranker
      const hebbianRank = Infinity;
      const confidenceRank = Math.round((1 - mem.confidence) * 100); // Inverse rank by confidence

      const rffScore = rrfScore(actrRank, hebbianRank, confidenceRank);
      allResults.set(mem.id, {
        ...mem,
        rffScore,
      });
    }
  });

  // Rank associates by Hebbian weight and confidence
  associates.forEach((mem, idx) => {
    if (mem.id && !allResults.has(mem.id)) {
      const actrRank = Infinity;
      const hebbianRank = idx + 1; // Hebbian ranking for associates
      const confidenceRank = Math.round((1 - mem.confidence) * 100);

      const rffScore = rrfScore(actrRank, hebbianRank, confidenceRank);
      allResults.set(mem.id, {
        ...mem,
        rffScore,
      });
    }
  });

  // Step 4: Sort by RFF score and return top limit results
  const ranked = Array.from(allResults.values())
    .sort((a, b) => b.rffScore - a.rffScore)
    .slice(0, limit)
    .map(({ rffScore, ...mem }) => mem); // Remove internal score

  return ranked;
}

/**
 * Export for testing and direct use
 */
export { getHebbianAssociates };
