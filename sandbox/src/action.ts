import { embedding } from "toolcog";

export const selectAction = embedding([
  // @intent Send a message.
  // @intent Tell somebody.
  "message",
  // @intent Set a timer.
  // @intent Remind me.
  "timer",
  // Tell a joke.
  "joke",
]);
