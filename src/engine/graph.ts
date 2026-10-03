/**
 * Evaluation order for the flow solver: strongly connected components in topological
 * order, members of a component sorted by id. Tarjan runs over ids sorted too, so the
 * order depends only on the graph, never on the order of the nodes array (#9).
 */
export interface EvalOrder {
  /** Node ids, upstream first. */
  order: string[];
  /** Components with more than one node, or a self-loop: each one is a cycle. */
  cycles: string[][];
  /** Position of each id in `order`. An edge u→v with pos(v) ≤ pos(u) feeds traffic back. */
  position: Map<string, number>;
}

export function evaluationOrder(ids: string[], successors: Map<string, string[]>): EvalOrder {
  const sorted = [...ids].sort();
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];
  let next = 0;

  // Iterative Tarjan: deep chains must not blow the call stack.
  for (const root of sorted) {
    if (index.has(root)) continue;
    const work: { id: string; i: number }[] = [{ id: root, i: 0 }];
    index.set(root, next); low.set(root, next); next++;
    stack.push(root); onStack.add(root);
    while (work.length > 0) {
      const frame = work[work.length - 1];
      const succ = successors.get(frame.id) ?? [];
      if (frame.i < succ.length) {
        const w = succ[frame.i++];
        if (!index.has(w)) {
          index.set(w, next); low.set(w, next); next++;
          stack.push(w); onStack.add(w);
          work.push({ id: w, i: 0 });
        } else if (onStack.has(w)) {
          low.set(frame.id, Math.min(low.get(frame.id)!, index.get(w)!));
        }
        continue;
      }
      work.pop();
      if (work.length > 0) {
        const parent = work[work.length - 1].id;
        low.set(parent, Math.min(low.get(parent)!, low.get(frame.id)!));
      }
      if (low.get(frame.id) === index.get(frame.id)) {
        const comp: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          comp.push(w);
        } while (w !== frame.id);
        components.push(comp.sort());
      }
    }
  }

  // Tarjan emits components in reverse topological order.
  components.reverse();
  const order = components.flat();
  const position = new Map(order.map((id, i) => [id, i]));
  const cycles = components.filter(c =>
    c.length > 1 || (successors.get(c[0]) ?? []).includes(c[0]),
  );
  return { order, cycles, position };
}
