import { EOL } from "node:os";
import { AsyncContext } from "@toolcog/util/async";
import { throttle } from "@toolcog/util/timer";
import { replaceLines, getLastNonEmptyLine } from "@toolcog/util";
import { getStringWidth, wrapText, ellipsize } from "@toolcog/util/tty";
import { Job } from "@toolcog/runtime";
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

interface JobsTheme {
  readonly style: {
    readonly title: (text: string) => string;
    readonly ellipsis: (text: string) => string;
  };
}

const jobsTheme = makeTheme<JobsTheme>({
  style: {
    title: style.cyan,
    ellipsis: style.gray,
  },
});

interface JobsProps {
  root: Job;
  theme?: PartialTheme<JobsTheme & RootTheme> | undefined;
}

const reportJobs = createComponent(
  (props: JobsProps, finish: (value: void) => void): string => {
    const root = props.root;

    const theme = useTheme(props.theme, jobsTheme);

    const view = useView();
    const maxWidth = view.columns - 1;

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

    let content = "";
    let jobCount = 0;
    for (const job of root.descendants()) {
      if (jobCount !== 0) {
        content += EOL;
      }
      content += renderJobOutput(job, theme, maxWidth, frame, root.finished);
      jobCount += 1;
    }

    if (root.finished) {
      finish();
    }

    return content;
  },
);

export const renderJobOutput = (
  job: Job,
  theme: JobsTheme & RootTheme,
  maxWidth: number,
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
        maxWidth - getStringWidth(line),
        job.ellipsize,
        theme.style.ellipsis("..."),
      );
    } else {
      line += theme.style.ellipsis("...");
    }
  } else if (job.output !== undefined) {
    const indent = "  ".repeat(job.depth);
    line += EOL;
    line += replaceLines(
      wrapText(job.output, maxWidth - indent.length),
      (line) => indent + line,
    );
  }

  return line;
};

const renderJobPrefix = (
  job: Job,
  theme: JobsTheme & RootTheme,
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

export type { JobsTheme, JobsProps };
export { jobsTheme, reportJobs };
