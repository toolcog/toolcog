import { stripAnsi } from "./ansi.ts";

const getCharacterWidth = (codePoint: number, character?: string): number => {
  // Handle control characters.
  if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) {
    return 0;
  }

  // Handle zero-width characters.
  if (
    (codePoint >= 0x200b && codePoint <= 0x200f) || // zero-width space, non-joiner, joiner, left-to-right mark, right-to-left mark
    codePoint === 0xfeff // zero-width no-break space
  ) {
    return 0;
  }

  // Handle combining characters.
  if (
    (codePoint >= 0x300 && codePoint <= 0x36f) || // combining diacritical marks
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) || // combining diacritical marks extended
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) || // combining diacritical marks supplement
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) || // combining diacritical marks for symbols
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f) // combining half marks
  ) {
    return 0;
  }

  // Handle unpaired surrogates.
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
    return 0;
  }

  // Handle variation selectors.
  if (codePoint >= 0xfe00 && codePoint <= 0xfe0f) {
    return 0;
  }

  if (
    (codePoint >= 0x00 && codePoint <= 0x1f) || // C0 control codes
    (codePoint >= 0x7f && codePoint <= 0x9f) || // C1 control codes
    (codePoint >= 0x300 && codePoint <= 0x36f) || // Combining diacritical marks
    (codePoint >= 0x200b && codePoint <= 0x200d) || // Zero-width space, zero-width non-joiner, zero-width joiner
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) || // Variation selectors
    (codePoint >= 0xe0100 && codePoint <= 0xe01ef) || // Variation selectors supplement
    (codePoint >= 0x2060 && codePoint <= 0x206f) || // General punctuation
    (codePoint >= 0xfff0 && codePoint <= 0xffff) || // Specials and non-characters
    (codePoint >= 0xd800 && codePoint <= 0xdfff) // Surrogate pairs
  ) {
    return 0;
  }

  // Handle fullwidth forms (get-east-asian-width v1.2.0).
  if (
    codePoint === 0x3000 ||
    (codePoint >= 0xff01 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6)
  ) {
    return 2;
  }

  // Handle wide forms (get-east-asian-width v1.2.0).
  if (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    codePoint === 0x231a ||
    codePoint === 0x231b ||
    codePoint === 0x2329 ||
    codePoint === 0x232a ||
    (codePoint >= 0x23e9 && codePoint <= 0x23ec) ||
    codePoint === 0x23f0 ||
    codePoint === 0x23f3 ||
    codePoint === 0x25fd ||
    codePoint === 0x25fe ||
    codePoint === 0x2614 ||
    codePoint === 0x2615 ||
    (codePoint >= 0x2648 && codePoint <= 0x2653) ||
    codePoint === 0x267f ||
    codePoint === 0x2693 ||
    codePoint === 0x26a1 ||
    codePoint === 0x26aa ||
    codePoint === 0x26ab ||
    codePoint === 0x26bd ||
    codePoint === 0x26be ||
    codePoint === 0x26c4 ||
    codePoint === 0x26c5 ||
    codePoint === 0x26ce ||
    codePoint === 0x26d4 ||
    codePoint === 0x26ea ||
    codePoint === 0x26f2 ||
    codePoint === 0x26f3 ||
    codePoint === 0x26f5 ||
    codePoint === 0x26fa ||
    codePoint === 0x26fd ||
    codePoint === 0x2705 ||
    codePoint === 0x270a ||
    codePoint === 0x270b ||
    codePoint === 0x2728 ||
    codePoint === 0x274c ||
    codePoint === 0x274e ||
    (codePoint >= 0x2753 && codePoint <= 0x2755) ||
    codePoint === 0x2757 ||
    (codePoint >= 0x2795 && codePoint <= 0x2797) ||
    codePoint === 0x27b0 ||
    codePoint === 0x27bf ||
    codePoint === 0x2b1b ||
    codePoint === 0x2b1c ||
    codePoint === 0x2b50 ||
    codePoint === 0x2b55 ||
    (codePoint >= 0x2e80 && codePoint <= 0x2e99) ||
    (codePoint >= 0x2e9b && codePoint <= 0x2ef3) ||
    (codePoint >= 0x2f00 && codePoint <= 0x2fd5) ||
    (codePoint >= 0x2ff0 && codePoint <= 0x2fff) ||
    (codePoint >= 0x3001 && codePoint <= 0x303e) ||
    (codePoint >= 0x3041 && codePoint <= 0x3096) ||
    (codePoint >= 0x3099 && codePoint <= 0x30ff) ||
    (codePoint >= 0x3105 && codePoint <= 0x312f) ||
    (codePoint >= 0x3131 && codePoint <= 0x318e) ||
    (codePoint >= 0x3190 && codePoint <= 0x31e3) ||
    (codePoint >= 0x31ef && codePoint <= 0x321e) ||
    (codePoint >= 0x3220 && codePoint <= 0x3247) ||
    (codePoint >= 0x3250 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x4e00 && codePoint <= 0xa48c) ||
    (codePoint >= 0xa490 && codePoint <= 0xa4c6) ||
    (codePoint >= 0xa960 && codePoint <= 0xa97c) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe52) ||
    (codePoint >= 0xfe54 && codePoint <= 0xfe66) ||
    (codePoint >= 0xfe68 && codePoint <= 0xfe6b) ||
    (codePoint >= 0x16fe0 && codePoint <= 0x16fe4) ||
    codePoint === 0x16ff0 ||
    codePoint === 0x16ff1 ||
    (codePoint >= 0x17000 && codePoint <= 0x187f7) ||
    (codePoint >= 0x18800 && codePoint <= 0x18cd5) ||
    (codePoint >= 0x18d00 && codePoint <= 0x18d08) ||
    (codePoint >= 0x1aff0 && codePoint <= 0x1aff3) ||
    (codePoint >= 0x1aff5 && codePoint <= 0x1affb) ||
    codePoint === 0x1affd ||
    codePoint === 0x1affe ||
    (codePoint >= 0x1b000 && codePoint <= 0x1b122) ||
    codePoint === 0x1b132 ||
    (codePoint >= 0x1b150 && codePoint <= 0x1b152) ||
    codePoint === 0x1b155 ||
    (codePoint >= 0x1b164 && codePoint <= 0x1b167) ||
    (codePoint >= 0x1b170 && codePoint <= 0x1b2fb) ||
    codePoint === 0x1f004 ||
    codePoint === 0x1f0cf ||
    codePoint === 0x1f18e ||
    (codePoint >= 0x1f191 && codePoint <= 0x1f19a) ||
    (codePoint >= 0x1f200 && codePoint <= 0x1f202) ||
    (codePoint >= 0x1f210 && codePoint <= 0x1f23b) ||
    (codePoint >= 0x1f240 && codePoint <= 0x1f248) ||
    codePoint === 0x1f250 ||
    codePoint === 0x1f251 ||
    (codePoint >= 0x1f260 && codePoint <= 0x1f265) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1f320) ||
    (codePoint >= 0x1f32d && codePoint <= 0x1f335) ||
    (codePoint >= 0x1f337 && codePoint <= 0x1f37c) ||
    (codePoint >= 0x1f37e && codePoint <= 0x1f393) ||
    (codePoint >= 0x1f3a0 && codePoint <= 0x1f3ca) ||
    (codePoint >= 0x1f3cf && codePoint <= 0x1f3d3) ||
    (codePoint >= 0x1f3e0 && codePoint <= 0x1f3f0) ||
    codePoint === 0x1f3f4 ||
    (codePoint >= 0x1f3f8 && codePoint <= 0x1f43e) ||
    codePoint === 0x1f440 ||
    (codePoint >= 0x1f442 && codePoint <= 0x1f4fc) ||
    (codePoint >= 0x1f4ff && codePoint <= 0x1f53d) ||
    (codePoint >= 0x1f54b && codePoint <= 0x1f54e) ||
    (codePoint >= 0x1f550 && codePoint <= 0x1f567) ||
    codePoint === 0x1f57a ||
    codePoint === 0x1f595 ||
    codePoint === 0x1f596 ||
    codePoint === 0x1f5a4 ||
    (codePoint >= 0x1f5fb && codePoint <= 0x1f64f) ||
    (codePoint >= 0x1f680 && codePoint <= 0x1f6c5) ||
    codePoint === 0x1f6cc ||
    (codePoint >= 0x1f6d0 && codePoint <= 0x1f6d2) ||
    (codePoint >= 0x1f6d5 && codePoint <= 0x1f6d7) ||
    (codePoint >= 0x1f6dc && codePoint <= 0x1f6df) ||
    codePoint === 0x1f6eb ||
    codePoint === 0x1f6ec ||
    (codePoint >= 0x1f6f4 && codePoint <= 0x1f6fc) ||
    (codePoint >= 0x1f7e0 && codePoint <= 0x1f7eb) ||
    codePoint === 0x1f7f0 ||
    (codePoint >= 0x1f90c && codePoint <= 0x1f93a) ||
    (codePoint >= 0x1f93c && codePoint <= 0x1f945) ||
    (codePoint >= 0x1f947 && codePoint <= 0x1f9ff) ||
    (codePoint >= 0x1fa70 && codePoint <= 0x1fa7c) ||
    (codePoint >= 0x1fa80 && codePoint <= 0x1fa88) ||
    (codePoint >= 0x1fa90 && codePoint <= 0x1fabd) ||
    (codePoint >= 0x1fabf && codePoint <= 0x1fac5) ||
    (codePoint >= 0x1face && codePoint <= 0x1fadb) ||
    (codePoint >= 0x1fae0 && codePoint <= 0x1fae8) ||
    (codePoint >= 0x1faf0 && codePoint <= 0x1faf8) ||
    (codePoint >= 0x20000 && codePoint <= 0x2fffd) ||
    (codePoint >= 0x30000 && codePoint <= 0x3fffd)
  ) {
    return 2;
  }

  if (character === undefined) {
    character = String.fromCodePoint(codePoint);
  }

  // Handle default ignorable code points.
  if (/^\p{Default_Ignorable_Code_Point}$/u.test(character)) {
    return 0;
  }

  // Handle emoji code points.
  if (/\p{RGI_Emoji}/v.test(character)) {
    return 2;
  }

  return 1;
};

const getStringWidth = (() => {
  let segmenter: Intl.Segmenter | null = null;

  return (text: string): number => {
    if (text.length === 0) {
      return 0;
    }

    // Strip ansi escape sequences.
    text = stripAnsi(text);
    if (text.length === 0) {
      return 0;
    }

    // Lazily initialize the segmenter.
    if (segmenter === null) {
      segmenter = new Intl.Segmenter();
    }

    let width = 0;
    for (const { segment } of segmenter.segment(text)) {
      width += getCharacterWidth(segment.codePointAt(0)!, segment);
    }
    return width;
  };
})();

export { getCharacterWidth, getStringWidth };
