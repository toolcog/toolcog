/** @internal */
type UnionToIntersection<U> =
  (U extends unknown ? (_: U) => void : never) extends (_: infer R) => void ? R
  : never;

/** @internal */
type NullableType<T, D> =
  "nullable" extends keyof D ?
    D["nullable"] extends true ? T | null
    : D["nullable"] extends false ? Exclude<T, null>
    : T
  : T;

type Primitive =
  | "Boolean"
  | "Boolean!"
  | "Int"
  | "Int!"
  | "Float"
  | "Float!"
  | "String"
  | "String!"
  | "Date"
  | "Date!"
  | "DateTime"
  | "DateTime!"
  | "URI"
  | "URI!"
  | "ID"
  | "ID!"
  | "Base64String"
  | "Base64String!";

type PrimitiveType<T extends Primitive> =
  T extends "Boolean" ? boolean | null
  : T extends "Boolean!" ? boolean
  : T extends "Int" ? number | null
  : T extends "Int!" ? number
  : T extends "Float" ? number | null
  : T extends "Float!" ? number
  : T extends "String" ? string | null
  : T extends "String!" ? string
  : T extends "Date" ? string | null
  : T extends "Date!" ? string
  : T extends "DateTime" ? string | null
  : T extends "DateTime!" ? string
  : T extends "URI" ? string | null
  : T extends "URI!" ? string
  : T extends "ID" ? string | null
  : T extends "ID!" ? string
  : T extends "Base64String" ? string | null
  : T extends "Base64String!" ? string
  : never;

interface Enum {
  readonly name?: string;
  readonly arguments?: Arguments;
  readonly directives?: Directives;
  readonly enum: readonly string[];
  readonly nullable?: boolean;
}

type EnumType<T extends Enum> = NullableType<T["enum"][number], T>;

interface Alias {
  readonly property: string;
  readonly type: Selection;
}

type AliasType<T extends Alias> = SelectionType<T["type"]>;

interface Fragment {
  condition: Selection | null;
  directives?: Directives;
  fields: Fields;
}

type FragmentType<T extends Fragment> = Partial<FieldsType<T["fields"]>>;

/** @internal */
type FragmentsType<T extends Fields> = {
  [K in keyof T as T[K] extends Fragment ? K : never]: T[K] extends Fragment ?
    FragmentType<T[K]>
  : never;
};

type Field = Selection | Alias | Fragment;

type FieldType<T extends Field> =
  T extends Fragment ? FragmentType<T>
  : T extends Alias ? AliasType<T>
  : T extends Selection ? SelectionType<T>
  : never;

interface Fields {
  readonly [key: string]: Field;
}

type FieldsType<T extends Fields> = {
  -readonly [K in keyof T as T[K] extends Selection | Alias ? K
  : never]: FieldType<T[K]>;
} & UnionToIntersection<FragmentsType<T>[keyof FragmentsType<T>]>;

interface Object {
  readonly condition?: never;
  readonly name?: string;
  readonly arguments?: Arguments;
  readonly directives?: Directives;
  readonly fields: Fields;
  readonly nullable?: boolean;
}

type ObjectType<T extends Object> = NullableType<FieldsType<T["fields"]>, T>;

interface List {
  readonly name?: never;
  readonly arguments?: Arguments;
  readonly directives?: Directives;
  readonly list: Selection;
  readonly nullable?: boolean;
}

type ListType<T extends List> = NullableType<SelectionType<T["list"]>[], T>;

interface Reference {
  readonly name?: never;
  readonly arguments?: Arguments;
  readonly directives?: Directives;
  readonly type: Selection;
  readonly nullable?: boolean;
}

type ReferenceType<T extends Reference> = NullableType<
  SelectionType<T["type"]>,
  T
>;

type Selection = Primitive | Enum | Object | List | Reference;

type SelectionType<T extends Selection> =
  T extends Primitive ? PrimitiveType<T>
  : T extends Enum ? EnumType<T>
  : T extends Object ? ObjectType<T>
  : T extends List ? ListType<T>
  : T extends Reference ? ReferenceType<T>
  : never;

/** @internal */
type RequiredInputType<T> = {
  readonly [K in keyof T as null extends T[K] ? never : K]-?: InputType<T[K]>;
};

/** @internal */
type OptionalInputType<T> = {
  readonly [K in keyof T as null extends T[K] ? K : never]?:
    | InputType<T[K]>
    | undefined;
};

/** @internal */
type InputType<T> =
  T extends unknown[] ? T
  : T extends object ? RequiredInputType<T> & OptionalInputType<T>
  : T;

interface Variable {
  readonly parameter?: string;
  readonly type: Selection;
  readonly nullable?: never;
}

type VariableType<T extends Variable> = NullableType<
  SelectionType<T["type"]>,
  T
>;

interface Value {
  readonly value: unknown;
}

type ValueType<T extends Value> =
  T extends { readonly value: infer V } ? V : never;

type Parameter = Variable | Selection;

type ParameterType<T extends Parameter> =
  T extends Variable ? VariableType<T>
  : T extends Selection ? InputType<SelectionType<T>>
  : never;

type Argument = Value | Parameter;

type ArgumentType<T extends Argument> =
  T extends Value ? ValueType<T>
  : T extends Parameter ? ParameterType<T>
  : never;

interface Arguments {
  readonly [name: string]: Argument;
}

/** @internal */
type RequiredArgumentsType<T extends Arguments> = {
  readonly [K in keyof T as null extends ArgumentType<T[K]> ? never
  : K]-?: ArgumentType<T[K]>;
};

/** @internal */
type OptionalArgumentsType<T extends Arguments> = {
  readonly [K in keyof T as null extends ArgumentType<T[K]> ? K : never]?:
    | ArgumentType<T[K]>
    | undefined;
};

type ArgumentsType<T extends Arguments> = RequiredArgumentsType<T> &
  OptionalArgumentsType<T>;

interface Directives {
  readonly [name: string]: Arguments;
}

type DirectivesType<T extends Directives> = UnionToIntersection<
  { readonly [K in keyof T]: ArgumentsType<T[K]> }[keyof T]
>;

/** @internal */
type RequiredArgumentVariablesType<T extends Arguments> = {
  readonly [K in keyof T as T[K] extends Parameter ?
    null extends ParameterType<T[K]> ?
      never
    : K
  : never]-?: T[K] extends Parameter ? ParameterType<T[K]> : never;
};

/** @internal */
type OptionalArgumentVariablesType<T extends Arguments> = {
  readonly [K in keyof T as T[K] extends Parameter ?
    null extends ParameterType<T[K]> ?
      K
    : never
  : never]?: T[K] extends Parameter ? ParameterType<T[K]> | undefined : never;
};

type ArgumentVariablesType<T extends Arguments> =
  RequiredArgumentVariablesType<T> & OptionalArgumentVariablesType<T>;

type DirectiveVariablesType<T extends Directives> = UnionToIntersection<
  {
    readonly [K in keyof T]: ArgumentVariablesType<T[K]>;
  }[keyof T]
>;

type FieldVariablesType<T extends Fields> = UnionToIntersection<
  {
    readonly [K in keyof T]: T[K] extends Alias ? VariablesType<T[K]["type"]>
    : T[K] extends Reference ? VariablesType<T[K]["type"]>
    : T[K] extends List ? VariablesType<T[K]["list"]>
    : VariablesType<T[K]>;
  }[keyof T]
>;

/** @internal */
type SelectionArgumentVariablesType<T> =
  T extends { readonly arguments: Arguments } ?
    ArgumentVariablesType<T["arguments"]>
  : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    {};

/** @internal */
type SelectionDirectiveVariablesType<T> =
  T extends { readonly directives: Directives } ?
    DirectiveVariablesType<T["directives"]>
  : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    {};

/** @internal */
type SelectionFieldVariablesType<T> =
  T extends { readonly fields: Fields } ? FieldVariablesType<T["fields"]>
  : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    {};

type VariablesType<
  T extends
    | Selection
    | Fragment
    | {
        readonly arguments?: Arguments;
        readonly directives?: Directives;
        readonly fields?: Fields;
      },
> = SelectionArgumentVariablesType<T> &
  SelectionDirectiveVariablesType<T> &
  SelectionFieldVariablesType<T>;

/** @internal */
const collectParameterVariable = (
  argumentName: string,
  parameter: Parameter,
  variables: Record<string, Parameter>,
): Record<string, Parameter> => {
  if (variables[argumentName] !== undefined) {
    const oldTypeName = formatTypeName(variables[argumentName]);
    const newTypeName = formatTypeName(parameter);
    if (oldTypeName !== newTypeName) {
      throw new Error(
        "Conflicting types for variable " +
          argumentName +
          ": " +
          oldTypeName +
          " != " +
          newTypeName,
      );
    }
  }
  variables[argumentName] = parameter;
  return variables;
};

/** @internal */
const collectArgumentVariables = (
  args: Arguments,
  variables: Record<string, Parameter>,
): Record<string, Parameter> => {
  for (const argumentName in args) {
    const argument = args[argumentName]!;
    if (typeof argument === "object" && "value" in argument) {
      continue;
    }
    variables = collectParameterVariable(argumentName, argument, variables);
  }
  return variables;
};

/** @internal */
const collectDirectiveVariables = (
  directives: Directives,
  variables: Record<string, Parameter>,
): Record<string, Parameter> => {
  for (const directiveName in directives) {
    const args = directives[directiveName]!;
    variables = collectArgumentVariables(args, variables);
  }
  return variables;
};

/** @internal */
const collectFieldVariables = (
  fields: Fields,
  variables: Record<string, Parameter>,
): Record<string, Parameter> => {
  for (const fieldName in fields) {
    let field = fields[fieldName]!;
    if (typeof field === "object" && "type" in field) {
      field = field.type;
    }
    variables = collectVariables(field, variables);
  }
  return variables;
};

const collectVariables = (
  selection: Selection | Fragment,
  variables: Record<string, Parameter> = {},
): Record<string, Parameter> => {
  while (
    typeof selection === "object" &&
    ("list" in selection || "type" in selection)
  ) {
    if ("list" in selection) {
      selection = selection.list;
    } else if ("type" in selection) {
      selection = selection.type;
    }
  }
  if (typeof selection === "object") {
    if ("arguments" in selection) {
      variables = collectArgumentVariables(selection.arguments, variables);
    }
    if ("directives" in selection) {
      variables = collectDirectiveVariables(selection.directives, variables);
    }
    if ("fields" in selection) {
      variables = collectFieldVariables(selection.fields, variables);
    }
  }
  return variables;
};

/** @internal */
const formatNamedType = (parameter: Parameter): string => {
  while (typeof parameter === "object" && "type" in parameter) {
    parameter = parameter.type;
  }

  let typeName: string;
  if (typeof parameter === "string") {
    if (parameter.endsWith("!")) {
      typeName = parameter.slice(0, -1);
    } else {
      typeName = parameter;
    }
  } else {
    if (parameter.name === undefined) {
      throw new Error("Unnamed GraphQL type: " + JSON.stringify(parameter));
    }
    typeName = parameter.name;
  }
  return typeName;
};

const formatTypeName = (parameter: Parameter): string => {
  let nullable = typeof parameter === "object" ? parameter.nullable : undefined;

  while (typeof parameter === "object" && "type" in parameter) {
    if (nullable === undefined) {
      nullable = parameter.nullable;
    }
    parameter = parameter.type;
  }

  let typeName: string;
  if (typeof parameter === "string") {
    if (nullable === true && parameter.endsWith("!")) {
      typeName = parameter.slice(0, -1);
    } else if (nullable === false && !parameter.endsWith("!")) {
      typeName = parameter + "!";
    } else {
      typeName = parameter;
    }
  } else {
    if ("list" in parameter) {
      typeName = "[" + formatTypeName(parameter.list) + "]";
    } else {
      if (parameter.name === undefined) {
        throw new Error("Unnamed GraphQL type: " + JSON.stringify(parameter));
      }
      typeName = parameter.name;
    }
    if (nullable !== true) {
      typeName += "!";
    }
  }
  return typeName;
};

/** @internal */
const formatArgument = (name: string, arg: Argument): string => {
  let output = "";
  if (typeof arg === "object" && "parameter" in arg) {
    output += arg.parameter ?? name;
  } else {
    output += name;
  }
  output += ": ";
  if (typeof arg === "object" && "value" in arg) {
    output += JSON.stringify(arg.value);
  } else {
    output += "$" + name;
  }
  return output;
};

const formatArguments = (args: Arguments): string => {
  let output = "";
  let i = 0;
  for (const name in args) {
    const arg = args[name]!;
    output += (i !== 0 ? ", " : "") + formatArgument(name, arg);
    i += 1;
  }
  return output;
};

/** @internal */
const formatDirective = (name: string, args: Arguments): string => {
  return "@" + name + "(" + formatArguments(args) + ")";
};

const formatDirectives = (directives: Directives): string => {
  let output = "";
  let i = 0;
  for (const name in directives) {
    const args = directives[name]!;
    output += (i !== 0 ? " " : "") + formatDirective(name, args);
    i += 1;
  }
  return output;
};

/** @internal */
const formatField = (
  name: string,
  field: Selection | Alias,
  depth: number,
): string => {
  let output = " ".repeat(depth) + name;

  if (typeof field === "object" && "property" in field) {
    output += ": " + field.property;
    field = field.type;
  }

  while (typeof field === "object" && ("list" in field || "type" in field)) {
    if ("list" in field) {
      field = field.list;
    } else if ("type" in field) {
      field = field.type;
    }
  }

  const args =
    typeof field === "object" && "arguments" in field ?
      field.arguments
    : undefined;
  if (args !== undefined) {
    output += "(";
    output += formatArguments(args);
    output += ")";
  }

  const directives = typeof field === "object" ? field.directives : undefined;
  if (directives !== undefined) {
    output += " " + formatDirectives(directives);
  }

  if (typeof field === "object" && "fields" in field) {
    output += " {\n";
    output += formatFields(field.fields, depth + 2);
    output += " ".repeat(depth) + "}";
  }

  return output;
};

const formatInlineFragment = (fragment: Fragment, depth: number): string => {
  let output = " ".repeat(depth) + "...";

  if (fragment.condition !== null) {
    output += " on " + formatNamedType(fragment.condition);
  }

  if (fragment.directives !== undefined) {
    output += " " + formatDirectives(fragment.directives);
  }

  output += " {\n";
  output += formatFields(fragment.fields, depth + 2);
  output += " ".repeat(depth) + "}";

  return output;
};

const formatFields = (fields: Fields, depth: number = 0): string => {
  let output = "";
  for (const name in fields) {
    const field = fields[name]!;
    if (typeof field === "object" && "condition" in field) {
      output += formatInlineFragment(field as Fragment, depth);
    } else {
      output += formatField(name, field, depth);
    }
    output += "\n";
  }
  return output;
};

/** @internal */
const formatVariable = (name: string, variable: Parameter): string => {
  const typeName = formatTypeName(variable);
  return "$" + name + ": " + typeName;
};

const formatVariables = (
  variables: Record<string, Parameter>,
): string | undefined => {
  const variableNames = Object.keys(variables);
  if (variableNames.length === 0) {
    return undefined;
  }

  let output = "(";
  for (let i = 0; i < variableNames.length; i += 1) {
    const variableName = variableNames[i]!;
    const variable = variables[variableName]!;
    if (i !== 0) {
      output += ", ";
    }
    output += formatVariable(variableName, variable);
  }
  output += ")";

  return output;
};

const formatOperation: {
  (type: Op, fields: Fields): string;
  (type: Op, name: string | undefined, fields: Fields): string;
} = (type: Op, name: Fields | string | undefined, fields?: Fields): string => {
  if (fields !== undefined) {
    name = name as string;
  } else {
    fields = name as Fields;
    name = undefined;
  }

  let output = type;

  if (name !== undefined) {
    output += " " + name;
  }

  const variables = collectFieldVariables(fields, {});
  const variableDefinitions = formatVariables(variables);
  if (variableDefinitions !== undefined) {
    output += " " + variableDefinitions;
  }

  output += " {\n";
  output += formatFields(fields, 2);
  output += "}";

  return output;
};

const defineSelection = <const T extends Selection>(selection: T): T => {
  return selection;
};

type Op = "query" | "mutation" | "subscription";

interface Operation<O extends Op = Op, F extends Fields = Fields> {
  (
    variables: FieldVariablesType<F>,
  ): [query: string, variables: FieldVariablesType<F>];
  readonly type: Op;
  readonly name: string | undefined;
  readonly fields: F;
  readonly query: string;
}

type OperationType<T extends { readonly fields: Fields }> = FieldsType<
  T["fields"]
>;

const createOperation: {
  <const O extends Op, const F extends Fields>(
    type: O,
    fields: F,
  ): Operation<O, F>;
  <const O extends Op, const F extends Fields>(
    type: O,
    name: string | undefined,
    fields: F,
  ): Operation<O, F>;
} = ((
  type: Op,
  name: Fields | string | undefined,
  fields?: Fields,
): Operation => {
  if (fields !== undefined) {
    name = name as string;
  } else {
    fields = name as Fields;
    name = undefined;
  }

  const query = formatOperation(type, name, fields);

  const operation = Object.assign(
    (
      variables: FieldVariablesType<Fields>,
    ): [query: string, variables: FieldVariablesType<Fields>] => {
      return [query, variables];
    },
    {
      type,
      fields,
      query,
    },
  );
  Object.defineProperty(operation, "name", {
    value: name,
    writable: false,
    enumerable: true,
    configurable: true,
  });
  return operation;
}) as unknown as typeof createOperation;

export type {
  Primitive,
  PrimitiveType,
  Enum,
  EnumType,
  Alias,
  AliasType,
  Fragment,
  FragmentType,
  Field,
  FieldType,
  Fields,
  FieldsType,
  Object,
  ObjectType,
  List,
  ListType,
  Reference,
  ReferenceType,
  Selection,
  SelectionType,
  Variable,
  VariableType,
  Value,
  ValueType,
  Parameter,
  ParameterType,
  Argument,
  ArgumentType,
  Arguments,
  ArgumentsType,
  Directives,
  DirectivesType,
  ArgumentVariablesType,
  DirectiveVariablesType,
  FieldVariablesType,
  VariablesType,
  Op,
  Operation,
  OperationType,
};
export {
  collectVariables,
  formatTypeName,
  formatArguments,
  formatDirectives,
  formatFields,
  formatVariables,
  formatOperation,
  defineSelection,
  createOperation,
};
