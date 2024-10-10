import { readFile } from "node:fs/promises";
import YAML from "yaml";
import type {
  EmbeddingModel,
  EmbeddingVector,
  Embeddings,
} from "@toolcog/core";
import { decodeEmbeddings, encodeEmbeddings } from "@toolcog/core";

/**
 * An inventory of AI assets defined for an idiom.
 *
 * @typeParam V - The type of embedding vectors contained by the inventory.
 */
interface IdiomInventory<V = EmbeddingVector> {
  /**
   * The embeddings generated from the descriptive phrases for the idiom.
   */
  embeddings: Embeddings<V>;
}

/**
 * An inventory of AI assets defined for a project.
 *
 * @typeParam V - The type of embedding vectors contained by the inventory.
 */
interface Inventory<V = EmbeddingVector> {
  /**
   * The embedding models for which all inventoried embedding vectors
   * have been pre-computed.
   */
  embeddingModels: EmbeddingModel[];

  /**
   * The idioms defined for the project.
   */
  idioms: { [idiomId: string]: IdiomInventory<V> };
}

/**
 * The default file name for AI inventory files.
 */
const inventoryFileName = "toolcog-inventory.yaml";

/**
 * Parses an AI inventory file.
 *
 * @param yaml - The YAML content of the inventory file.
 * @returns The parsed AI inventory.
 */
const parseInventory = (yaml: string): Inventory => {
  return decodeInventory(
    YAML.parse(yaml, {
      customTags: ["binary"],
    }) as Inventory<Buffer>,
  );
};

/**
 * Formats an AI inventory as a YAML string.
 *
 * @param inventory - The AI inventory to format.
 * @returns The YAML string.
 */
const formatInventory = (inventory: Inventory): string => {
  return YAML.stringify(encodeInventory(inventory), {
    customTags: ["binary"],
  });
};

/**
 * Decodes the embedding vectors in a parsed AI inventory for in-memory use.
 * Base64-decodes all embedding vectors into `Float32Array`s.
 *
 * @param inventory - The AI inventory to decode.
 * @returns The decoded AI inventory.
 * @internal
 */
const decodeInventory = (inventory: Inventory<Buffer>): Inventory => {
  return {
    embeddingModels: inventory.embeddingModels,
    idioms: Object.fromEntries(
      Object.entries(inventory.idioms).map(([idiomId, idiomInventory]) => {
        return [idiomId, decodeIdiomInventory(idiomInventory)] as const;
      }),
    ),
  };
};

/**
 * Encodes the embedding vectors in an AI inventory for serialization.
 * Base64-encodes all embedding vectors into `Buffer`s.
 *
 * @param inventory - The AI inventory to encode.
 * @returns The encoded AI inventory.
 * @internal
 */
const encodeInventory = (inventory: Inventory): Inventory<Buffer> => {
  return {
    embeddingModels: inventory.embeddingModels,
    idioms: Object.fromEntries(
      Object.entries(inventory.idioms)
        .map(([idiomId, idiomInventory]) => {
          return [idiomId, encodeIdiomInventory(idiomInventory)] as const;
        })
        .sort((a, b) => a[0].localeCompare(b[0])),
    ),
  };
};

/**
 * Decodes the embedding vectors in an idiom inventory for in-memory use.
 * Base64-decodes all embedding vectors into `Float32Array`s.
 *
 * @param idiomInventory - The idiom inventory to decode.
 * @returns The decoded idiom inventory.
 * @internal
 */
const decodeIdiomInventory = (
  idiomInventory: IdiomInventory<Buffer>,
): IdiomInventory => {
  return {
    embeddings: decodeEmbeddings(idiomInventory.embeddings),
  };
};

/**
 * Encodes the embedding vectors in an idiom inventory for serialization.
 * Base64-encodes all embedding vectors into `Buffer`s.
 *
 * @param idiomInventory - The idiom inventory to encode.
 * @returns The encoded idiom inventory.
 * @internal
 */
const encodeIdiomInventory = (
  idiomInventory: IdiomInventory,
): IdiomInventory<Buffer> => {
  return {
    embeddings: encodeEmbeddings(idiomInventory.embeddings),
  };
};

/**
 * Creates a new AI inventory.
 *
 * @returns An empty AI inventory.
 */
const createInventory = (): Inventory => {
  return {
    embeddingModels: [],
    idioms: Object.create(null) as Inventory["idioms"],
  };
};

/**
 * A module that exports a default `Inventory` implementation.
 */
interface InventoryModule {
  /**
   * The default export of the module.
   */
  default?:
    | (() => Promise<Inventory | undefined> | Inventory | undefined)
    | Inventory
    | undefined;
}

/**
 * Specifies the various ways to provide an AI inventory.
 * An `InventorySource` can be:
 * - A function returning an inventory, `undefined`, or a promise thereof
 * - A promise resolving to an inventory module, inventory object,
 *   or `undefined`
 * - An inventory module
 * - An inventory object
 * - The path of an inventory file to load
 * - `true` to load the default inventory file
 * - `false` or `undefined` to not resolve an inventory
 * - `undefined`
 */
type InventorySource =
  | (() => Promise<Inventory | undefined> | Inventory | undefined)
  | Promise<InventoryModule | Inventory | undefined>
  | InventoryModule
  | Inventory
  | string
  | boolean
  | undefined;

/**
 * Converts an `InventorySource` into a loaded `Inventory` by resolving
 * promises, traversing default exports, and invoking functions as necessary.
 *
 * @param inventory - The inventory source to resolve.
 * @returns The resolved inventory.
 */
const resolveInventory = async (
  inventory: InventorySource,
): Promise<Inventory | undefined> => {
  if (inventory === false) {
    return undefined;
  } else if (inventory === true) {
    inventory = inventoryFileName;
  }
  if (typeof inventory === "string") {
    return parseInventory(await readFile(inventory, "utf-8"));
  }
  inventory = await inventory;
  if (inventory !== undefined && "default" in inventory) {
    inventory = inventory.default;
  }
  if (typeof inventory === "function") {
    inventory = await inventory();
  }
  return inventory as Inventory | undefined;
};

/**
 * Converts an array of `InventorySource`s into an array of loaded `Inventory`
 * objects by resolving promises, traversing default exports, and invoking
 * functions as necessary.
 *
 * @param inventories - The inventory sources to resolve.
 * @returns The resolved inventories.
 */
const resolveInventories: {
  (inventories: readonly InventorySource[]): Promise<Inventory[]>;
  (
    inventories: readonly InventorySource[] | null | undefined,
  ): Promise<Inventory[] | undefined>;
} = (async (
  inventories: readonly InventorySource[] | null | undefined,
): Promise<Inventory[] | undefined> => {
  if (inventories === undefined || inventories === null) {
    return undefined;
  }
  return (
    await Promise.allSettled(
      inventories.map((inventory) => resolveInventory(inventory)),
    )
  ).reduce<Inventory[]>((inventories, result) => {
    if (result.status === "fulfilled" && result.value !== undefined) {
      inventories.push(result.value);
    }
    return inventories;
  }, []);
}) as typeof resolveInventories;

export type { IdiomInventory, Inventory, InventoryModule, InventorySource };
export {
  inventoryFileName,
  parseInventory,
  formatInventory,
  createInventory,
  resolveInventory,
  resolveInventories,
};
