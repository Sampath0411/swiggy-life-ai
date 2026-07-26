// MCP (Model Context Protocol) Client for Swiggy endpoints
// Uses JSON-RPC 2.0 over HTTP

export interface MCPClient {
  endpoint: string;
  transport: "http" | "sse";
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

let requestId = 1;

function createRequest(method: string, params?: Record<string, unknown>): JSONRPCRequest {
  return {
    jsonrpc: "2.0",
    id: requestId++,
    method,
    params,
  };
}

export async function createMCPClient(endpoint: string): Promise<MCPClient> {
  // Test connection by listing tools
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createRequest("tools/list")),
    });

    if (!response.ok) {
      throw new Error(`MCP server responded with ${response.status}`);
    }

    return {
      endpoint,
      transport: "http",
    };
  } catch (error) {
    console.error("Failed to connect to MCP server:", error);
    throw error;
  }
}

export async function listTools(client: MCPClient): Promise<MCPTool[]> {
  const response = await fetch(client.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createRequest("tools/list")),
  });

  if (!response.ok) {
    throw new Error(`Failed to list tools: ${response.status}`);
  }

  const json: JSONRPCResponse = await response.json();

  if (json.error) {
    throw new Error(`MCP error: ${json.error.message}`);
  }

  // MCP tools/list returns { tools: [...] }
  const result = json.result as { tools?: MCPTool[] };
  return result.tools || [];
}

export async function callTool(
  client: MCPClient,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  const response = await fetch(client.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createRequest("tools/call", {
      name: toolName,
      arguments: args,
    })),
  });

  if (!response.ok) {
    throw new Error(`Tool call failed: ${response.status}`);
  }

  const json: JSONRPCResponse = await response.json();

  if (json.error) {
    throw new Error(`MCP error: ${json.error.message}`);
  }

  return json.result;
}

// Streaming tool call for SSE support (if MCP server supports it)
export async function* streamingCall(
  client: MCPClient,
  toolName: string,
  args: Record<string, unknown> = {}
): AsyncGenerator<unknown, void, unknown> {
  const response = await fetch(client.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(createRequest("tools/call", {
      name: toolName,
      arguments: args,
    })),
  });

  if (!response.ok) {
    throw new Error(`Streaming call failed: ${response.status}`);
  }

  if (!response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE messages
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        try {
          const json = JSON.parse(data);
          if (json.result) {
            yield json.result;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }
}

// Initialize all Swiggy MCP clients
export const SWIGGY_MCP_ENDPOINTS = {
  food: "https://mcp.swiggy.com/food",
  instamart: "https://mcp.swiggy.com/im",
  dineout: "https://mcp.swiggy.com/dineout",
} as const;

export type SwiggyMCPService = keyof typeof SWIGGY_MCP_ENDPOINTS;

// Cache for MCP clients
const clientCache = new Map<string, MCPClient>();

export async function getMCPClient(service: SwiggyMCPService): Promise<MCPClient> {
  const endpoint = SWIGGY_MCP_ENDPOINTS[service];

  if (clientCache.has(endpoint)) {
    return clientCache.get(endpoint)!;
  }

  const client = await createMCPClient(endpoint);
  clientCache.set(endpoint, client);
  return client;
}

export async function callSwiggyTool(
  service: SwiggyMCPService,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  const client = await getMCPClient(service);
  return callTool(client, toolName, args);
}
