import { defineFunction } from "@toolcog/core";
import type { Character } from "./characters.js";
import { createCharacters } from "./characters.js";

/**
 * A key event that happens in the story.
 */
interface Event {
  // The date in the story on which the event occurs.
  date: string;
  // A description of what occurs during the event.
  description: string;
  // A number from 1 to 10 indicating how important the event is to the story.
  significance: number;
}

/**
 * An outline of a chapter in a story.
 */
interface Chapter {
  // The name of the chapter.
  title: string;
  // The major events that occur in this chapter.
  events: Event[];
}

/**
 * An outline of the plot of a story.
 */
interface Story {
  // The title of the story.
  title: string;
  // A brief description of what the story is about.
  synopsis: string;
  // The case of characters in the story.
  cast: Character[];
  // A quote that appears at the beginning of the story.
  epigraph?: string;
  // An outline of each chapter in the story.
  chapters: Chapter[];
}

/**
 * Write an outline for a story in the given genre.
 *
 * @param genre - The genre of the story.
 */
export const writeStory = defineFunction<(genre: string) => Story>({
  tools: [createCharacters],
});
