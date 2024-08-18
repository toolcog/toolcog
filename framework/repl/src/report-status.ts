import { EOL } from "node:os";
import { throttle } from "@toolcog/util/timer";
import { getLastNonEmptyLine } from "@toolcog/util";
import { getStringWidth, ellipsize } from "@toolcog/util/tty";
import { Job } from "@toolcog/runtime";
import type { PartialTheme, RootTheme } from "@toolcog/tui";
import {
  update,
  useView,
  createComponent,
  useEffect,
  style,
  makeTheme,
  useTheme,
} from "@toolcog/tui";

interface StatusTheme {
  readonly style: {
    readonly title: (text: string) => string;
  };
}

const statusTheme = makeTheme<StatusTheme>({
  style: {
    title: style.cyan,
  },
});

interface StatusProps {
  root: Job;
  theme?: PartialTheme<StatusTheme & RootTheme> | undefined;
}

const reportStatus = createComponent(
  (props: StatusProps, finish: (value: void) => void): string => {
    const root = props.root;

    const theme = useTheme(props.theme, statusTheme);

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

    let content = "";
    let jobCount = 0;
    for (const job of root.descendants()) {
      if (jobCount !== 0) {
        content += EOL;
      }
      content += renderJobStatus(job, theme, maxWidth);
      jobCount += 1;
    }

    if (root.finished) {
      finish();
    }

    return content;
  },
);

export const renderJobStatus = (
  job: Job,
  theme: StatusTheme & RootTheme,
  maxWidth: number,
): string => {
  let line = theme.style.prefix(renderJobPrefix(job));

  if (job.title !== undefined) {
    line += " ";
    line += theme.style.title(job.title);
  }

  if (job.status !== undefined) {
    if (job.title !== undefined) {
      line += ":";
    }
    line += " ";
    line += ellipsize(
      getLastNonEmptyLine(job.status),
      maxWidth - getStringWidth(line),
      job.ellipsize,
    );
  }

  return line;
};

const renderJobPrefix = (job: Job): string => {
  let prefix = "";
  if (job.parent !== null) {
    prefix = renderJobRoots(job.parent, prefix);
  }
  prefix += job.nextSibling !== null ? "├─" : "└─";
  prefix += job.icon ?? "─";
  prefix += "─";
  return prefix;
};

const renderJobRoots = (job: Job, line: string): string => {
  if (job.parent !== null) {
    line = renderJobRoots(job.parent, line);
    if (job.nextSibling !== null) {
      line += "│ ";
    } else {
      line += "  ";
    }
  }
  return line;
};

export type { StatusTheme, StatusProps };
export { statusTheme, reportStatus };
