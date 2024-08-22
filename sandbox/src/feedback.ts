import { defineTool } from "@toolcog/core";
import {
  input,
  password,
  confirm,
  select,
  multiselect,
} from "@toolcog/util/tui";

/**
 * Ask the user for input. This tool should be used to ask the user to answer
 * a question, or to ask the user for clarification.
 *
 * @param message - The question to present to the user about what to input.
 * @param placeholder - An optional default answer to provide the user.
 * @returns The input entered by the user.
 */
export const promptInput = defineTool(
  async (message: string, placeholder?: string): Promise<string> => {
    return await input({ message, default: placeholder });
  },
);

/**
 * Ask the user to enter a password.
 *
 * @param message - The question to present to the user about what to enter.
 * @returns The password entered by the user.
 */
export const promptPassword = defineTool(
  async (message: string): Promise<string> => {
    return await password({ message });
  },
);

/**
 * Ask the user for confirmation. This tool should be used to ask the user to
 * answer a yes/no question, or to ask the user for permission.
 *
 * @param message - The question to present to the user about what to confirm.
 * @returns Whether or not the user responded affirmatively.
 */
export const promptConfirm = defineTool(
  async (message: string): Promise<boolean> => {
    return await confirm({ message });
  },
);

/**
 * An option that the user can select.
 */
export interface SelectOption {
  /**
   * An optional display name for this option. If not provided,
   * the `value` property will be used as the display name.
   */
  name?: string;
  /**
   * The value returned when the user selects this option.
   */
  value: string;
  /**
   * An optional description of this option.
   */
  description?: string;
}

/**
 * Ask the user to select a single item from a list of options.
 * This tool should be used to ask the user a multiple choice question.
 *
 * @param message - The question to present to the user about what to select.
 * @param options - A list of options from which the user may select a single item.
 * @returns The `value` property of the option selected by the user.
 */
export const promptSelect = defineTool(
  async (message: string, options: SelectOption[]): Promise<string> => {
    return await select({ message, options });
  },
);

/**
 * An option that the user can select.
 */
export interface MultiselectOption {
  /**
   * An optional display name for this option. If not defined,
   * the `value` property will be used as the display name.
   */
  name?: string;
  /**
   * The value returned when the user selects this option.
   */
  value: string;
  /**
   * An optional description of this option.
   */
  description?: string;
  /**
   * Indicates whether or not this option should be preselected.
   * If not defined, the option will not be preselected.
   */
  selected?: boolean;
}

/**
 * Ask the user to select multiple items from a list of options.
 *
 * @param message - The question to present to the user about what to select.
 * @param options - A list of options from which the user may select multiple items.
 * @returns A list of the `value` properties of all options selected by the user.
 */
export const promptMultiselect = defineTool(
  async (message: string, options: MultiselectOption[]): Promise<string[]> => {
    return await multiselect({ message, options });
  },
);

export const feedbackTools = [
  promptInput,
  promptPassword,
  promptConfirm,
  promptSelect,
  promptMultiselect,
];
