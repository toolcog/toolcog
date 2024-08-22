import { cursorHide } from "@toolcog/util/tty";
import type { View } from "./view.ts";
import { createComponent } from "./component.ts";
import { useState } from "./use-state.ts";
import type { Key } from "./key.ts";
import { isEnterKey } from "./key.ts";
import { useKeypress } from "./use-keypress.ts";
import { usePrefix } from "./use-prefix.ts";
import type { PartialTheme, RootTheme } from "./theme.ts";
import { useTheme } from "./use-theme.ts";

interface PasswordProps {
  message: string;
  mask?: boolean | string | undefined;
  validate?:
    | ((value: string) => Promise<string | boolean> | string | boolean)
    | undefined;
  theme?: PartialTheme<RootTheme> | undefined;
}

const password = createComponent(
  (
    props: PasswordProps,
    finish: (value: string) => void,
  ): [string, string | undefined] => {
    const mask = props.mask ?? true;

    const [status, setStatus] = useState<"pending" | "loading" | "done">(
      "pending",
    );

    const [value, setValue] = useState<string>("");

    const [error, setError] = useState<string>();

    const theme = useTheme(props.theme);

    const prefix = usePrefix({
      loading: status === "loading",
      theme,
    });

    useKeypress(async (key: Key, view: View): Promise<void> => {
      // Ignore key presses while the prompt is busy.
      if (status !== "pending") {
        return;
      }

      if (isEnterKey(key)) {
        setStatus("loading");
        const validation = await (props.validate?.(value) ?? true);
        if (validation === true) {
          // Commit the final answer.
          setValue(value);
          setStatus("done");
          finish(value);
        } else {
          // Reset the input value, which got cleared on enter.
          view.write(value);
          if (typeof validation === "string") {
            setError(validation);
          } else {
            setError("You must enter a valid password");
          }
          setStatus("pending");
        }
      } else {
        // Update the current input value and reset the error message.
        setValue(view.line);
        setError(undefined);
      }
    });

    // Assemble the main content.
    let content = prefix;
    content += " ";
    content += theme.style.message(props.message);
    content += " ";
    if (mask === true || (typeof mask === "string" && mask.length !== 0)) {
      if (value.length !== 0) {
        const maskChar = typeof mask === "string" ? mask : "*";
        const maskText = maskChar.repeat(value.length);
        content += status !== "done" ? maskText : theme.style.answer(maskText);
      }
    } else if (status !== "done") {
      content += theme.style.help("[input is masked]") + cursorHide;
    }

    // Assemble the bottom content.
    let bottomContent: string | undefined;
    if (error !== undefined && error.length !== 0) {
      bottomContent = theme.style.error(error);
    }

    return [content, bottomContent];
  },
);

export type { PasswordProps };
export { password };
