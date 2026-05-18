import logger from '../lib/logger.js';

import type { BaseMCPServer } from './BaseMCPServer.js';

/**
 * Global MCP server registry.
 *
 * Slots pre-stubbed so PRs 3.1 and 3.2 can fill them in parallel
 * without touching the same file.
 *
 * null  = slot reserved, server not yet registered
 * value = live server instance
 */
const servers = new Map<string, BaseMCPServer | null>([
  ['bol-processor',  null], // filled by PR 3.1
  ['carrier-rates',  null], // filled by PR 3.2
  ['hts-classifier', null], // filled by PR 4.1b
]);

/** Register a concrete server. Throws if the slot is not pre-reserved. */
export function registerServer(server: BaseMCPServer): void {
  if (!servers.has(server.name)) {
    throw new Error(
      `MCPServerRegistry: no slot reserved for '${server.name}'. ` +
        `Add it to the initial Map before registering.`,
    );
  }
  servers.set(server.name, server);
  logger.info(
    { serverName: server.name, version: server.version },
    'mcp.registry.registered',
  );
}

/** Retrieve a registered server. Throws if not registered or slot still null. */
export function getServer(name: string): BaseMCPServer {
  const server = servers.get(name);
  if (server === undefined) {
    throw new Error(`MCPServerRegistry: unknown server '${name}'`);
  }
  if (server === null) {
    throw new Error(
      `MCPServerRegistry: server '${name}' slot reserved but not yet registered`,
    );
  }
  return server;
}

/** List all registered (non-null) server names */
export function listRegisteredServers(): string[] {
  return [...servers.entries()]
    .filter(([, v]) => v !== null)
    .map(([k]) => k);
}
