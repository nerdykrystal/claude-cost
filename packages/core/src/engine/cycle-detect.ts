import type { Plan } from "../schemas/plan.js";

type NodeColor = "white" | "gray" | "black";

/**
 * Detects cycles in a plan's dependency graph.
 * Builds edges from both `depends_on` and `carry_context_from` fields.
 * Uses depth-first search with 3-color marking.
 *
 * @param plan - The plan to check
 * @returns Array of stage_ids forming a cycle, or null if the plan is a DAG
 * @throws Error with code CC-SCHEMA-001 if a cycle is detected
 */
export function detectCycle(plan: Plan): string[] | null {
  // Build adjacency list from both depends_on and carry_context_from
  const adjacencyMap = new Map<string, Set<string>>();

  for (const stage of plan.stages) {
    if (!adjacencyMap.has(stage.id)) {
      adjacencyMap.set(stage.id, new Set());
    }
    const neighbors = adjacencyMap.get(stage.id)!;

    // Add edges from depends_on
    for (const depId of stage.depends_on) {
      neighbors.add(depId);
    }

    // Add edges from carry_context_from
    for (const contextId of stage.carry_context_from) {
      neighbors.add(contextId);
    }

    // Ensure all referenced nodes exist in the map
    for (const depId of stage.depends_on) {
      if (!adjacencyMap.has(depId)) {
        adjacencyMap.set(depId, new Set());
      }
    }
    for (const contextId of stage.carry_context_from) {
      if (!adjacencyMap.has(contextId)) {
        adjacencyMap.set(contextId, new Set());
      }
    }
  }

  const colors = new Map<string, NodeColor>();
  const path: string[] = [];

  // Initialize all nodes as white
  for (const stageId of adjacencyMap.keys()) {
    colors.set(stageId, "white");
  }

  // DFS from each unvisited node
  for (const stageId of adjacencyMap.keys()) {
    if (colors.get(stageId) === "white") {
      const cycleFound = dfs(stageId, adjacencyMap, colors, path);
      if (cycleFound) {
        return path;
      }
    }
  }

  return null;
}

/**
 * Validates the entire plan graph for cycles.
 * Throws CC-SCHEMA-001 if a cycle is detected.
 *
 * @param plan - The plan to validate
 * @throws Error with code CC-SCHEMA-001 and cycle information
 */
export function validatePlanGraph(plan: Plan): void {
  const cycle = detectCycle(plan);
  if (cycle !== null) {
    throw new Error(
      `CC-SCHEMA-001: cycle detected in plan dependency graph: ${cycle.join(" -> ")}`
    );
  }
}

/**
 * Recursive DFS helper for cycle detection.
 * Returns true if a cycle is found (cycle path populated in path array).
 */
function dfs(
  node: string,
  adjacencyMap: Map<string, Set<string>>,
  colors: Map<string, NodeColor>,
  path: string[]
): boolean {
  colors.set(node, "gray");
  path.push(node);

  const neighbors = adjacencyMap.get(node) || new Set();
  for (const neighbor of neighbors) {
    const color = colors.get(neighbor);

    if (color === "gray") {
      // Back edge found: cycle detected
      // Extract the cycle from path
      const cycleStartIdx = path.indexOf(neighbor);
      const cycleNodes = path.slice(cycleStartIdx);
      cycleNodes.push(neighbor); // Complete the cycle
      path.length = 0;
      path.push(...cycleNodes);
      return true;
    }

    if (color === "white") {
      const found = dfs(neighbor, adjacencyMap, colors, path);
      if (found) {
        return true;
      }
    }
  }

  path.pop();
  colors.set(node, "black");
  return false;
}
