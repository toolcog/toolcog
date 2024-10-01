type SchemaTypeName =
  | "void" // non-standard
  | "undefined" // non-standard
  | "null"
  | "boolean"
  | "integer"
  | "number"
  | "string"
  | "array"
  | "object"
  | "function"; // non-standard

type SchemaType =
  | void
  | undefined
  | null
  | boolean
  | number
  | string
  | readonly SchemaType[]
  | { readonly [key: string]: SchemaType };

type MetaSchema =
  | "http://json-schema.org/schema#"
  | "http://json-schema.org/hyper-schema#"
  | "http://json-schema.org/draft-07/schema#"
  | "http://json-schema.org/draft-07/hyper-schema#"
  | (string & {});

type SchemaDefinition = Schema | boolean;

interface Schema {
  readonly $id?: string | undefined;
  readonly $ref?: string | undefined;
  readonly $schema?: MetaSchema | undefined;
  readonly $comment?: string | undefined;

  // https://tools.ietf.org/html/draft-bhutton-json-schema-01#section-8.2.4
  readonly $defs?: { readonly [key: string]: SchemaDefinition } | undefined;

  // https://tools.ietf.org/html/draft-bhutton-json-schema-validation-01#section-6.1
  readonly type?: readonly SchemaTypeName[] | SchemaTypeName | undefined;
  readonly enum?: readonly SchemaType[] | undefined;
  readonly const?: SchemaType | undefined;

  // https://tools.ietf.org/html/draft-bhutton-json-schema-validation-01#section-6.2
  readonly multipleOf?: number | undefined;
  readonly maximum?: number | undefined;
  readonly exclusiveMaximum?: number | undefined;
  readonly minimum?: number | undefined;
  readonly exclusiveMinimum?: number | undefined;

  // https://tools.ietf.org/html/draft-bhutton-json-schema-validation-01#section-6.3
  readonly maxLength?: number | undefined;
  readonly minLength?: number | undefined;
  readonly pattern?: string | undefined;

  // https://tools.ietf.org/html/draft-bhutton-json-schema-validation-01#section-6.4
  readonly items?: readonly SchemaDefinition[] | SchemaDefinition | undefined;
  readonly additionalItems?: SchemaDefinition | undefined;
  readonly maxItems?: number | undefined;
  readonly minItems?: number | undefined;
  readonly uniqueItems?: boolean | undefined;
  readonly contains?: SchemaDefinition | undefined;

  // https://tools.ietf.org/html/draft-bhutton-json-schema-validation-01#section-6.5
  readonly maxProperties?: number | undefined;
  readonly minProperties?: number | undefined;
  readonly required?: string[] | undefined;
  readonly properties?:
    | { readonly [key: string]: SchemaDefinition }
    | undefined;
  readonly patternProperties?:
    | { readonly [key: string]: SchemaDefinition }
    | undefined;
  readonly additionalProperties?: SchemaDefinition | undefined;
  readonly dependencies?:
    | { readonly [key: string]: SchemaDefinition | string[] }
    | undefined;
  readonly propertyNames?: SchemaDefinition | undefined;

  // https://datatracker.ietf.org/doc/html/draft-bhutton-json-schema-01#section-10.2.1
  readonly allOf?: SchemaDefinition[] | undefined;
  readonly anyOf?: SchemaDefinition[] | undefined;
  readonly oneOf?: SchemaDefinition[] | undefined;
  readonly not?: SchemaDefinition | undefined;

  // https://datatracker.ietf.org/doc/html/draft-bhutton-json-schema-01#section-10.2.2
  readonly if?: SchemaDefinition | undefined;
  readonly then?: SchemaDefinition | undefined;
  readonly else?: SchemaDefinition | undefined;

  // https://tools.ietf.org/html/draft-bhutton-json-schema-validation-01#section-7
  readonly format?: string | undefined;

  // https://tools.ietf.org/html/draft-bhutton-json-schema-validation-01#section-8
  readonly contentMediaType?: string | undefined;
  readonly contentEncoding?: string | undefined;

  // https://tools.ietf.org/html/draft-bhutton-json-schema-validation-01#section-9
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly default?: SchemaType | undefined;
  readonly readOnly?: boolean | undefined;
  readonly writeOnly?: boolean | undefined;
  readonly examples?: SchemaType | undefined;

  function?: FunctionSchema | undefined; // non-standard
}

interface FunctionSchema {
  readonly name?: string | undefined;
  readonly description?: string | undefined;
  readonly parameters?: Schema | undefined;
  readonly returns?: Schema | undefined;
}

export type {
  SchemaTypeName,
  SchemaType,
  MetaSchema,
  SchemaDefinition,
  Schema,
  FunctionSchema,
};
