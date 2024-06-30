import { useTool } from "toolcog";

/**
 * Gets the current weather at the given location.
 *
 * @param location the location for which to check the weather
 * @returns the current weather at the given location
 */
function getCurrentWeather(location: string) {
  return "sunny";
}

export const currentWeatherTool = useTool(getCurrentWeather);
