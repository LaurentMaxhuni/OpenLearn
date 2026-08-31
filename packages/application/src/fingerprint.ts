const stableSerialize = (
  value: unknown,
  ancestors: Set<object> = new Set(),
): string => {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'undefined') {
    return 'undefined';
  }
  if (typeof value === 'bigint') {
    return `bigint:${value.toString()}`;
  }
  if (typeof value === 'function' || typeof value === 'symbol') {
    return `[${typeof value}]`;
  }
  if (typeof value !== 'object') {
    return `[${typeof value}]`;
  }

  if (ancestors.has(value)) {
    throw new TypeError('Cannot fingerprint a cyclic value.');
  }
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);

  if (Array.isArray(value)) {
    return `[${value
      .map((entry) => stableSerialize(entry, nextAncestors))
      .join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableSerialize(record[key], nextAncestors)}`,
    )
    .join(',')}}`;
};

const hash = (value: string, seed: number): number => {
  let result = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

export const requestFingerprint = (value: unknown): string => {
  const serialized = stableSerialize(value);
  return `v1-${hash(serialized, 2166136261).toString(16).padStart(8, '0')}-${hash(
    serialized,
    2246822519,
  )
    .toString(16)
    .padStart(8, '0')}`;
};
