import { tooling, generative } from "toolcog";
import { currentLocation } from "./location.js";

const literalToolArray = tooling([
  // Adds two numbers together.
  function add(x: number, y: number) {
    return x + y;
  },
  // Capitalizes a string.
  function capitalize(s: string) {
    return s.toUpperCase();
  },
] as const);

const literalToolObject = tooling({
  // Adds two numbers together.
  add: (x: number, y: number) => x + y,
  // Capitalizes a string.
  capitalize: (s: string) => s.toUpperCase(),
} as const);

const rawToolArrayFunction = () =>
  [
    // Adds two numbers together.
    function add(x: number, y: number) {
      return x + y;
    },
    // Capitalizes a string.
    function capitalize(s: string) {
      return s.toUpperCase();
    },
  ] as const;
const definedToolArray = tooling(rawToolArrayFunction());

const rawToolObjectFunction = () =>
  ({
    // Adds two numbers together.
    add: (x: number, y: number) => x + y,
    // Capitalizes a string.
    capitalize: (s: string) => s.toUpperCase(),
  }) as const;
const definedToolObject = tooling(rawToolObjectFunction());

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
export const joke = generative<
  (subject: string, funniness?: number, ideas?: string[]) => string
>({
  defaults: { funniness: 5 },
  tools: [currentLocation],
});

//console.log(await joke("airplanes"));
