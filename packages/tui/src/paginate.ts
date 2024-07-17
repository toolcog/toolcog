import { wrapLines } from "@toolcog/util/tty";

interface PaginateOptions<T> {
  items: readonly T[];
  active: number;
  position: number;
  pageSize: number;
  maxWidth: number;
  renderItem: (item: T, active: boolean, index: number) => string;
}

const paginate = <T>(options: PaginateOptions<T>): string[] => {
  const items = options.items;
  const active = options.active;
  const requested = options.position;
  const pageSize = options.pageSize;
  const maxWidth = options.maxWidth;
  const renderItem = options.renderItem;

  const layouts = items.map((item, index) => ({
    item,
    index,
    active: index === active,
  }));

  const offset =
    (active - (requested % layouts.length) + layouts.length) % layouts.length;
  const visibleLayouts = [
    ...layouts.slice(offset),
    ...layouts.slice(0, offset),
  ].slice(0, pageSize);

  const renderItemAt = (index: number): string[] => {
    const layout = visibleLayouts[index]!;
    return wrapLines(
      renderItem(layout.item, layout.active, layout.index),
      maxWidth,
    );
  };

  const pageBuffer = new Array<string | undefined>(pageSize);

  // Render the active item and decide its position.
  const activeItem = renderItemAt(requested).slice(0, pageSize);
  const position =
    requested + activeItem.length <= pageSize ?
      requested
    : pageSize - activeItem.length;

  // Splice the lines of the active item onto the page.
  pageBuffer.splice(position, activeItem.length, ...activeItem);

  // Fill in the lines below the active item.
  let bufferPointer = position + activeItem.length;
  let layoutPointer = requested + 1;
  while (bufferPointer < pageSize && layoutPointer < visibleLayouts.length) {
    for (const line of renderItemAt(layoutPointer)) {
      pageBuffer[bufferPointer] = line;
      bufferPointer += 1;
      if (bufferPointer >= pageSize) {
        break;
      }
    }
    layoutPointer += 1;
  }

  // Fill in the lines above the active item.
  bufferPointer = position - 1;
  layoutPointer = requested - 1;
  while (bufferPointer >= 0 && layoutPointer >= 0) {
    for (const line of renderItemAt(layoutPointer).reverse()) {
      pageBuffer[bufferPointer] = line;
      bufferPointer -= 1;
      if (bufferPointer < 0) {
        break;
      }
    }
    layoutPointer -= 1;
  }

  return pageBuffer.filter((line) => line !== undefined);
};

export type { PaginateOptions };
export { paginate };
