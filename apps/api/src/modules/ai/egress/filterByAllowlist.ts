export interface AllowlistFilterResult {
  filtered: unknown;
  removed: string[];
}

type Node = { kind: 'leaf' | 'object' | 'array'; children: Map<string, Node> };

export function filterByAllowlist(value: unknown, entries: readonly string[]): AllowlistFilterResult {
  const tree = buildTree(entries);
  const root: Node = Array.isArray(value) ? { kind: 'array', children: tree.children } : tree;
  const removed: string[] = [];
  const filtered = filterValue(value, root, '', removed);
  return { filtered, removed };
}

export function emptyFor(value: unknown): unknown {
  if (Array.isArray(value)) return [];
  if (value && typeof value === 'object') return {};
  return null;
}

export function collectAllowedFields(entries: readonly string[]): string[] {
  return collectLeaves(buildTree(entries), '');
}

function buildTree(entries: readonly string[]): Node {
  const root: Node = { kind: 'object', children: new Map() };
  for (const entry of entries) {
    const parts = entry.split('.');
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isArray = part.endsWith('[]');
      const key = isArray ? part.slice(0, -2) : part;
      const isLast = i === parts.length - 1;
      let child = node.children.get(key);
      if (!child) {
        child = isLast
          ? isArray
            ? { kind: 'array', children: new Map() }
            : { kind: 'leaf', children: new Map() }
          : isArray
            ? { kind: 'array', children: new Map() }
            : { kind: 'object', children: new Map() };
        node.children.set(key, child);
      }
      node = child;
    }
  }
  return root;
}

function filterValue(value: unknown, node: Node, path: string, removed: string[]): unknown {
  if (node.kind === 'leaf') return value;

  if (Array.isArray(value)) {
    if (node.kind !== 'array') {
      removed.push(`${path}*`);
      return [];
    }
    return value.map((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        return filterObject(item as Record<string, unknown>, node.children, path, removed);
      }
      return item;
    });
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (node.kind === 'array') {
      removed.push(`${path}*`);
      return null;
    }
    return filterObject(value as Record<string, unknown>, node.children, path, removed);
  }

  removed.push(`${path}*`);
  return null;
}

function filterObject(obj: Record<string, unknown>, children: Map<string, Node>, path: string, removed: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    const childNode = children.get(key);
    if (!childNode) {
      removed.push(`${path}${key}`);
      continue;
    }
    out[key] = filterValue(val, childNode, `${path}${key}.`, removed);
  }
  return out;
}

function collectLeaves(node: Node, prefix: string): string[] {
  if (node.kind === 'leaf') return [prefix.replace(/\.$/, '')];
  if (node.children.size === 0) {
    const base = prefix.replace(/\.$/, '');
    return [node.kind === 'array' ? `${base}[]` : base];
  }
  const paths: string[] = [];
  for (const [key, child] of node.children) {
    paths.push(...collectLeaves(child, `${prefix}${key}.`));
  }
  return paths;
}
