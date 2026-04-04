/**
 * Plugin Registry
 *
 * Manages plugin lifecycle, discovery, and dispatch.
 * Plugins are checked in priority order (lowest number first).
 */

import type { Message } from "discord.js";
import type { Plugin, PluginResult, DiscordConfig, MessageContext } from "./types.ts";

class PluginRegistry {
  private plugins: Plugin[] = [];
  private loaded = false;

  /**
   * Register a plugin. Maintains sorted order by priority.
   */
  register(plugin: Plugin): void {
    // Prevent duplicate registration
    if (this.plugins.some((p) => p.name === plugin.name)) {
      console.warn(`[PluginRegistry] Plugin "${plugin.name}" already registered, skipping`);
      return;
    }

    this.plugins.push(plugin);
    this.plugins.sort((a, b) => a.priority - b.priority);
    console.log(
      `[PluginRegistry] Registered "${plugin.name}" v${plugin.version} (priority: ${plugin.priority})`
    );
  }

  /**
   * Unregister a plugin by name.
   */
  async unregister(name: string): Promise<void> {
    const idx = this.plugins.findIndex((p) => p.name === name);
    if (idx === -1) return;

    const plugin = this.plugins[idx];
    if (plugin.onUnload) {
      await plugin.onUnload();
    }
    this.plugins.splice(idx, 1);
    console.log(`[PluginRegistry] Unregistered "${name}"`);
  }

  /**
   * Initialize all registered plugins.
   */
  async loadAll(): Promise<void> {
    if (this.loaded) return;

    for (const plugin of this.plugins) {
      try {
        if (plugin.onLoad) {
          await plugin.onLoad();
        }
        console.log(`[PluginRegistry] Loaded "${plugin.name}"`);
      } catch (error) {
        console.error(`[PluginRegistry] Failed to load "${plugin.name}":`, error);
      }
    }
    this.loaded = true;
  }

  /**
   * Shut down all plugins gracefully.
   */
  async unloadAll(): Promise<void> {
    for (const plugin of [...this.plugins].reverse()) {
      try {
        if (plugin.onUnload) {
          await plugin.onUnload();
        }
      } catch (error) {
        console.error(`[PluginRegistry] Error unloading "${plugin.name}":`, error);
      }
    }
    this.plugins = [];
    this.loaded = false;
  }

  /**
   * Try to handle a message with a plugin.
   * Returns the result from the first plugin whose canHandle() returns true.
   * Returns null if no plugin wants the message.
   */
  async tryHandle(
    message: Message,
    config: DiscordConfig,
    context: MessageContext
  ): Promise<PluginResult | null> {
    for (const plugin of this.plugins) {
      try {
        if (plugin.canHandle(message, context)) {
          console.log(`[PluginRegistry] Plugin "${plugin.name}" handling message`);
          const result = await plugin.handle(message, config, context);
          if (result.handled) {
            return result;
          }
          // Plugin returned handled: false — continue to next plugin
        }
      } catch (error) {
        console.error(`[PluginRegistry] Error in plugin "${plugin.name}":`, error);
        // Don't let a broken plugin block the message pipeline
      }
    }

    return null;
  }

  /**
   * Get list of registered plugins (for status/debug).
   */
  list(): Array<{ name: string; version: string; priority: number; description: string }> {
    return this.plugins.map((p) => ({
      name: p.name,
      version: p.version,
      priority: p.priority,
      description: p.description,
    }));
  }
}

// Singleton registry
export const pluginRegistry = new PluginRegistry();
