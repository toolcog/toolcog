import { useTool, generate } from "toolcog";
import { currentLocation } from "./location.js";

export async function joke(subject: string) {
  useTool(currentLocation);

  // Tell a funny joke about the given subject. Reference the user's current
  // location in the joke, if you can think of a funny way to do so.
  return await generate({
    // The subject of the joke.
    subject,
    // How funny the joke should be, on a scale from 1 to 10.
    funniness: 5,
  });
}

//console.log(await joke("airplanes"));
