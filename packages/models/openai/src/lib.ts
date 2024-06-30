export type {
  OpenAIGenerativeModelName,
  OpenAIGenerativeModelOptions,
} from "./generative-model.ts";
export { OpenAIGenerativeModel } from "./generative-model.ts";

export type {
  OpenAIEmbeddingModelName,
  OpenAIEmbeddingModelOptions,
} from "./embedding-model.ts";
export { OpenAIEmbeddingModel } from "./embedding-model.ts";

export { getGenerativeModel, getEmbeddingModel } from "./model-plugin.ts";
