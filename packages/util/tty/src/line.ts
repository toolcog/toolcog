const getLastNonEmptyLine = (string: string): string => {
  // Start at the end of the string.
  let index = string.length - 1;

  // Traverse backwards to find the last non-whitespace character.
  while (index >= 0) {
    switch (string.charCodeAt(index)) {
      case 0x09: // '\t'
      case 0x0a: // '\n'
      case 0x0d: // '\r'
      case 0x20: // ' '
        index -= 1;
        continue;
      default:
        break;
    }
    break;
  }

  // Record the index of the last non-whitespace character.
  const lastIndex = index;

  // Traverse backwards to find the start of the last non-empty line.
  while (index >= 0) {
    switch (string.charCodeAt(index)) {
      case 0x0a: // '\n'
      case 0x0d: // '\r'
        break;
      default:
        index -= 1;
        continue;
    }
    break;
  }

  return string.slice(index + 1, lastIndex + 1);
};

export { getLastNonEmptyLine };
