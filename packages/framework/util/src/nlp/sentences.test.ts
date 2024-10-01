import { it, expect } from "vitest";
import { splitSentences } from "./sentences.ts";

it("should split basic sentences separated by periods", () => {
  const text = "This is the first sentence. This is the second sentence.";
  expect(splitSentences(text)).toEqual([
    "This is the first sentence.",
    "This is the second sentence.",
  ]);
});

it("should correctly split sentences without abbreviations", () => {
  const text =
    "This is a sentence. And here is another one. Yet another sentence!";
  expect(splitSentences(text)).toEqual([
    "This is a sentence.",
    "And here is another one.",
    "Yet another sentence!",
  ]);
});

it("should not split sentences after abbreviations", () => {
  const text =
    "Dr. Smith went to Washington, D.C. He arrived at 3 p.m. It was late.";
  expect(splitSentences(text)).toEqual([
    "Dr. Smith went to Washington, D.C.",
    "He arrived at 3 p.m. It was late.",
  ]);
});

it("should correctly split sentences containing quotes", () => {
  const text = '"Wait... what?" she asked. "Are you sure?"';
  expect(splitSentences(text)).toEqual([
    '"Wait... what?" she asked.',
    '"Are you sure?"',
  ]);
});

it("should not split sentences within quotes", () => {
  const text =
    'He said, "This is a test. Is it working? I hope so." Then he left.';
  expect(splitSentences(text)).toEqual([
    'He said, "This is a test. Is it working? I hope so."',
    "Then he left.",
  ]);
});

it("should correctly split sentences containing parentheses", () => {
  const text = "She smiled (knowing he was right). Then she left.";
  expect(splitSentences(text)).toEqual([
    "She smiled (knowing he was right).",
    "Then she left.",
  ]);
});

it("should correctly split sentences that start with parentheses", () => {
  const text = "He smiled. (It was a sunny day.) She walked away.";
  expect(splitSentences(text)).toEqual([
    "He smiled.",
    "(It was a sunny day.)",
    "She walked away.",
  ]);
});

it("should not split sentences within parentheses", () => {
  const text = "The equation (E = mc^2) is famous. Do you know it?";
  expect(splitSentences(text)).toEqual([
    "The equation (E = mc^2) is famous.",
    "Do you know it?",
  ]);
});

it("should correctly split sentences containing quotes and parentheses", () => {
  const text = '"Hello!" (She waved.) "How are you?"';
  expect(splitSentences(text)).toEqual([
    '"Hello!"',
    "(She waved.)",
    '"How are you?"',
  ]);
});

it("should not split sentences with unmatched quotes or parentheses", () => {
  const text = 'He said, "This is tricky.';
  expect(splitSentences(text)).toEqual(['He said, "This is tricky.']);
});

it("should handle Unicode punctuation and characters", () => {
  const text = "こんにちは。お元気ですか？私は元気です！";
  expect(splitSentences(text)).toEqual([
    "こんにちは。",
    "お元気ですか？",
    "私は元気です！",
  ]);
});

it("should not split sentences when a lowercase letter follows a newline", () => {
  const text = "This is a sentence\nwith a newline in its midst.";
  expect(splitSentences(text)).toEqual([
    "This is a sentence\nwith a newline in its midst.",
  ]);
});

it("should correctly split sentences with multiple sentence-ending punctuation marks", () => {
  const text = "What happened?! Are you okay?? Yes!! I am fine.";
  expect(splitSentences(text)).toEqual([
    "What happened?!",
    "Are you okay??",
    "Yes!!",
    "I am fine.",
  ]);
});

it("should split sentences with unmatched closing punctuation", () => {
  const text = 'She said, "Hello there! Then she left.';
  expect(splitSentences(text)).toEqual([
    'She said, "Hello there! Then she left.',
  ]);
});

it("should split sentences with unmatched closing parentheses", () => {
  const text = "He thought about it (for a long time. Then he decided.";
  expect(splitSentences(text)).toEqual([
    "He thought about it (for a long time. Then he decided.",
  ]);
});

it("should split sentences containing emojis", () => {
  const text = "I am happy 😊 Are you? Yes 😄";
  expect(splitSentences(text)).toEqual(["I am happy 😊 Are you?", "Yes 😄"]);
});

it("should handle sentences containing numbers and periods'", () => {
  const text = "Version 2.0 has been released. Please update.";
  expect(splitSentences(text)).toEqual([
    "Version 2.0 has been released.",
    "Please update.",
  ]);
});

it("should handle sentences with multiple abbreviations", () => {
  const text = "Dr. Smith, Ph.D., arrived at 5 p.m. It was late.";
  expect(splitSentences(text)).toEqual([
    "Dr. Smith, Ph.D., arrived at 5 p.m. It was late.",
  ]);
});

it("should not split sentences with abbreviations followed by lowercase letters", () => {
  const text = "We arrived at 3 p.m. and had dinner.";
  expect(splitSentences(text)).toEqual([
    "We arrived at 3 p.m. and had dinner.",
  ]);
});

it("should handle abbreviations at the ends of sentences", () => {
  const text = "The meeting is at 5 p.m. Please be on time.";
  expect(splitSentences(text)).toEqual([
    "The meeting is at 5 p.m. Please be on time.",
  ]);
});

it("should support custom abbreviations", () => {
  const text = "Mx. Taylor is here. They are ready to see you.";
  expect(
    splitSentences(text, {
      abbreviations: ["Mx."],
    }),
  ).toEqual(["Mx. Taylor is here.", "They are ready to see you."]);
});

it("should split sentences with mixed scripts and punctuation", () => {
  const text =
    "English sentence. 中文句子。Another English sentence! これは日本語の文章です。";
  expect(splitSentences(text)).toEqual([
    "English sentence.",
    "中文句子。",
    "Another English sentence!",
    "これは日本語の文章です。",
  ]);
});

it("should treat text with no sentence-ending punctuation as a single sentence", () => {
  const text = "This is a sentence without an ending";
  expect(splitSentences(text)).toEqual([
    "This is a sentence without an ending",
  ]);
});

it("should correctly handle sentences containing URLs and email addresses", () => {
  const text =
    "Visit us at www.example.com. Send an email to info@example.com. Thank you!";
  expect(splitSentences(text)).toEqual([
    "Visit us at www.example.com.",
    "Send an email to info@example.com.",
    "Thank you!",
  ]);
});

it("should split sentences containing decimal numbers", () => {
  const text = "The price is $3.99. Is that affordable?";
  expect(splitSentences(text)).toEqual([
    "The price is $3.99.",
    "Is that affordable?",
  ]);
});

it("should handle sentences containing ellipses", () => {
  const text = "Well... I am not sure. Are you?";
  expect(splitSentences(text)).toEqual(["Well... I am not sure.", "Are you?"]);
});

it("should handle sentences containing newlines within unmatched quotes", () => {
  const text =
    'He said, "This is a sentence\nthat spans multiple lines\nwithout closing the quote.\nSo it should not split.';
  expect(splitSentences(text)).toEqual([
    'He said, "This is a sentence\nthat spans multiple lines\nwithout closing the quote.\nSo it should not split.',
  ]);
});

it("should handle sentences with multiple unmatched closing punctuation characters", () => {
  const text = "He thought). Then he decided.";
  expect(splitSentences(text)).toEqual(["He thought).", "Then he decided."]);
});

it("should handle text with only whitespace", () => {
  const text = "   \n  \t  ";
  expect(splitSentences(text)).toEqual([]);
});

it("should handle empty string input", () => {
  const text = "";
  expect(splitSentences(text)).toEqual([]);
});

it("should handle sentences that start with mixed case letters", () => {
  const text = "this is a sentence. And this is another one.";
  expect(splitSentences(text)).toEqual([
    "this is a sentence.",
    "And this is another one.",
  ]);
});

it("should handle sentences with special characters", () => {
  const text = "Hello @user! Have you seen #topic? It's trending.";
  expect(splitSentences(text)).toEqual([
    "Hello @user!",
    "Have you seen #topic?",
    "It's trending.",
  ]);
});

it("should handle sentences with full-width punctuation", () => {
  const text = "これは日本語の文章です。「こんにちは！」と彼は言った。";
  expect(splitSentences(text)).toEqual([
    "これは日本語の文章です。",
    "「こんにちは！」",
    "と彼は言った。",
  ]);
});

it("should split sentences ending with punctuation and newlines", () => {
  const text = "First sentence.\nSecond sentence!\n";
  expect(splitSentences(text)).toEqual(["First sentence.", "Second sentence!"]);
});

it("should split sentences after abbreviations at the end of a line", () => {
  const text =
    "Dr.\nSmith went to Washington, D.C.\nHe arrived at 3 p.m.\nIt was late.";
  expect(splitSentences(text)).toEqual([
    "Dr.\nSmith went to Washington, D.C.",
    "He arrived at 3 p.m.\nIt was late.",
  ]);
});

it("should correctly handle sentences with nested quotes", () => {
  const text = `He said, "She replied, 'I heard him shout, "Help!"' and ran away." What do you think?`;
  expect(splitSentences(text)).toEqual([
    `He said, "She replied, 'I heard him shout, "Help!"' and ran away."`,
    "What do you think?",
  ]);
});

it("should correctly handle sentences with multiple punctuation marks", () => {
  const text = "Wait... What?! Are you serious??? Yes!!!";
  expect(splitSentences(text)).toEqual([
    "Wait... What?!",
    "Are you serious???",
    "Yes!!!",
  ]);
});

it("should handle sentences with code snippets and periods", () => {
  const text = "Use the command `npm install`. Then run `npm start`.";
  expect(splitSentences(text)).toEqual([
    "Use the command `npm install`.",
    "Then run `npm start`.",
  ]);
});
