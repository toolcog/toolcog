import { defineTool, defineIndex } from "@toolcog/core";

/**
 * An individual item on a to-do list.
 */
export interface TodoItem {
  /**
   * A unique identifier for this item in its list.
   */
  id: number;
  /**
   * A description of the thing to be done.
   */
  text: string;
  /**
   * Whether or not the item has been completed.
   */
  done: boolean;
}

/**
 * A named list of things to-do.
 */
export interface TodoList {
  /**
   * The name of the to-do list.
   */
  name: string;
  /**
   * The highest ID assigned to any list item.
   */
  maxId: number;
  /**
   * The list of things to-do.
   */
  items: TodoItem[];
}

const lists: TodoList[] = [
  {
    name: "Groceries",
    maxId: 1,
    items: [
      { id: 0, text: "Apples", done: true },
      { id: 1, text: "Oranges", done: false },
    ],
  },
];

/**
 * Get the names of all of the user's existing to-do lists.
 *
 * @idiom Get the names of my to-do lists.
 * @returns An array of to-do list names.
 */
export const getTodoLists = defineTool((): string[] => {
  return lists.map((list) => list.name);
});

/**
 * Create a new to-do list.
 *
 * @idiom Create a new to-do list.
 * @param listName - The name of the list to create.
 */
export const createTodoList = defineTool((listName: string): void => {
  let list = lists.find((list) => list.name === listName);
  if (list === undefined) {
    list = { name: listName, maxId: 0, items: [] };
    lists.push(list);
  }
});

/**
 * Delete an existing to-do list.
 *
 * @idiom Delete a to-do list.
 * @param listName - The name of the list to delete.
 */
export const deleteTodoList = defineTool((listName: string): void => {
  const index = lists.findIndex((list) => list.name === listName);
  if (index >= 0) {
    lists.splice(index, 1);
  }
});

/**
 * Get the current state of the items on a particular to-do list.
 * The names of all existing lists can be retrieved by calling the
 * `getTodoLists` function.
 *
 * @idiom Get the items on my to-do list.
 * @param listName - The name of the to-do list whose items should be returned.
 * @returns The items on the to-do list with the given `listName`,
 * or `null` if no list with the given `listName` could be found.
 */
export const getTodos = defineTool((listName: string): TodoItem[] | null => {
  return lists.find((list) => list.name === listName)?.items ?? null;
});

/**
 * Add a new unchecked item to an existing to-do list. If a new item isn't
 * a good fit for any of the user's existing to-do lists, first create a new,
 * more appropriate list by calling `createTodoList`, and then add the item
 * to that new list.
 *
 * @idiom Add an item to my to-do list.
 * @param listName - The name of the list to which the item should be added.
 * Must be the name of an existing to-do list, as returned by `getTodoLists`.
 * @param item - The text of the item to add to the list.
 */
export const createTodo = defineTool((listName: string, item: string): void => {
  const list = lists.find((list) => list.name === listName);
  if (list !== undefined) {
    list.items.push({ id: list.maxId, text: item, done: false });
    list.maxId += 1;
  }
});

/**
 * Update an existing item on a to-do list.
 *
 * @idiom Update my to-do list.
 * @idiom I'm done.
 * @idiom I finished.
 * @param listName - The name of the to-do list that contains the item to update.
 * @param itemId - The id of the item to update.
 * @param text - The updated text of the to-do item.
 * @param done - Whether or not the item should be marked as done.
 */
export const updateTodo = defineTool(
  (listName: string, itemId: number, text: string, done: boolean): void => {
    const list = lists.find((list) => list.name === listName);
    const item = list?.items.find((item) => item.id === itemId);
    if (item !== undefined) {
      item.text = text;
      item.done = done;
    }
  },
);

/**
 * Remove an existing item from a to-do list.
 *
 * @idiom Remove an item from my to-do list.
 * @param listName - The name of the to-do list from which to remove an item.
 * @param itemId - The id of the item to remove.
 */
export const deleteTodo = defineTool(
  (listName: string, itemId: number): void => {
    const list = lists.find((list) => list.name === listName);
    const index = list?.items.findIndex((item) => item.id === itemId);
    if (index !== undefined && index >= 0) {
      list!.items.splice(index, 1);
    }
  },
);

export const todoTools = [
  getTodoLists,
  createTodoList,
  deleteTodoList,
  getTodos,
  createTodo,
  updateTodo,
  deleteTodo,
] as const;

export const todoToolSelector = defineIndex(
  [
    getTodoLists,
    createTodoList,
    deleteTodoList,
    getTodos,
    createTodo,
    updateTodo,
    deleteTodo,
  ] as const,
  { limit: 5 },
);
