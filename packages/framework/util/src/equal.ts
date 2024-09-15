const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true;
  } else if (typeof a !== typeof b) {
    return false;
  } else if (typeof a !== "object" || a === null || b === null) {
    return false;
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    if (
      !deepEqual(
        (a as Record<PropertyKey, unknown>)[key],
        (b as Record<PropertyKey, unknown>)[key],
      )
    ) {
      return false;
    }
  }
  return true;
};

export { deepEqual };
