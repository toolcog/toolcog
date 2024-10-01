import type { View } from "./view.ts";
import { createComponent } from "./component.ts";
import { useState } from "./use-state.ts";
import type { Key } from "./key.ts";
import { isEnterKey } from "./key.ts";
import { useKeypress } from "./use-keypress.ts";
import { usePrefix } from "./use-prefix.ts";
import type { PartialTheme, RootTheme } from "./theme.ts";
import { useTheme } from "./use-theme.ts";

interface ConfirmProps {
  message: string;
  default?: boolean | undefined;
  format?: ((value: boolean, final: boolean) => string) | undefined;
  theme?: PartialTheme<RootTheme> | undefined;
}

const confirm = createComponent(
  (props: ConfirmProps, finish: (value: boolean) => void): string => {
    const [status, setStatus] = useState<"pending" | "done">("pending");

    const [value, setValue] = useState<string>("");

    const theme = useTheme(props.theme);

    const prefix = usePrefix({ theme });

    useKeypress((key: Key, view: View): void => {
      if (isEnterKey(key)) {
        let answer: boolean;
        if (/^(y|yes)/i.test(value)) {
          answer = true;
        } else if (/^(n|no)/i.test(value)) {
          answer = false;
        } else {
          answer = props.default ?? true;
        }

        if (props.format !== undefined) {
          setValue(props.format(answer, status === "done"));
        } else {
          setValue(answer ? "yes" : "no");
        }
        setStatus("done");
        finish(answer);
      } else {
        setValue(view.line);
      }
    });

    // Assemble the main content.
    let content = prefix;
    content += " ";
    content += theme.style.message(props.message);
    if (status !== "done") {
      content += " ";
      content += theme.style.default(props.default === false ? "y/N" : "Y/n");
    }
    content += " ";
    if (status !== "done") {
      content += value;
    } else {
      content += theme.style.answer(value);
    }
    return content;
  },
);

export type { ConfirmProps };
export { confirm };
