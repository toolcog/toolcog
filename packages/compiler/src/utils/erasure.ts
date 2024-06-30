import type ts from "typescript";
import type { ToolcogHost } from "../host.ts";

const getUpperBoundType = (host: ToolcogHost, type: ts.Type): ts.Type => {
  if (type.isTypeParameter()) {
    const constraint = host.checker.getBaseConstraintOfType(type);
    type = constraint ?? host.checker.getAnyType();
  }
  return type;
};

const getErasedType = (host: ToolcogHost, type: ts.Type): ts.Type => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  if (type.isTypeParameter() as boolean) {
    return getErasedType(host, getUpperBoundType(host, type));
  }

  if (type.isUnion()) {
    return host.checker.getTypeFromTypeNode(
      host.factory.createUnionTypeNode(
        type.types.map((type) => getErasedTypeNode(host, type)),
      ),
    );
  }

  if (type.isIntersection()) {
    return host.checker.getTypeFromTypeNode(
      host.factory.createIntersectionTypeNode(
        type.types.map((type) => getErasedTypeNode(host, type)),
      ),
    );
  }

  if (host.checker.isArrayType(type)) {
    return host.checker.getTypeFromTypeNode(
      host.factory.createArrayTypeNode(
        getErasedTypeNode(host, (type as ts.TypeReference).typeArguments![0]!),
      ),
    );
  }

  if ((type.flags & host.ts.TypeFlags.Object) !== 0) {
    const members: ts.TypeElement[] = [];
    for (const property of host.checker.getPropertiesOfType(type)) {
      const propertyType = host.checker.getTypeOfSymbolAtLocation(
        property,
        property.valueDeclaration!,
      );
      const erasedPropertyType = getErasedTypeNode(host, propertyType);
      const member = host.factory.createPropertySignature(
        undefined,
        property.name,
        undefined,
        erasedPropertyType,
      );
      members.push(member);
    }
    return host.checker.getTypeFromTypeNode(
      host.factory.createTypeLiteralNode(members),
    );
  }

  return type;
};

const getErasedTypeNode = (host: ToolcogHost, type: ts.Type): ts.TypeNode => {
  const erasedType = getErasedType(host, type);
  const typeNode = host.checker.typeToTypeNode(
    erasedType,
    undefined,
    undefined,
  );
  if (typeNode === undefined) {
    return host.ts.Debug.fail(
      `Unable to construct type node for erased type \`${host.checker.typeToString(type)}\``,
    );
  }
  return typeNode;
};

export { getUpperBoundType, getErasedType };
