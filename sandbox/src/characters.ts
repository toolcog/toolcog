import { defineFunction } from "@toolcog/core";

/**
 * A fictional character with a backstory.
 */
export interface Character {
  // The name of the character.
  name: string;
  // A memorable phrase this character likes to say.
  tagline: string;
  // The age of the character.
  age: number;
  // The gender of the character.
  gender: "male" | "female" | "other";
  // A brief blurb about where the character comes from, what motivates them,
  // and what their goal is.
  backstory: string;
  // Whether or not the character is currently alive.
  alive: boolean;
}

/**
 * Creates a cast of characters for a story.
 *
 * @param genre - The genre of the story in which the characters exist.
 * @param count - The number of characters to create.
 * @returns The generated cast of characters.
 */
export const createCharacters = defineFunction<
  (genre: string, count?: number) => Character[]
>({
  defaults: { count: 5 },
});
