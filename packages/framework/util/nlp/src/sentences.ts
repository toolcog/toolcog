interface SplitSentencesOptions {
  abbreviations?: readonly string[] | undefined;
}

const splitSentences = (
  text: string,
  options?: SplitSentencesOptions,
): string[] => {
  text = text.trim();
  if (text.length === 0) {
    return [];
  }

  const abbreviationsRegex =
    options?.abbreviations !== undefined ?
      buildAbbreviationsRegex(options.abbreviations)
    : defaultAbbreviationsRegex;

  const sentences: string[] = [];
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = sentenceEndRegex.exec(text)) !== null) {
    const endIndex = match.index + match[0].length;
    const punctuation = match[1] ?? match[2]!;
    const segment = text.slice(lastIndex, endIndex).trim();

    const quoteStack: string[] = [];
    const parenStack: string[] = [];

    for (const char of segment) {
      if (char === '"' || char === "'") {
        if (quoteStack[quoteStack.length - 1] === char) {
          quoteStack.pop();
        } else {
          quoteStack.push(char);
        }
      } else if (char in openQuotes) {
        quoteStack.push(char);
      } else if (char in closeQuotes) {
        if (quoteStack[quoteStack.length - 1] === closeQuotes[char]!) {
          quoteStack.pop();
        }
      } else if (char in openParens) {
        parenStack.push(char);
      } else if (char in closeParens) {
        if (parenStack[parenStack.length - 1] === closeParens[char]!) {
          parenStack.pop();
        }
      }
    }

    if (abbreviationsRegex.test(segment)) {
      // Don't split after abbreviations.
      continue;
    }

    if (quoteStack.length !== 0 || parenStack.length !== 0) {
      // Don't split inside quotes or parentheses.
      continue;
    }

    if (
      match[1] !== undefined &&
      /^[\s\u00A0]*([a-z])/u.exec(text.slice(endIndex)) !== null
    ) {
      // Don't split if a lowercase letter follows half-width punctuation.
      continue;
    }

    // Add the sentence.
    sentences.push(
      text.slice(lastIndex, match.index + punctuation.length).trim(),
    );
    lastIndex = endIndex;
  }

  // Add any remaining text as the last sentence.
  if (lastIndex < text.length) {
    const lastSentence = text.slice(lastIndex).trim();
    if (/\S/u.test(lastSentence)) {
      sentences.push(lastSentence);
    }
  }

  return sentences.filter((sentence) => /\S/u.test(sentence));
};

const buildAbbreviationsRegex = (abbreviations: readonly string[]): RegExp => {
  return new RegExp(`(?:${abbreviations.join("|")})$`, "iu");
};

const defaultAbbreviations: readonly string[] = [
  "Mr.",
  "Mrs.",
  "Ms.",
  "Dr.",
  "Prof.",
  "Sr.",
  "Jr.",
  "St.",
  "vs.",
  "etc.",
  "i.e.",
  "e.g.",
  "Fig.",
  "Inc.",
  "Ltd.",
  "Co.",
  "Corp.",
  "Jan.",
  "Feb.",
  "Mar.",
  "Apr.",
  "Jun.",
  "Jul.",
  "Aug.",
  "Sep.",
  "Sept.",
  "Oct.",
  "Nov.",
  "Dec.",
  "U.S.",
  "U.K.",
  "Ph.D.",
  "M.D.",
  "a.m.",
  "p.m.",
  "No.",
  "Mt.",
  "ft.",
  "in.",
  "Ave.",
  "Blvd.",
  "Rd.",
  "Bros.",
];

const defaultAbbreviationsRegex = buildAbbreviationsRegex(defaultAbbreviations);

// Regular expression to match sentence-ending punctuation. Captures sequences
// of sentence-ending punctuation marks (e.g., ".", "!", "?"), possibly
// followed by closing punctuation characters like quotes or parentheses.
//
// For half-width punctuation marks (".", "!", "?"):
// - Matches one or more punctuation marks, followed by optional closing characters.
// - Ensures that the punctuation is followed by whitespace, an opening
//   quote/parenthesis, or the end of the string. This helps prevent splitting
//   within abbreviations or decimal numbers.
//
// For full-width punctuation marks ("。", "！", "？"):
// - Matches one or more punctuation marks, followed by optional closing characters.
// - Does not require any specific character to follow. This accommodates
//   languages like Japanese, where sentences may not have spaces between them.
const sentenceEndRegex =
  /((?<!\.)(?:[.!?](?!\.))+['"”’»」』)\]}]*(?=\s|["'"“‘«「『([{\u2018-\u201F]|$))|([。！？]['"”’»」』)\]}]*)/gu;

const openQuotes: { readonly [open: string]: string } = {
  '"': '"',
  "'": "'",
  "“": "”",
  "‘": "’",
  "«": "»",
  "「": "」",
  "『": "』",
};

const closeQuotes: { readonly [close: string]: string } = {
  '"': '"',
  "'": "'",
  "”": "“",
  "’": "‘",
  "»": "«",
  "」": "「",
  "』": "『",
};

const openParens: { readonly [open: string]: string } = {
  "(": ")",
  "[": "]",
  "{": "}",
  "（": "）",
  "【": "】",
  "「": "」",
  "『": "』",
};

const closeParens: { readonly [close: string]: string } = {
  ")": "(",
  "]": "[",
  "}": "{",
  "）": "（",
  "】": "【",
  "」": "「",
  "』": "『",
};

export type { SplitSentencesOptions };
export { splitSentences };
