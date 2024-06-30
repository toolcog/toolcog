import type { GenerativeModel, EmbeddingModel } from "@toolcog/core";
import { OpenAIGenerativeModel } from "./generative-model.ts";
import { OpenAIEmbeddingModel } from "./embedding-model.ts";

const getGenerativeModel = async (
  modelName?: string,
): Promise<GenerativeModel | undefined> => {
  if (modelName === undefined) {
    modelName = OpenAIGenerativeModel.DefaultModelName;
  } else if (!OpenAIGenerativeModel.isSupportedModelName(modelName)) {
    return undefined;
  }

  return new OpenAIGenerativeModel({ modelName });
};

const getEmbeddingModel = async (
  modelName?: string,
): Promise<EmbeddingModel | undefined> => {
  if (modelName === undefined) {
    modelName = OpenAIEmbeddingModel.DefaultModelName;
  } else if (!OpenAIEmbeddingModel.isSupportedModelName(modelName)) {
    return undefined;
  }

  return new OpenAIEmbeddingModel({ modelName });
};

export { getGenerativeModel, getEmbeddingModel };
