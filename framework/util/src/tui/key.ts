interface Key {
  name: string;
  ctrl: boolean;
}

const isUpKey = (key: Key): boolean =>
  key.name === "up" || // up arrow key
  key.name === "k" || // vim keybinding
  (key.ctrl && key.name === "p"); // emacs keybinding

const isDownKey = (key: Key): boolean =>
  key.name === "down" || // down arrow key
  key.name === "j" || // vim keybinding
  (key.ctrl && key.name === "n"); // emacs keybinding

const isTabKey = (key: Key): boolean => key.name === "tab";

const isSpaceKey = (key: Key): boolean => key.name === "space";

const isBackspaceKey = (key: Key): boolean => key.name === "backspace";

const isNumberKey = (key: Key): boolean => "123456789".includes(key.name);

const isEnterKey = (key: Key): boolean =>
  key.name === "enter" || key.name === "return";

export type { Key };
export {
  isUpKey,
  isDownKey,
  isTabKey,
  isSpaceKey,
  isBackspaceKey,
  isNumberKey,
  isEnterKey,
};
