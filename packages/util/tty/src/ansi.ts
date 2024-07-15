// ansi-regex v5.0.1
const ansiRegex =
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

const stripAnsi = (text: string): string => {
  return text.replace(ansiRegex, "");
};

export { ansiRegex, stripAnsi };
