import { defineTool } from "@toolcog/core";

/**
 * Get information about the user's current location.
 */
export const currentLocation = defineTool(
  async (): Promise<{
    // The name of the user's current city.
    city?: string;
    // The name of the user's current state or region.
    region?: string;
    // The name of the user's current country.
    country_name: string;
    // The user's current zip code or postal code.
    postal: string;
    // The approximate latitude of the user's current location.
    latitude: number;
    // The approximate longitude of the user's current location.
    longitude: number;
    // The name of the user's current time zone.
    timezone: string;
    // The offset from UTC time of the user's current time zone.
    utc_offset: string;
    // The currency used at the user's current location.
    currency_name: string;
  }> => {
    const response = await fetch("https://ipapi.co/json");
    return await response.json();
  },
);
