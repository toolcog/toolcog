/**
 * A content block containing text.
 */
interface TextBlock {
  /**
   * Identifies this as a text content block.
   */
  readonly type: "text";

  /**
   * The text content for this block.
   */
  readonly text: string;
}

/**
 * A content block containing an image.
 */
interface ImageBlock {
  /**
   * Identifies this as an image content block.
   */
  readonly type: "image";

  /**
   * The URL of the image.
   */
  readonly source: string;
}

/**
 * A content block containing a refusal message.
 */
interface RefusalBlock {
  /**
   * Identifies this as a refusal content block.
   */
  readonly type: "refusal";

  /**
   * The stated reason for the refusal.
   */
  readonly refusal: string;
}

/**
 * A content block containing a tool request.
 */
interface RequestBlock {
  /**
   * Identifies this as a tool request content block.
   */
  readonly type: "request";

  /**
   * A unique identifier for this tool request.
   */
  readonly id: string;

  /**
   * The name of the tool to invoke.
   */
  readonly name: string;

  /**
   * The arguments to the tool function.
   */
  readonly arguments: unknown;
}

/**
 * A content block containing a tool response.
 */
interface ResponseBlock {
  /**
   * Identifies this as a tool response content block.
   */
  readonly type: "response";

  /**
   * The unique identifier of the tool request.
   */
  readonly id: string;

  /**
   * The return value of the tool function.
   */
  readonly result: string;
}

/**
 * A content block in a message from a user to an assistant.
 */
type UserBlock = TextBlock | ImageBlock | ResponseBlock;

/**
 * A chat message from a user to an assistant.
 */
interface UserMessage {
  /**
   * Identifies this as a message coming from the user.
   */
  readonly role: "user";

  /**
   * The content of the message, either a string or an array of content blocks.
   */
  readonly content: readonly UserBlock[] | string;
}

/**
 * A content block in a message from an assistant to a user.
 */
type AssistantBlock = TextBlock | RefusalBlock | RequestBlock;

/**
 * A chat message from an assistant to a user.
 */
interface AssistantMessage {
  /**
   * Identifies this as a message coming from the assistant.
   */
  readonly role: "assistant";

  /**
   * The content of the message, either a string or an array of content blocks.
   */
  readonly content: readonly AssistantBlock[] | string;
}

/**
 * A content block in a message between a user and an assistant.
 */
type MessageBlock = UserBlock | AssistantBlock;

/**
 * A chat message between a user and an assistant.
 */
type Message = UserMessage | AssistantMessage;

export type {
  TextBlock,
  ImageBlock,
  RefusalBlock,
  RequestBlock,
  ResponseBlock,
  UserBlock,
  UserMessage,
  AssistantBlock,
  AssistantMessage,
  MessageBlock,
  Message,
};
