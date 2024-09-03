import ts from "typescript";

/** @internal */
const loadConfigFile = (configPath: string): ts.ParsedCommandLine => {
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error !== undefined) {
    const message = ts.flattenDiagnosticMessageText(
      configFile.error.messageText,
      "\n",
    );
    throw new Error(message);
  }

  const config = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    ts.getDirectoryPath(configPath),
  );
  if (config.errors.length !== 0) {
    let message = `Error parsing ${JSON.stringify(configPath)}`;
    for (const error of config.errors) {
      message += "\n";
      message += ts.flattenDiagnosticMessageText(error.messageText, "\n");
    }
    throw new Error(message);
  }

  return config;
};

export { loadConfigFile };
