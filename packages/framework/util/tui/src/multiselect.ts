import { EOL } from "node:os";
import { cursorHide } from "@toolcog/util/tty";
import { createComponent } from "./component.ts";
import { useState } from "./use-state.ts";
import { useMemo } from "./use-memo.ts";
import type { Key } from "./key.ts";
import {
  isUpKey,
  isDownKey,
  isSpaceKey,
  isNumberKey,
  isEnterKey,
} from "./key.ts";
import { useKeypress } from "./use-keypress.ts";
import { usePrefix } from "./use-prefix.ts";
import { usePagination } from "./use-pagination.ts";
import type { PartialTheme, RootTheme } from "./theme.ts";
import { style, makeTheme } from "./theme.ts";
import { useTheme } from "./use-theme.ts";

interface MultiselectTheme {
  readonly icon: {
    readonly cursor: string;
    readonly selected: string;
    readonly unselected: string;
    readonly disabled: string;
  };
  readonly helpMode: "always" | "never" | "auto";
}

const multiselectTheme = makeTheme<MultiselectTheme>({
  icon: {
    cursor: "❯",
    selected: "◉",
    unselected: "◯",
    disabled: "-",
  },
  helpMode: "auto",
});

interface MultiselectOption<T> {
  type?: undefined;
  name?: string | undefined;
  value: T;
  disabled?: boolean | string | undefined;
  selected?: boolean | undefined;
}

interface MultiselectSeparator {
  type: "separator";
  separator?: string | undefined;
}

type MultiselectItem<T> = MultiselectOption<T> | MultiselectSeparator;

interface MultiselectProps<T> {
  message: string;
  options: readonly MultiselectItem<T>[];
  required?: boolean | undefined;
  instructions?: string | boolean | undefined;
  pageSize?: number | undefined;
  loop?: boolean | undefined;
  validate?:
    | ((
        validate: readonly MultiselectOption<T>[],
      ) => Promise<string | boolean> | string | boolean)
    | undefined;
  format?:
    | ((
        selection: readonly MultiselectOption<T>[],
        items: readonly MultiselectItem<T>[],
      ) => string)
    | undefined;
  theme?: PartialTheme<MultiselectTheme & RootTheme> | undefined;
}

const isSelectable = <T>(
  item: MultiselectItem<T>,
): item is MultiselectOption<T> => {
  return item.type !== "separator" && !item.disabled;
};

const isSelected = <T>(
  item: MultiselectItem<T>,
): item is MultiselectOption<T> => {
  return isSelectable(item) && item.selected === true;
};

const toggle = <T>(item: MultiselectItem<T>): MultiselectItem<T> => {
  return isSelectable(item) ? { ...item, selected: !item.selected } : item;
};

const multiselect = createComponent(
  <T>(props: MultiselectProps<T>, finish: (value: T[]) => void): string => {
    const required = props.required ?? false;
    const instructions = props.instructions ?? true;
    const pageSize = props.pageSize ?? 7;
    const loop = props.loop ?? false;

    const [status, setStatus] = useState<"pending" | "loading" | "done">(
      "pending",
    );

    const [items, setItems] = useState<readonly MultiselectItem<T>[]>(() =>
      props.options.map((item) => ({ ...item })),
    );

    const bounds = useMemo<{ first: number; last: number }>(() => {
      const first = items.findIndex(isSelectable);
      const last = items.findLastIndex(isSelectable);
      return { first, last };
    }, [items]);
    if (bounds.first < 0) {
      throw new Error("No selectable options");
    }

    const [active, setActive] = useState<number>(bounds.first);

    const [error, setError] = useState<string>();

    const [hasNavigated, setHasNavigated] = useState<boolean>(false);

    const [selectionMade, setSelectionMade] = useState<boolean>(false);

    const theme = useTheme(props.theme, multiselectTheme);

    const prefix = usePrefix({ theme });

    useKeypress(async (key: Key): Promise<void> => {
      if (isEnterKey(key)) {
        setStatus("loading");
        const selection = items.filter(isSelected);
        const validation = await (props.validate?.(selection) ?? true);
        if (validation === true && (!required || selection.length !== 0)) {
          // Commit the selection.
          setStatus("done");
          finish(selection.map((option) => option.value));
        } else {
          if (typeof validation === "string") {
            setError(validation);
          } else if (validation) {
            setError("You must make a selection");
          } else {
            setError("You must make a valid selection");
          }
          setStatus("pending");
        }
      } else if (isUpKey(key) || isDownKey(key)) {
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
      } else if (isSpaceKey(key)) {
        setItems(items.map((item, i) => (i === active ? toggle(item) : item)));
        setSelectionMade(true);
        setError(undefined);
      } else if (key.name === "a") {
        const selectAll = items.some(
          (item) => isSelectable(item) && !item.selected,
        );
        setItems(
          items.map((item) =>
            isSelectable(item) ? { ...item, selected: selectAll } : item,
          ),
        );
      } else if (key.name === "i") {
        setItems(items.map(toggle));
      } else if (isNumberKey(key)) {
        const position = Number(key.name) - 1;
        const item = items[position];
        if (item !== undefined && isSelectable(item)) {
          setItems(
            items.map((item, i) => (i === position ? toggle(item) : item)),
          );
          setActive(position);
          setHasNavigated(true);
        }
      }
    });

    const page = usePagination<MultiselectItem<T>>({
      items,
      active,
      pageSize,
      loop,
      renderItem(item: MultiselectItem<T>, active: boolean): string {
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
          line += item.selected ? theme.icon.selected : theme.icon.unselected;
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
      if (
        theme.helpMode === "always" ||
        (theme.helpMode === "auto" && !selectionMade)
      ) {
        if (typeof instructions === "string" && instructions.length !== 0) {
          content += instructions;
        } else if (instructions === true) {
          content += " ";
          content += theme.style.help(
            "(" +
              theme.style.key("space") +
              " to select, " +
              theme.style.key("enter") +
              " to proceed)",
          );
        }
      }
      content += EOL;
      content += page;
      if (
        theme.helpMode === "always" ||
        (theme.helpMode === "auto" && !hasNavigated && items.length > pageSize)
      ) {
        content += EOL;
        content += theme.style.help("(Use arrow keys to reveal more options)");
      }
      if (error !== undefined && error.length !== 0) {
        content += EOL;
        content += theme.style.error(error);
      }
      content += cursorHide;
    } else {
      const selection = items.filter(isSelected);
      content += " ";
      if (props.format !== undefined) {
        content += props.format(selection, items);
      } else {
        content += selection
          .map((option) =>
            theme.style.answer(option.name ?? String(option.value)),
          )
          .join(", ");
      }
    }

    return content;
  },
);

export type {
  MultiselectTheme,
  MultiselectOption,
  MultiselectSeparator,
  MultiselectItem,
  MultiselectProps,
};
export { multiselectTheme, multiselect };
