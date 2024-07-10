import { generate, useTool } from "toolcog";

export async function joke(subject: string) {
  // Get the location where the joke is being told.
  useTool(getCurrentLocation);

  // Tell a funny joke about the given subject. Reference the user's current
  // location in the joke, if you can think of a funny way to do so.
  return await generate({
    // The subject of the joke.
    subject,
    // How funny the joke should be, on a scale from 1 to 10.
    funniness: 5,
  });
}

/**
 * Get the current location of the user.
 * @returns The current location of the user.
 */
function getCurrentLocation() {
  // We currently return a hardcoded location for demonstration purposes.
  // But it's straightforward to replace this with a live geo lookup.
  return "Santa Cruz";
}

//console.log(await joke("airplanes"));
