import type { View } from "./view.ts";
import { createComponent } from "./component.ts";
import { useState } from "./use-state.ts";
import type { Key } from "./key.ts";
import { isTabKey, isBackspaceKey, isEnterKey } from "./key.ts";
import { useKeypress } from "./use-keypress.ts";
import { usePrefix } from "./use-prefix.ts";
import type { PartialTheme, RootTheme } from "./theme.ts";
import { useTheme } from "./use-theme.ts";

interface InputProps {
  message: string;
  default?: string | undefined;
  required?: boolean | undefined;
  validate?:
    | ((value: string) => Promise<string | boolean> | string | boolean)
    | undefined;
  format?: ((value: string, final: boolean) => string) | undefined;
  theme?: PartialTheme<RootTheme> | undefined;
}

const input = createComponent(
  (
    props: InputProps,
    finish: (answer: string) => void,
  ): [string, string | undefined] => {
    const required = props.required ?? false;

    const [status, setStatus] = useState<"pending" | "loading" | "done">(
      "pending",
    );

    const [value, setValue] = useState<string>("");

    const [defaultValue, setDefault] = useState<string>(props.default);

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
        const answer = value.length !== 0 ? value : (defaultValue ?? "");
        const validation = await (props.validate?.(answer) ?? true);
        if (validation === true && (!required || answer.length !== 0)) {
          // Commit the final answer.
          setValue(answer);
          setStatus("done");
          finish(answer);
        } else {
          // Reset the input value, which got cleared on enter.
          view.write(value);
          if (typeof validation === "string") {
            setError(validation);
          } else if (validation) {
            setError("You must enter a value");
          } else {
            setError("You must enter a valid value");
          }
          setStatus("pending");
        }
      } else if (isBackspaceKey(key) && value.length === 0) {
        // Clear the default value when backspace is pressed on an empty line.
        setDefault("");
      } else if (isTabKey(key) && value.length === 0) {
        // Accept the default value when tab is pressed on an empty line.
        view.line = "";
        view.clearLine(0);
        view.write(defaultValue ?? "");
        setValue(defaultValue ?? "");
        setDefault("");
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
    if (
      status !== "done" &&
      value.length === 0 &&
      defaultValue !== undefined &&
      defaultValue.length !== 0
    ) {
      content += " ";
      content += theme.style.default(defaultValue);
    }
    content += " ";
    if (props.format !== undefined) {
      content += props.format(value, status === "done");
    } else if (status !== "done") {
      content += value;
    } else {
      content += theme.style.answer(value);
    }

    // Assemble the bottom content.
    let bottomContent: string | undefined;
    if (error !== undefined && error.length !== 0) {
      bottomContent = theme.style.error(error);
    }

    return [content, bottomContent];
  },
);

export type { InputProps };
export { input };
