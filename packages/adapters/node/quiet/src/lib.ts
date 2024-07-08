type WarningHandler = (warning: Error | undefined, ...rest: any[]) => unknown;

const messageFilter = /(?:--(?:experimental-)?loader\b|\bCustom ESM Loaders\b)/;

// Silence eye-gouging node warnings.
function warningHandler(this: unknown, warning?: Error, ...rest: unknown[]) {
  if (
    warning?.name === "ExperimentalWarning" &&
    messageFilter.test(warning.message)
  ) {
    // Suppress --experimental-loader warning.
    return;
  }

  // Original handler is not defined when run with `--no-warnings`.
  return originalWarningHandler?.call(this, warning, ...rest);
}

// Probe into `EventEmitter` internals to access builtin warning handler.
const _process = process as unknown as {
  _events: {
    warning: WarningHandler | WarningHandler[];
  };
};

let originalWarningHandler: WarningHandler | undefined;
if (Array.isArray(_process._events.warning)) {
  originalWarningHandler = _process._events.warning[0];
  _process._events.warning[0] = warningHandler;
} else {
  originalWarningHandler = _process._events.warning;
  _process._events.warning = warningHandler;
}
