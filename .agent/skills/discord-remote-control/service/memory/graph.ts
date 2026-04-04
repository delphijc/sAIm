/**
 * Graph Query Engine - SQLite-backed Graph Traversal
 *
 * Provides graph database-like functionality on top of the existing
 * SQLite associations table. This is a DUPLICATE/ENHANCEMENT layer —
 * it does NOT replace the existing Hebbian association logic in db.ts.
 *
 * Capabilities:
 * - Full graph data export (nodes + edges)
 * - Neighbor discovery (1-hop, n-hop)
 * - BFS/DFS traversal
 * - Community detection (label propagation)
 * - Centrality metrics (degree, weighted degree)
 * - Path finding between two nodes
 * - Subgraph extraction
 */

import { getMemoryInstance } from "./db.ts";

// ── Types ────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  topic: string;
  summary: string;
  confidence: number;
  accessCount: number;
  createdAt: number;
  source: string;
  tags: string[];
  // Graph metrics (computed)
  degree?: number;
  weightedDegree?: number;
  community?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  coActivationCount: number;
  lastActivated: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: GraphStats;
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  avgDegree: number;
  avgWeight: number;
  maxDegree: number;
  density: number;
  connectedComponents: number;
  isolatedNodes: number;
}

export interface TraversalResult {
  visited: GraphNode[];
  edges: GraphEdge[];
  depth: number;
}

export interface PathResult {
  path: GraphNode[];
  edges: GraphEdge[];
  totalWeight: number;
  hops: number;
}

export interface CommunityResult {
  communities: { id: number; members: GraphNode[]; size: number }[];
  modularity: number;
}

export interface CentralityResult {
  nodes: (GraphNode & { centrality: number })[];
  metric: string;
}

// ── Graph Data Retrieval ─────────────────────────────────────────────────

/**
 * Get the full graph: all semantic memories as nodes, all associations as edges
 */
export function getGraphData(): GraphData {
  const mem = getMemoryInstance();

  // Get all semantic memories that participate in associations
  const allNodes = mem.rawQuery(`
    SELECT DISTINCT s.*
    FROM semantic s
    WHERE s.id IN (
      SELECT source_id FROM associations
      UNION
      SELECT target_id FROM associations
    )
    ORDER BY s.access_count DESC
  `) as any[];

  const allEdges = mem.rawQuery(`
    SELECT source_id, target_id, weight, co_activation_count, last_activated
    FROM associations
    ORDER BY weight DESC
  `) as any[];

  const nodes: GraphNode[] = allNodes.map(nodeFromRow);
  const edges: GraphEdge[] = allEdges.map(edgeFromRow);

  // Compute degree for each node
  const degreeMap = new Map<string, number>();
  const weightedDegreeMap = new Map<string, number>();
  for (const edge of edges) {
    degreeMap.set(edge.source, (degreeMap.get(edge.source) || 0) + 1);
    degreeMap.set(edge.target, (degreeMap.get(edge.target) || 0) + 1);
    weightedDegreeMap.set(edge.source, (weightedDegreeMap.get(edge.source) || 0) + edge.weight);
    weightedDegreeMap.set(edge.target, (weightedDegreeMap.get(edge.target) || 0) + edge.weight);
  }

  for (const node of nodes) {
    node.degree = degreeMap.get(node.id) || 0;
    node.weightedDegree = weightedDegreeMap.get(node.id) || 0;
  }

  // Compute stats
  const degrees = nodes.map(n => n.degree || 0);
  const maxDegree = degrees.length > 0 ? Math.max(...degrees) : 0;
  const avgDegree = degrees.length > 0 ? degrees.reduce((a, b) => a + b, 0) / degrees.length : 0;
  const avgWeight = edges.length > 0 ? edges.reduce((a, e) => a + e.weight, 0) / edges.length : 0;
  const n = nodes.length;
  const density = n > 1 ? (2 * edges.length) / (n * (n - 1)) : 0;

  // Count connected components
  const components = findConnectedComponents(nodes, edges);

  // Count isolated nodes (semantic memories with no associations)
  const isolatedCount = (mem.rawQuery(`
    SELECT COUNT(*) as count FROM semantic
    WHERE id NOT IN (
      SELECT source_id FROM associations
      UNION
      SELECT target_id FROM associations
    )
  `) as any[])[0]?.count || 0;

  return {
    nodes,
    edges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      avgDegree: Math.round(avgDegree * 100) / 100,
      avgWeight: Math.round(avgWeight * 1000) / 1000,
      maxDegree,
      density: Math.round(density * 10000) / 10000,
      connectedComponents: components,
      isolatedNodes: isolatedCount,
    },
  };
}

// ── Neighbor Discovery ───────────────────────────────────────────────────

/**
 * Get immediate neighbors of a node (1-hop)
 */
export function getNeighbors(nodeId: string, minWeight: number = 0): { node: GraphNode; edges: GraphEdge[] } {
  const mem = getMemoryInstance();

  const node = mem.rawQuery("SELECT * FROM semantic WHERE id = ?", nodeId);
  if (node.length === 0) throw new Error(`Node not found: ${nodeId}`);

  const neighborEdges = mem.rawQuery(`
    SELECT a.*,
      CASE WHEN a.source_id = ? THEN a.target_id ELSE a.source_id END as neighbor_id
    FROM associations a
    WHERE (a.source_id = ? OR a.target_id = ?)
      AND a.weight >= ?
    ORDER BY a.weight DESC
  `, nodeId, nodeId, nodeId, minWeight) as any[];

  const neighborIds = neighborEdges.map((e: any) => e.neighbor_id);

  let neighbors: GraphNode[] = [];
  if (neighborIds.length > 0) {
    const placeholders = neighborIds.map(() => "?").join(",");
    const neighborRows = mem.rawQuery(
      `SELECT * FROM semantic WHERE id IN (${placeholders})`,
      ...neighborIds
    );
    neighbors = neighborRows.map(nodeFromRow);
  }

  return {
    node: nodeFromRow(node[0]),
    edges: neighborEdges.map(edgeFromRow),
  };
}

// ── BFS Traversal ────────────────────────────────────────────────────────

/**
 * Breadth-first traversal from a starting node
 * Returns all reachable nodes within maxDepth hops
 */
export function bfsTraversal(
  startId: string,
  maxDepth: number = 3,
  minWeight: number = 0
): TraversalResult {
  const mem = getMemoryInstance();
  const visited = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: startId, depth: 0 }];
  const resultNodes: GraphNode[] = [];
  const resultEdges: GraphEdge[] = [];
  let maxDepthReached = 0;

  // Pre-fetch the start node
  const startNode = mem.rawQuery("SELECT * FROM semantic WHERE id = ?", startId);
  if (startNode.length === 0) throw new Error(`Start node not found: ${startId}`);

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id) || depth > maxDepth) continue;
    visited.add(id);
    maxDepthReached = Math.max(maxDepthReached, depth);

    // Get the node
    const nodeRows = mem.rawQuery("SELECT * FROM semantic WHERE id = ?", id);
    if (nodeRows.length > 0) {
      resultNodes.push(nodeFromRow(nodeRows[0]));
    }

    // Get outgoing edges
    if (depth < maxDepth) {
      const edges = mem.rawQuery(`
        SELECT * FROM associations
        WHERE (source_id = ? OR target_id = ?)
          AND weight >= ?
        ORDER BY weight DESC
      `, id, id, minWeight) as any[];

      for (const edge of edges) {
        const neighborId = edge.source_id === id ? edge.target_id : edge.source_id;
        if (!visited.has(neighborId)) {
          resultEdges.push(edgeFromRow(edge));
          queue.push({ id: neighborId, depth: depth + 1 });
        }
      }
    }
  }

  return { visited: resultNodes, edges: resultEdges, depth: maxDepthReached };
}

// ── Shortest Path ────────────────────────────────────────────────────────

/**
 * Find shortest path between two nodes using BFS
 * Returns the path with minimum hops (unweighted shortest path)
 */
export function findPath(fromId: string, toId: string, maxDepth: number = 6): PathResult | null {
  const mem = getMemoryInstance();
  const visited = new Set<string>();
  const parent = new Map<string, { nodeId: string; edge: any }>();
  const queue: string[] = [fromId];
  visited.add(fromId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === toId) {
      // Reconstruct path
      return reconstructPath(mem, fromId, toId, parent);
    }

    // Check depth
    let depth = 0;
    let trace = current;
    while (parent.has(trace)) {
      depth++;
      trace = parent.get(trace)!.nodeId;
    }
    if (depth >= maxDepth) continue;

    const edges = mem.rawQuery(`
      SELECT * FROM associations
      WHERE source_id = ? OR target_id = ?
    `, current, current) as any[];

    for (const edge of edges) {
      const neighborId = edge.source_id === current ? edge.target_id : edge.source_id;
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        parent.set(neighborId, { nodeId: current, edge });
        queue.push(neighborId);
      }
    }
  }

  return null; // No path found
}

function reconstructPath(
  mem: ReturnType<typeof getMemoryInstance>,
  fromId: string,
  toId: string,
  parent: Map<string, { nodeId: string; edge: any }>
): PathResult {
  const pathIds: string[] = [];
  const pathEdges: GraphEdge[] = [];
  let current = toId;
  let totalWeight = 0;

  while (current !== fromId) {
    pathIds.unshift(current);
    const p = parent.get(current)!;
    pathEdges.unshift(edgeFromRow(p.edge));
    totalWeight += p.edge.weight;
    current = p.nodeId;
  }
  pathIds.unshift(fromId);

  // Fetch full node data
  const placeholders = pathIds.map(() => "?").join(",");
  const nodeRows = mem.rawQuery(
    `SELECT * FROM semantic WHERE id IN (${placeholders})`,
    ...pathIds
  );
  const nodeMap = new Map(nodeRows.map((r: any) => [r.id, nodeFromRow(r)]));
  const pathNodes = pathIds.map(id => nodeMap.get(id)!).filter(Boolean);

  return {
    path: pathNodes,
    edges: pathEdges,
    totalWeight: Math.round(totalWeight * 1000) / 1000,
    hops: pathEdges.length,
  };
}

// ── Community Detection (Label Propagation) ──────────────────────────────

/**
 * Simple community detection using label propagation algorithm
 * Each node starts with its own label, then iteratively adopts the
 * most common label among its neighbors (weighted by edge weight)
 */
export function detectCommunities(maxIterations: number = 20): CommunityResult {
  const { nodes, edges } = getGraphData();

  if (nodes.length === 0) {
    return { communities: [], modularity: 0 };
  }

  // Build adjacency list
  const adjacency = new Map<string, { neighborId: string; weight: number }[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    adjacency.get(edge.source)?.push({ neighborId: edge.target, weight: edge.weight });
    adjacency.get(edge.target)?.push({ neighborId: edge.source, weight: edge.weight });
  }

  // Initialize labels
  const labels = new Map<string, number>();
  nodes.forEach((node, idx) => labels.set(node.id, idx));

  // Label propagation iterations
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;
    // Shuffle node order for non-determinism
    const shuffled = [...nodes].sort(() => Math.random() - 0.5);

    for (const node of shuffled) {
      const neighbors = adjacency.get(node.id) || [];
      if (neighbors.length === 0) continue;

      // Count weighted label frequencies among neighbors
      const labelWeights = new Map<number, number>();
      for (const { neighborId, weight } of neighbors) {
        const neighborLabel = labels.get(neighborId)!;
        labelWeights.set(neighborLabel, (labelWeights.get(neighborLabel) || 0) + weight);
      }

      // Pick the label with highest total weight
      let bestLabel = labels.get(node.id)!;
      let bestWeight = 0;
      for (const [label, weight] of labelWeights) {
        if (weight > bestWeight) {
          bestWeight = weight;
          bestLabel = label;
        }
      }

      if (bestLabel !== labels.get(node.id)) {
        labels.set(node.id, bestLabel);
        changed = true;
      }
    }

    if (!changed) break; // Converged
  }

  // Group nodes by community label
  const communityMap = new Map<number, GraphNode[]>();
  for (const node of nodes) {
    const label = labels.get(node.id)!;
    node.community = label;
    if (!communityMap.has(label)) communityMap.set(label, []);
    communityMap.get(label)!.push(node);
  }

  // Renumber communities 0, 1, 2, ...
  const communities = Array.from(communityMap.values())
    .sort((a, b) => b.length - a.length)
    .map((members, idx) => {
      members.forEach(m => m.community = idx);
      return { id: idx, members, size: members.length };
    });

  // Simple modularity estimate
  const totalWeight = edges.reduce((sum, e) => sum + e.weight, 0) || 1;
  let Q = 0;
  for (const edge of edges) {
    const ci = labels.get(edge.source);
    const cj = labels.get(edge.target);
    if (ci === cj) {
      Q += edge.weight / totalWeight;
    }
  }
  Q = Math.round(Q * 1000) / 1000;

  return { communities, modularity: Q };
}

// ── Centrality Metrics ───────────────────────────────────────────────────

/**
 * Compute degree centrality for all nodes
 * Returns nodes sorted by centrality (most connected first)
 */
export function degreeCentrality(): CentralityResult {
  const { nodes, edges } = getGraphData();

  const degreeMap = new Map<string, number>();
  for (const edge of edges) {
    degreeMap.set(edge.source, (degreeMap.get(edge.source) || 0) + 1);
    degreeMap.set(edge.target, (degreeMap.get(edge.target) || 0) + 1);
  }

  const maxDegree = Math.max(...Array.from(degreeMap.values()), 1);
  const result = nodes.map(node => ({
    ...node,
    centrality: Math.round(((degreeMap.get(node.id) || 0) / maxDegree) * 1000) / 1000,
  }));

  result.sort((a, b) => b.centrality - a.centrality);
  return { nodes: result, metric: "degree" };
}

/**
 * Compute weighted degree centrality (sum of edge weights)
 */
export function weightedCentrality(): CentralityResult {
  const { nodes, edges } = getGraphData();

  const weightMap = new Map<string, number>();
  for (const edge of edges) {
    weightMap.set(edge.source, (weightMap.get(edge.source) || 0) + edge.weight);
    weightMap.set(edge.target, (weightMap.get(edge.target) || 0) + edge.weight);
  }

  const maxWeight = Math.max(...Array.from(weightMap.values()), 0.001);
  const result = nodes.map(node => ({
    ...node,
    centrality: Math.round(((weightMap.get(node.id) || 0) / maxWeight) * 1000) / 1000,
  }));

  result.sort((a, b) => b.centrality - a.centrality);
  return { nodes: result, metric: "weighted_degree" };
}

// ── Helper Functions ─────────────────────────────────────────────────────

function nodeFromRow(row: any): GraphNode {
  return {
    id: row.id,
    topic: row.topic,
    summary: row.summary,
    confidence: row.confidence || 0.5,
    accessCount: row.access_count || 0,
    createdAt: row.created_at || 0,
    source: row.source || "discord",
    tags: row.tags ? (typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags) : [],
  };
}

function edgeFromRow(row: any): GraphEdge {
  return {
    source: row.source_id,
    target: row.target_id,
    weight: row.weight,
    coActivationCount: row.co_activation_count,
    lastActivated: row.last_activated,
  };
}

/**
 * Count connected components using union-find
 */
function findConnectedComponents(nodes: GraphNode[], edges: GraphEdge[]): number {
  if (nodes.length === 0) return 0;

  const parent = new Map<string, string>();
  const rank = new Map<string, number>();

  function find(x: string): string {
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)!));
    }
    return parent.get(x)!;
  }

  function union(a: string, b: string): void {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    const rankA = rank.get(ra) || 0;
    const rankB = rank.get(rb) || 0;
    if (rankA < rankB) {
      parent.set(ra, rb);
    } else if (rankA > rankB) {
      parent.set(rb, ra);
    } else {
      parent.set(rb, ra);
      rank.set(ra, rankA + 1);
    }
  }

  for (const node of nodes) {
    parent.set(node.id, node.id);
    rank.set(node.id, 0);
  }

  for (const edge of edges) {
    if (parent.has(edge.source) && parent.has(edge.target)) {
      union(edge.source, edge.target);
    }
  }

  const roots = new Set<string>();
  for (const node of nodes) {
    roots.add(find(node.id));
  }

  return roots.size;
}
