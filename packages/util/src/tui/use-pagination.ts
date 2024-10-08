import { EOL } from "node:os";
import { useView } from "./context.ts";
import { useRef } from "./use-ref.ts";
import { paginate } from "./paginate.ts";

interface UsePaginationOptions<T> {
  items: readonly T[];
  active: number;
  pageSize: number;
  loop?: boolean | undefined;
  renderItem: (item: T, active: boolean, index: number) => string;
}

const usePagination = <T>(options: UsePaginationOptions<T>): string => {
  const items = options.items;
  const active = options.active;
  const pageSize = options.pageSize;
  const loop = options.loop ?? false;
  const renderItem = options.renderItem;

  const view = useView();
  const maxWidth = view.columns - 1;

  const state = useRef({ active: 0, position: 0 });

  let position: number;
  if (loop) {
    if (items.length <= pageSize) {
      position = active;
    } else if (
      state.current.active < active &&
      active - state.current.active < pageSize
    ) {
      position = Math.min(
        Math.floor(pageSize / 2),
        state.current.position + active - state.current.active,
      );
    } else {
      position = state.current.position;
    }
  } else {
    const middle = Math.floor(pageSize / 2);
    if (items.length <= pageSize || active < middle) {
      position = active;
    } else if (active >= items.length - middle) {
      position = active + pageSize - items.length;
    } else {
      position = middle;
    }
  }

  state.current.active = active;
  state.current.position = position;

  return paginate({
    items,
    active,
    position,
    pageSize,
    maxWidth,
    renderItem,
  }).join(EOL);
};

export type { UsePaginationOptions };
export { usePagination };
