---
"@toolcog/runtime": patch
"@toolcog/core": patch
"@toolcog/node": patch
---

Add toolkit+inventory loader and ephemeral package installer.

Toolkits can now be loaded with `--toolkit <module>`. Multiple toolkits
can be loaded by specifying multiple `--toolkit` options.
Plugins can now be loaded with `--plugin <module>`. Multiple plugins
can be loaded by specifying multiple `--plugin` options.

Similar to `npx`, if a toolkit or plugin module represents a package import
that fails to resolve, the CLI will offer to install the missing packages.
If permitted to do so, the missing packages will be installed in
`~/.toolcog/packages/<hash>`, where `<hash>` is a hash of the to-be-installed
package names. The requested modules will then be loaded from the ephemeral
installation directory.

Loading a toolkit with `--toolkit` also attempts to load a corresponding
inventory module by appending "/toolcog-inventory" to the module name,
if the module represents a package import.

All loaded plugins, toolkits, and inventories are registered with the
current runtime.
