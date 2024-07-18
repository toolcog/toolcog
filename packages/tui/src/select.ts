import { EOL } from "node:os";
import type { View } from "./view.ts";
import { cursorHide } from "@toolcog/util/tty";
import { createComponent } from "./component.ts";
import { useState } from "./use-state.ts";
import { useMemo } from "./use-memo.ts";
import { useRef } from "./use-ref.ts";
import type { Key } from "./key.ts";
import {
  isUpKey,
  isDownKey,
  isBackspaceKey,
  isNumberKey,
  isEnterKey,
} from "./key.ts";
import { useKeypress } from "./use-keypress.ts";
import { usePrefix } from "./use-prefix.ts";
import { usePagination } from "./use-pagination.ts";
import type { PartialTheme, RootTheme } from "./theme.ts";
import { style, makeTheme } from "./theme.ts";
import { useTheme } from "./use-theme.ts";

interface SelectTheme {
  readonly icon: {
    readonly cursor: string;
    readonly disabled: string;
  };
  readonly helpMode: "always" | "never" | "auto";
}

const selectTheme = makeTheme<SelectTheme>({
  icon: {
    cursor: "❯",
    disabled: "-",
  },
  helpMode: "auto",
});

interface SelectOption<T> {
  type?: undefined;
  name?: string | undefined;
  value: T;
  description?: string | undefined;
  disabled?: string | boolean | undefined;
}

interface SelectSeparator {
  type: "separator";
  separator?: string | undefined;
}

type SelectItem<T> = SelectOption<T> | SelectSeparator;

interface SelectProps<T> {
  message: string;
  options: readonly SelectItem<T>[];
  default?: unknown;
  pageSize?: number | undefined;
  loop?: boolean | undefined;
  theme?: PartialTheme<SelectTheme & RootTheme> | undefined;
}

const isSelectable = <T>(item: SelectItem<T>): item is SelectOption<T> => {
  return item.type !== "separator" && !item.disabled;
};

const select = createComponent(
  <T>(props: SelectProps<T>, finish: (value: T) => void): string => {
    const items = props.options;
    const pageSize = props.pageSize ?? 7;
    const loop = props.loop ?? false;

    const [status, setStatus] = useState<"pending" | "done">("pending");

    const bounds = useMemo<{ first: number; last: number }>(() => {
      const first = items.findIndex(isSelectable);
      const last = items.findLastIndex(isSelectable);
      return { first, last };
    }, [items]);
    if (bounds.first < 0) {
      throw new Error("No selectable options");
    }

    const defaultIndex = useMemo<number>(() => {
      if (!("default" in props)) {
        return -1;
      }
      return items.findIndex((item) => {
        return isSelectable(item) && item.value === props.default;
      });
    }, [items, props.default]);

    const [active, setActive] = useState<number>(
      defaultIndex === -1 ? bounds.first : defaultIndex,
    );

    const selected = items[active] as SelectOption<T>;

    const [hasNavigated, setHasNavigated] = useState<boolean>(false);

    const timeoutRef = useRef<NodeJS.Timeout>();

    const theme = useTheme(props.theme, selectTheme);

    const prefix = usePrefix({ theme });

    useKeypress((key: Key, view: View): void => {
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }

      if (isEnterKey(key)) {
        setStatus("done");
        finish(selected.value);
      } else if (isUpKey(key) || isDownKey(key)) {
        view.line = "";
        view.clearLine(0);
        if (
          loop ||
          (isUpKey(key) && active !== bounds.first) ||
          (isDownKey(key) && active !== bounds.last)
        ) {
          const offset = isUpKey(key) ? -1 : 1;
          let next = active;
          do {
            next = (next + offset + items.length) % items.length;
          } while (!isSelectable(items[next]!));
          setActive(next);
          setHasNavigated(true);
        }
      } else if (isNumberKey(key)) {
        view.line = "";
        view.clearLine(0);
        const position = Number(key.name) - 1;
        const item = items[position];
        if (item !== undefined && isSelectable(item)) {
          setActive(position);
          setHasNavigated(true);
        }
      } else if (isBackspaceKey(key)) {
        view.line = "";
        view.clearLine(0);
      } else {
        const searchTerm = view.line.toLowerCase();
        const matchIndex = items.findIndex((item) => {
          return (
            isSelectable(item) &&
            (item.name ?? String(item.value))
              .toLowerCase()
              .startsWith(searchTerm)
          );
        });
        if (matchIndex >= 0) {
          setActive(matchIndex);
          setHasNavigated(true);
        }
        timeoutRef.current = setTimeout(() => {
          view.line = "";
          view.clearLine(0);
        }, 700);
      }
    });

    const page = usePagination<SelectItem<T>>({
      items,
      active,
      pageSize,
      loop,
      renderItem(item: SelectItem<T>, active: boolean): string {
        let line = "";
        if (item.type === "separator") {
          line += " ";
          line += item.separator ?? style.dim("──────────────");
        } else if (
          item.disabled === true ||
          (typeof item.disabled === "string" && item.disabled.length !== 0)
        ) {
          line += theme.icon.disabled;
          line += " ";
          line += item.name ?? item.value;
          line += " ";
          if (typeof item.disabled === "string") {
            line += item.disabled;
          } else {
            line += "(disabled)";
          }
          line = theme.style.disabled(line);
        } else {
          line += active ? theme.icon.cursor : " ";
          line += " ";
          line += item.name ?? item.value;
          if (active) {
            line = theme.style.highlight(line);
          }
        }
        return line;
      },
    });

    // Assemble the main content.
    let content = prefix;
    content += " ";
    content += theme.style.message(props.message);
    if (status !== "done") {
      const showHelp =
        theme.helpMode === "always" ||
        (theme.helpMode === "auto" && !hasNavigated);

      if (showHelp && items.length <= pageSize) {
        content += " ";
        content += theme.style.help("(Use arrow keys to navigate)");
      }
      content += EOL;
      content += page;
      if (selected.description) {
        content += EOL;
        content += selected.description;
      }
      if (showHelp && items.length > pageSize) {
        content += EOL;
        content += theme.style.help("(Use arrow keys to reveal more options)");
      }
      content += cursorHide;
    } else {
      content += " ";
      content += theme.style.answer(selected.name ?? String(selected.value));
    }

    return content;
  },
);

export type {
  SelectTheme,
  SelectOption,
  SelectSeparator,
  SelectItem,
  SelectProps,
};
export { selectTheme, select };
