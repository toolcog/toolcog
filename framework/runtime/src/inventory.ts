import { readFile } from "node:fs/promises";
import YAML from "yaml";
import type {
  EmbeddingModel,
  EmbeddingVector,
  Embeddings,
} from "@toolcog/core";
import { decodeEmbeddings, encodeEmbeddings } from "@toolcog/core";

interface IdiomInventory<V = EmbeddingVector> {
  embeddings: Embeddings<V>;
}

interface Inventory<V = EmbeddingVector> {
  embeddingModels: EmbeddingModel[];

  idioms: { [idiomId: string]: IdiomInventory<V> };
}

const inventoryFileName = "toolcog-inventory.yaml";

const parseInventory = (yaml: string): Inventory => {
  return decodeInventory(
    YAML.parse(yaml, {
      customTags: ["binary"],
    }) as Inventory<Buffer>,
  );
};

const formatInventory = (cache: Inventory): string => {
  return YAML.stringify(encodeInventory(cache), {
    customTags: ["binary"],
  });
};

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

const decodeIdiomInventory = (
  idiomInventory: IdiomInventory<Buffer>,
): IdiomInventory => {
  return {
    embeddings: decodeEmbeddings(idiomInventory.embeddings),
  };
};

const encodeIdiomInventory = (
  idiomInventory: IdiomInventory,
): IdiomInventory<Buffer> => {
  return {
    embeddings: encodeEmbeddings(idiomInventory.embeddings),
  };
};

const createInventory = (): Inventory => {
  return {
    embeddingModels: [],
    idioms: Object.create(null) as Inventory["idioms"],
  };
};

type InventorySource =
  | (() => Promise<Inventory | undefined> | Inventory | undefined)
  | Promise<Inventory | undefined>
  | Inventory
  | string
  | boolean
  | undefined;

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
  if (typeof inventory === "function") {
    inventory = inventory();
  }
  return await inventory;
};

export type { IdiomInventory, Inventory, InventorySource };
export {
  inventoryFileName,
  parseInventory,
  formatInventory,
  createInventory,
  resolveInventory,
};
