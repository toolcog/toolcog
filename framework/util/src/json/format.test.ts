import { expect, it } from "vitest";
import { formatJson } from "./format.ts";

it("should format void values with descriptive schemas", () => {
  const value = undefined;
  const schema = {
    type: "void",
    description: "Does not exist.",
  } as const;

  expect(formatJson(value, schema)).toEqual(
    "// Does not exist.\n" + "undefined",
  );
});

it("should format undefined values with descriptive schemas", () => {
  const value = undefined;
  const schema = {
    type: "undefined",
    description: "Not a defined value.",
  } as const;

  expect(formatJson(value, schema)).toEqual(
    "// Not a defined value.\n" + "undefined",
  );
});

it("should format null values with descriptive schemas", () => {
  const value = null;
  const schema = {
    type: "null",
    description: "Not a real value.",
  } as const;

  expect(formatJson(value, schema)).toEqual("// Not a real value.\n" + "null");
});

it("should format boolean values with descriptive schemas", () => {
  const value = true;
  const schema = {
    type: "boolean",
    description: "Maybe, maybe not.",
  } as const;

  expect(formatJson(value, schema)).toEqual("// Maybe, maybe not.\n" + "true");
});

it("should format number values with descriptive schemas", () => {
  const value = 3.14;
  const schema = {
    type: "number",
    description: "The ratio of a circle's circumference to its diameter.",
  } as const;

  expect(formatJson(value, schema)).toEqual(
    "// The ratio of a circle's circumference to its diameter.\n" + "3.14",
  );
});

it("should format string values with descriptive schemas", () => {
  const value = "Hello, world!";
  const schema = {
    type: "string",
    description: "A pleasant greeting.",
  } as const;

  expect(formatJson(value, schema)).toEqual(
    "// A pleasant greeting.\n" + '"Hello, world!"',
  );
});

it("should format empty arrays with descriptive schemas", () => {
  const value = [] as const;
  const schema = {
    type: "array",
    description: "An empty container.",
  } as const;

  expect(formatJson(value, schema)).toEqual("// An empty container.\n" + "[]");
});

it("should format arrays with nondescript item schemas", () => {
  const value = [1, 2, 3] as const;
  const schema = {
    type: "array",
    description: "The cardinal numbers.",
    items: {
      type: "integer",
    },
  } as const;

  expect(formatJson(value, schema)).toEqual(
    "// The cardinal numbers.\n" + "[\n" + "  1,\n" + "  2,\n" + "  3,\n" + "]",
  );
});

it("should format arrays with descriptive item schemas", () => {
  const value = [1, 2, 3] as const;
  const schema = {
    type: "array",
    description: "The cardinal numbers.",
    items: {
      type: "integer",
      description: "The next integer.",
    },
  } as const;

  expect(formatJson(value, schema)).toEqual(
    "// The cardinal numbers.\n" +
      "[\n" +
      "  // The next integer.\n" +
      "  1,\n" +
      "  // The next integer.\n" +
      "  2,\n" +
      "  // The next integer.\n" +
      "  3,\n" +
      "]",
  );
});

it("should format tuples with descriptive item schemas", () => {
  const value = [1, "first"] as const;
  const schema = {
    type: "array",
    description: "An ordinal numeral mapping.",
    items: [
      {
        type: "integer",
        description: "The rank of the ordinal numeral.",
      },
      {
        type: "string",
        description: "The ordinal number word.",
      },
    ],
  } as const;

  expect(formatJson(value, schema)).toEqual(
    "// An ordinal numeral mapping.\n" +
      "[\n" +
      "  // The rank of the ordinal numeral.\n" +
      "  1,\n" +
      "  // The ordinal number word.\n" +
      '  "first",\n' +
      "]",
  );
});

it("should format empty objects with descriptive schemas", () => {
  const value = {} as const;
  const schema = {
    type: "object",
    description: "An empty vessel.",
  } as const;

  expect(formatJson(value, schema)).toEqual("// An empty vessel.\n" + "{}");
});

it("should format objects with nondescript property schemas", () => {
  const value = { x: 2, y: 3, z: 5 } as const;
  const schema = {
    type: "object",
    description: "A point in space.",
    properties: {
      x: {
        type: "number",
      },
      y: {
        type: "number",
      },
      z: {
        type: "number",
      },
    },
  } as const;

  expect(formatJson(value, schema)).toEqual(
    "// A point in space.\n" +
      "{\n" +
      '  "x": 2,\n' +
      '  "y": 3,\n' +
      '  "z": 5,\n' +
      "}",
  );
});

it("should format objects with descriptive property schemas", () => {
  const value = { x: 2, y: 3, z: 5 } as const;
  const schema = {
    type: "object",
    description: "A point on the plane.",
    properties: {
      x: {
        type: "number",
        description: "The first dimension.",
      },
      y: {
        type: "number",
        description: "The second dimension.",
      },
      z: {
        type: "number",
        description: "The third dimension.",
      },
    },
  } as const;

  expect(formatJson(value, schema)).toEqual(
    "// A point on the plane.\n" +
      "{\n" +
      "  // The first dimension.\n" +
      '  "x": 2,\n' +
      "  // The second dimension.\n" +
      '  "y": 3,\n' +
      "  // The third dimension.\n" +
      '  "z": 5,\n' +
      "}",
  );
});

it("should format complex objects with descriptive schemas", () => {
  const value = {
    name: "Monterey Bay Aquarium",
    address: {
      street: "886 Cannery Row",
      city: "Monterey",
      state: "CA",
      zip: "93940",
    },
    location: [-121.9019, 36.6181],
  } as const;
  const schema = {
    type: "object",
    description: "A point of interest.",
    properties: {
      name: {
        type: "string",
        description: "The name of the place.",
      },
      address: {
        type: "object",
        description: "The address of the place.",
        properties: {
          street: {
            type: "string",
            description: "The street name and number of the place.",
          },
          city: {
            type: "string",
            description: "The city in which the place is located.",
          },
          state: {
            type: "string",
            description: "The state in which the place is located.",
          },
          zip: {
            type: "string",
            description: "The zip code in which the place is located.",
          },
        },
      },
      location: {
        type: "array",
        description: "The geographic coordinates of the place.",
        items: [
          {
            type: "number",
            description: "The longitudinal coordinate of the place.",
          },
          {
            type: "number",
            description: "The latitudinal coordinate of the place.",
          },
        ],
      },
    },
  } as const;

  expect(formatJson(value, schema)).toEqual(
    "// A point of interest.\n" +
      "{\n" +
      "  // The name of the place.\n" +
      '  "name": "Monterey Bay Aquarium",\n' +
      "  // The address of the place.\n" +
      '  "address": {\n' +
      "    // The street name and number of the place.\n" +
      '    "street": "886 Cannery Row",\n' +
      "    // The city in which the place is located.\n" +
      '    "city": "Monterey",\n' +
      "    // The state in which the place is located.\n" +
      '    "state": "CA",\n' +
      "    // The zip code in which the place is located.\n" +
      '    "zip": "93940",\n' +
      "  },\n" +
      "  // The geographic coordinates of the place.\n" +
      '  "location": [\n' +
      "    // The longitudinal coordinate of the place.\n" +
      "    -121.9019,\n" +
      "    // The latitudinal coordinate of the place.\n" +
      "    36.6181,\n" +
      "  ],\n" +
      "}",
  );
});
