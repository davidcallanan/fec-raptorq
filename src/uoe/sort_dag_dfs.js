/**
 * Sorts a directed acyclic graph (DAG) using depth-first search (DFS).
 * 
 * @example
 * 
 * const edges = [
 *   ["a", "b"],
 *   ["a", "c"],
 *   ["a", "e"],
 *   ["b", "d"],
 *   ["c", "d"],
 *   ["d", "e"],
 * ];
 * 
 * const order = sort_dag_dfs(edges); // ["a", "c", "b", "d", "e"]
 */
export const sort_dag_dfs = (edges) => {
	const nodes = new Set();
	const edges_map = new Map();

	for (const [from, to] of edges) {
		nodes.add(from);
		nodes.add(to);

		if (!edges_map.has(from)) {
			edges_map.set(from, new Set());
		}

		edges_map.get(from).add(to);
	}

	const visited = new Set();
	const stack = [];

	const dfs = (node) => {
		if (visited.has(node)) {
			return;
		}

		visited.add(node);

		if (edges_map.has(node)) {
			for (const to of edges_map.get(node)) {
				dfs(to);
			}
		}

		stack.push(node);
	};

	for (const node of nodes) {
		dfs(node);
	}

	return stack.reverse();
};

export const sortDagDfs = sort_dag_dfs;
