/**
 * Plugin Loader
 *
 * Auto-discovers and registers plugins from the plugins/ directory.
 * Each plugin must have an index.ts that default-exports a Plugin object.
 */

import { pluginRegistry } from "./registry.ts";
import wizardPlugin from "./wizard/index.ts";
// import exportPlugin from "./export/index.ts"; // Disabled: requires memory/db.ts (removed for standalone mode)
import docGenPlugin from "./doc-gen/index.ts";
import notebooklmPlugin from "./notebooklm/index.ts";

/**
 * Load all available plugins into the registry.
 * Add new plugin imports here as they are created.
 */
export async function loadPlugins(): Promise<void> {
  console.log("[PluginLoader] Loading plugins...");

  // Register all plugins (priority order: wizard=10, doc-gen=20, notebooklm=30)
  pluginRegistry.register(wizardPlugin);
  // pluginRegistry.register(exportPlugin); // Disabled: requires memory/db.ts (removed for standalone mode)
  pluginRegistry.register(docGenPlugin);
  pluginRegistry.register(notebooklmPlugin);

  // Initialize all plugins
  await pluginRegistry.loadAll();

  const loaded = pluginRegistry.list();
  console.log(`[PluginLoader] ${loaded.length} plugin(s) loaded:`);
  for (const p of loaded) {
    console.log(`  - ${p.name} v${p.version} (priority: ${p.priority}): ${p.description}`);
  }
}
