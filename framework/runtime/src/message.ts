type MessageRole = "system" | "user" | "assistant" | "tool";

type MessageContent = TextMessageContent | ImageUrlMessageContent;

interface TextMessageContent {
  readonly type: "text";
  readonly text: string;
}

interface ImageUrlMessageContent {
  readonly type: "image_url";
  readonly image_url: {
    readonly url: string;
    readonly detail?: "auto" | "low" | "high" | undefined;
  };
}

type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

interface SystemMessage {
  readonly role: "system";
  readonly content: string;
}

interface UserMessage {
  readonly role: "user";
  readonly content: MessageContent[] | string;
}

interface AssistantMessage {
  readonly role: "assistant";
  readonly content: string | null;
  readonly refusal?: string | null | undefined;
  readonly tool_calls?: ToolCall[] | undefined;
}

interface ToolMessage {
  readonly role: "tool";
  readonly tool_call_id: string;
  readonly content: string;
}

interface ToolCall {
  readonly type: "function";
  readonly id: string;
  readonly function: {
    readonly name: string;
    readonly arguments: string;
  };
}

export type {
  MessageRole,
  MessageContent,
  TextMessageContent,
  ImageUrlMessageContent,
  Message,
  SystemMessage,
  UserMessage,
  AssistantMessage,
  ToolMessage,
  ToolCall,
};
