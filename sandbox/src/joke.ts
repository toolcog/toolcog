import { useTool, implement } from "toolcog";
import { currentLocation } from "./location.js";

useTool(currentLocation);

/**
 * Tell a funny joke about the given subject.
 *
 * @instructions
 * Tell a funny joke about the given subject. Reference the user's current
 * location as part of the joke, if you can think of a funny way to do so.
 *
 * @param subject - The subject of the joke.
 * @param funniness - How funny the joke should be, on a scale from 1 to 10.
 * @param ideas - Some joke ideas to consider for inspiration.
 * @returns The generated joke.
 */
export const joke = implement<
  (subject: string, funniness?: number, ideas?: string[]) => string
>({
  defaults: { funniness: 5 },
});

//console.log(await joke("airplanes"));
