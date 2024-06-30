import { generate } from "toolcog";

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
 * @param count the number of characters to create.
 * @param genre the genre of the story in which the characters exist
 */
export async function createCharacters(
  count: number,
  genre: string,
): Promise<Character[]> {
  // Come up with a cast of characters.
  return await generate({
    // The number of characters to create.
    count,
    // The genre of the story in which the characters should fit in.
    genre,
  });
}

//console.log(await createCharacters(5, "fantasy"));
