import { it, expect } from "vitest";
import { formatOperation } from "./graphql.ts";

it("should format queries", () => {
  const query = formatOperation("query", {
    thoughts: {
      fields: {
        id: "String!",
        name: "String",
        thought: "String",
      },
    },
  });
  expect(query).toBe(`query {
  thoughts {
    id
    name
    thought
  }
}`);
});

it("should format queries with variables", () => {
  const query = formatOperation("query", {
    thought: {
      arguments: {
        id: "Int",
      },
      fields: {
        id: "String!",
        name: "String",
        thought: "String",
      },
    },
  });
  expect(query).toBe(`query ($id: Int) {
  thought(id: $id) {
    id
    name
    thought
  }
}`);
});

it("should format queries with custom scalar type variables", () => {
  const query = formatOperation("query", {
    thought: {
      arguments: {
        id: { name: "ThoughtId", scalar: "Int!", nullable: true },
      },
      fields: {
        id: { name: "ThoughtId", scalar: "Int!" },
        name: "String",
        thought: "String",
      },
    },
  });
  expect(query).toBe(`query ($id: ThoughtId) {
  thought(id: $id) {
    id
    name
    thought
  }
}`);
});

it("should format queries with nested selections", () => {
  const query = formatOperation("query", {
    orders: {
      fields: {
        id: "String!",
        amount: "Float!",
        user: {
          fields: {
            id: "String!",
            name: "String",
            email: "String",
            address: {
              fields: {
                city: "String!",
                state: "String!",
              },
            },
          },
        },
      },
    },
  });
  expect(query).toBe(`query {
  orders {
    id
    amount
    user {
      id
      name
      email
      address {
        city
        state
      }
    }
  }
}`);
});

it("should format queries with required variables", () => {
  const query = formatOperation("query", {
    userLogin: {
      arguments: {
        email: "String!",
        password: "String!",
      },
      fields: {
        userId: "String!",
        token: "String!",
      },
    },
  });
  expect(query).toBe(`query ($email: String!, $password: String!) {
  userLogin(email: $email, password: $password) {
    userId
    token
  }
}`);
});

it("should format queries with renamed parameters", () => {
  const query = formatOperation("query", {
    foo: {
      arguments: {
        id1: { parameter: "id", type: "ID" },
      },
      fields: {
        bar: {
          arguments: {
            id2: { parameter: "id", type: "ID" },
          },
          fields: {
            field: "String",
          },
        },
      },
    },
  });
  expect(query).toBe(`query ($id1: ID, $id2: ID) {
  foo(id: $id1) {
    bar(id: $id2) {
      field
    }
  }
}`);
});

it("should format queries with operation names", () => {
  const query = formatOperation("query", "whoami", {
    viewer: {
      fields: {
        id: "String!",
        token: "String!",
      },
    },
  });
  expect(query).toBe(`query whoami {
  viewer {
    id
    token
  }
}`);
});

it("should format queries with aliased properties", () => {
  const query = formatOperation("query", {
    ideas: {
      property: "thoughts",
      type: {
        fields: {
          id: "String!",
          name: "String",
          idea: { property: "thought", type: "String" },
        },
      },
    },
  });
  expect(query).toBe(`query {
  ideas: thoughts {
    id
    name
    idea: thought
  }
}`);
});

it("should format queries with directives", () => {
  const query = formatOperation("query", {
    thought: {
      arguments: {
        id: "Int",
      },
      directives: {
        include: {
          thinking: { parameter: "if", type: "Boolean" },
        },
      },
      fields: {
        id: "String!",
        name: "String",
        thought: "String",
      },
    },
  });
  expect(query).toBe(`query ($id: Int, $thinking: Boolean) {
  thought(id: $id) @include(if: $thinking) {
    id
    name
    thought
  }
}`);
});

it("should format queries with inline fragments", () => {
  const query = formatOperation("query", {
    entry: {
      fields: {
        name: "String!",
        _org: {
          condition: {
            name: "File",
            fields: {},
          },
          fields: {
            size: "Int!",
          },
        },
        _user: {
          condition: "Directory",
          fields: {
            count: "Int!",
          },
        },
        _all: {
          condition: null,
          directives: {
            include: {
              stat: { parameter: "if", type: "Boolean!" },
            },
          },
          fields: {
            atime: "Int!",
            mtime: "Int!",
            ctime: "Int!",
          },
        },
      },
    },
  });
  expect(query).toBe(`query ($stat: Boolean!) {
  entry {
    name
    ... on File {
      size
    }
    ... on Directory {
      count
    }
    ... @include(if: $stat) {
      atime
      mtime
      ctime
    }
  }
}`);
});
