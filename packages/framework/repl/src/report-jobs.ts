import { EOL } from "node:os";
import { Marked } from "marked";
import { AsyncContext } from "@toolcog/util/async";
import { throttle } from "@toolcog/util/timer";
import { replaceLines, getLastNonEmptyLine } from "@toolcog/util";
import { getStringWidth, wrapText, ellipsize } from "@toolcog/util/tty";
import type { PartialTheme, RootTheme } from "@toolcog/util/tui";
import {
  update,
  useView,
  createComponent,
  useState,
  useEffect,
  style,
  makeTheme,
  useTheme,
} from "@toolcog/util/tui";
import { Job } from "@toolcog/runtime";
import type { MarkdownTheme } from "./render-markdown.ts";
import {
  markdownTheme,
  markdownTextTheme,
  renderMarkdown,
} from "./render-markdown.ts";
import type { YamlishTheme } from "./render-yamlish.ts";
import { yamlishTheme, renderYamlish } from "./render-yamlish.ts";

interface ReportJobsTheme {
  readonly style: {
    readonly title: (text: string) => string;
    readonly ellipsis: (text: string) => string;
  };
  readonly markdown: MarkdownTheme;
  readonly yamlish: YamlishTheme;
}

const reportJobsTheme = makeTheme<ReportJobsTheme>({
  style: {
    title: style.cyan,
    ellipsis: style.gray,
  },
  markdown: markdownTheme,
  yamlish: yamlishTheme,
});

const reportJobsTextTheme = makeTheme<ReportJobsTheme>({
  style: reportJobsTheme.style,
  markdown: markdownTextTheme,
  yamlish: yamlishTheme,
});

interface ReportJobsProps {
  root: Job;
  theme?: PartialTheme<ReportJobsTheme & RootTheme> | undefined;
  printMarkdown?: boolean | undefined;
  formatOutput?: ((job: Job) => string | undefined) | undefined;
  formatAttributes?:
    | ((job: Job) => Record<string, unknown> | undefined)
    | undefined;
}

const reportJobs = createComponent(
  (props: ReportJobsProps, finish: (value: void) => void): string => {
    const root = props.root;
    const theme = useTheme(
      props.theme,
      props.printMarkdown === true ? reportJobsTheme : reportJobsTextTheme,
    );
    const formatOutput = props.formatOutput;
    const formatAttributes = props.formatAttributes;

    const marked = new Marked({
      gfm: true,
      breaks: false,
      pedantic: false,
    });

    const view = useView();
    const width = view.columns - 1;
    const height = view.rows ?? 10;

    useEffect(() => {
      const onUpdate = throttle(update, 100);

      root.addListener("update", onUpdate);
      root.addListener("finish", onUpdate);
      return () => {
        root.removeListener("update", onUpdate);
        root.removeListener("finish", onUpdate);
      };
    }, [root]);

    const [frame, setFrame] = useState(0);

    useEffect(() => {
      let tick = 0;
      const ticker = setInterval(
        AsyncContext.Snapshot.wrap(() => {
          setFrame(tick % theme.spinner.frames.length);
          tick += 1;
        }),
        theme.spinner.interval,
      );
      return () => {
        clearInterval(ticker);
      };
    }, []);

    let jobs = [...root.descendants()];
    if (!root.finished) {
      jobs = jobs.slice(-height);
    }
    let content = "";

    if (root.finished) {
      const attributes = formatAttributes?.(root);
      if (attributes !== undefined) {
        for (const key in attributes) {
          content += renderYamlish(key, attributes[key], theme.yamlish, width);
          content += EOL;
        }
      }
    }

    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i]!;
      if (i !== 0) {
        content += EOL;
      }
      content += renderJobOutput(
        job,
        theme,
        formatOutput,
        formatAttributes,
        marked,
        width,
        frame,
        root.finished,
      );
    }

    if (root.finished) {
      finish();
    }

    return content;
  },
);

export const renderJobOutput = (
  job: Job,
  theme: ReportJobsTheme & RootTheme,
  formatOutput: ((job: Job) => string | undefined) | undefined,
  formatAttributes:
    | ((job: Job) => Record<string, unknown> | undefined)
    | undefined,
  marked: Marked,
  width: number,
  frame: number,
  final: boolean,
): string => {
  let line = renderJobPrefix(job, theme, frame);

  if (job.title !== undefined) {
    line += " ";
    line += theme.style.title(job.title);
    line += ":";
  }

  if (!final) {
    line += " ";
    if (job.output !== undefined) {
      line += ellipsize(
        getLastNonEmptyLine(job.output),
        width - getStringWidth(line),
        job.ellipsize,
        theme.style.ellipsis("..."),
      );
    } else {
      line += theme.style.ellipsis("...");
    }
  } else if (job.output !== undefined) {
    const attributes = formatAttributes?.(job);
    if (attributes !== undefined) {
      for (const key in attributes) {
        line += EOL;
        line += renderYamlish(
          key,
          attributes[key],
          theme.yamlish,
          width,
          2 * job.depth,
        );
      }
    }

    const output = formatOutput !== undefined ? formatOutput(job) : job.output;
    if (output !== undefined && output.length !== 0) {
      line += EOL;
      if (job.outputType === "markdown") {
        line += renderMarkdown(
          marked.lexer(output),
          theme.markdown,
          width,
          2 * job.depth,
        );
      } else {
        const indent = "  ".repeat(job.depth);
        line += replaceLines(
          wrapText(output, width - indent.length),
          (line) => indent + line,
        );
      }
    }
  }

  return line;
};

const renderJobPrefix = (
  job: Job,
  theme: ReportJobsTheme & RootTheme,
  frame: number,
): string => {
  let prefix = "  ".repeat(job.depth - 1);
  if (job.finished) {
    prefix += theme.style.prefix("✓");
  } else {
    prefix += theme.style.spinner(theme.spinner.frames[frame]!);
  }
  return prefix;
};

export type { ReportJobsTheme, ReportJobsProps };
export { reportJobsTheme, reportJobsTextTheme, reportJobs };
