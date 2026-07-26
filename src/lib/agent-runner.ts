// Agent Runner - Real MCP integration for Swiggy LifeOS
// Replaces mock runAgent with actual MCP tool calls

import { MCP_ENDPOINTS, type McpServer, type AgentStep, type AgentRun } from "./lifeos";

// MCP JSON-RPC request helper
async function mcpRequest(
  endpoint: string,
  method: string,
  params?: Record<string, unknown>
): Promise<unknown> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Math.floor(Math.random() * 10000),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`MCP request failed: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();

  if ("error" in json && json.error) {
    throw new Error(`MCP error: ${json.error.message}`);
  }

  return "result" in json ? json.result : null;
}

// Intent classification based on keywords
type Intent = "grocery" | "date" | "fitness" | "budget" | "routine" | "general";

function classifyIntent(query: string): Intent {
  const q = query.toLowerCase();

  if (/groc|fridge|pantry|instamart|shopping/i.test(q)) {
    return "grocery";
  }
  if (/book|table|reserv|date|anniversar|surprise|romantic|dineout/i.test(q)) {
    return "date";
  }
  if (/protein|gym|calorie|healthy|macro|workout|fitness/i.test(q)) {
    return "fitness";
  }
  if (/budget|cheap|under|₹|\brs\b|afford|split|hosting/i.test(q)) {
    return "budget";
  }
  if (/breakfast|every|daily|8 ?am|routine|schedule|morning|recurring/i.test(q)) {
    return "routine";
  }
  return "general";
}

// Execute MCP tool call and return formatted result
async function executeMCPTool(
  server: McpServer,
  tool: string,
  args: Record<string, unknown> = {}
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const endpoint = MCP_ENDPOINTS[server];

  try {
    const result = await mcpRequest(endpoint, "tools/call", {
      name: tool,
      arguments: args,
    });
    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

// Format MCP result for display
function formatToolResult(tool: string, result: unknown): string {
  if (!result) return "No results";

  // Try to format as readable string
  try {
    const str = JSON.stringify(result, null, 2);
    if (str.length > 100) {
      return str.slice(0, 100) + "...";
    }
    return str;
  } catch {
    return String(result);
  }
}

// Build agent steps based on intent
async function buildAgentSteps(
  intent: Intent,
  query: string
): Promise<AgentStep[]> {
  const steps: AgentStep[] = [];

  switch (intent) {
    case "grocery": {
      // Search Instamart products
      steps.push({ server: "instamart", tool: "instamart.search_products", detail: "Searching for products..." });
      const searchResult = await executeMCPTool("instamart", "instamart.search_products", {
        query: query.replace(/grocery|shopping|instamart/gi, "").trim() || "essentials",
        limit: 10,
      });

      if (searchResult.success) {
        steps.push({
          server: "instamart",
          tool: "instamart.search_products",
          detail: formatToolResult("search_products", searchResult.data),
        });
      } else {
        steps.push({
          server: "instamart",
          tool: "instamart.search_products",
          detail: searchResult.error || "Search failed",
        });
      }

      // Try to get pantry state
      const pantryResult = await executeMCPTool("instamart", "instamart.get_pantry_state", {});
      if (pantryResult.success) {
        steps.push({
          server: "instamart",
          tool: "instamart.get_pantry_state",
          detail: formatToolResult("get_pantry_state", pantryResult.data),
        });
      }
      break;
    }

    case "date": {
      // Search restaurants via Food MCP
      steps.push({ server: "food", tool: "food.search_restaurants", detail: "Searching restaurants..." });
      const foodResult = await executeMCPTool("food", "food.search_restaurants", {
        query: query.replace(/book|table|reserve|dineout|restaurant/gi, "").trim() || "Italian",
        limit: 10,
      });

      if (foodResult.success) {
        steps.push({
          server: "food",
          tool: "food.search_restaurants",
          detail: formatToolResult("search_restaurants", foodResult.data),
        });
      }

      // Try Dineout for reservations
      const dineResult = await executeMCPTool("dineout", "dineout.search_availability", {
        date: new Date().toISOString().split("T")[0],
        time: "19:00",
        party_size: 2,
      });

      if (dineResult.success) {
        steps.push({
          server: "dineout",
          tool: "dineout.search_availability",
          detail: formatToolResult("search_availability", dineResult.data),
        });
      }
      break;
    }

    case "fitness": {
      // Search high-protein restaurants
      const foodResult = await executeMCPTool("food", "food.search_restaurants", {
        query: "high protein healthy",
        limit: 10,
      });

      if (foodResult.success) {
        steps.push({
          server: "food",
          tool: "food.search_restaurants",
          detail: formatToolResult("search_restaurants", foodResult.data),
        });
      }

      // Try Instamart for supplements
      const instaResult = await executeMCPTool("instamart", "instamart.search_products", {
        query: "whey protein",
        limit: 5,
      });

      if (instaResult.success) {
        steps.push({
          server: "instamart",
          tool: "instamart.search_products",
          detail: formatToolResult("search_products", instaResult.data),
        });
      }
      break;
    }

    case "budget": {
      // Search affordable restaurants
      const foodResult = await executeMCPTool("food", "food.search_restaurants", {
        query: "budget affordable",
        limit: 10,
      });

      if (foodResult.success) {
        steps.push({
          server: "food",
          tool: "food.search_restaurants",
          detail: formatToolResult("search_restaurants", foodResult.data),
        });
      }
      break;
    }

    case "routine": {
      // Set up recurring order via Instamart
      const pantryResult = await executeMCPTool("instamart", "instamart.get_pantry_state", {});

      if (pantryResult.success) {
        steps.push({
          server: "instamart",
          tool: "instamart.get_pantry_state",
          detail: formatToolResult("get_pantry_state", pantryResult.data),
        });
      }

      const searchResult = await executeMCPTool("food", "food.search_restaurants", {
        query: "breakfast",
        limit: 5,
      });

      if (searchResult.success) {
        steps.push({
          server: "food",
          tool: "food.search_restaurants",
          detail: formatToolResult("search_restaurants", searchResult.data),
        });
      }
      break;
    }

    default: {
      // General query - try Food MCP first
      const foodResult = await executeMCPTool("food", "food.search_restaurants", {
        query: query,
        limit: 5,
      });

      if (foodResult.success) {
        steps.push({
          server: "food",
          tool: "food.search_restaurants",
          detail: formatToolResult("search_restaurants", foodResult.data),
        });
      }
    }
  }

  return steps;
}

// Generate answer based on steps taken
function generateAnswer(intent: Intent, steps: AgentStep[]): string {
  const successfulSteps = steps.filter(s => !s.detail.includes("failed") && !s.detail.includes("error"));

  if (successfulSteps.length === 0) {
    return "I couldn't find any results. The MCP servers may be unavailable or the request timed out. Please try again.";
  }

  switch (intent) {
    case "grocery":
      return "Found grocery options from Instamart. Check the results above for products you can order.";
    case "date":
      return "Found restaurant options and available tables for your date. Select a restaurant to proceed with reservation.";
    case "fitness":
      return "Found high-protein meal options and fitness supplements. These can help you meet your nutrition goals.";
    case "budget":
      return "Found affordable food options within your budget. Check the results above.";
    case "routine":
      return "Your recurring order setup is ready. Review the options and confirm your schedule.";
    default:
      return "Here's what I found for your query. Let me know if you'd like to place an order or need more details.";
  }
}

// Main runAgent function - replaces the mock version
export async function runAgent(query: string): Promise<AgentRun> {
  const intent = classifyIntent(query);

  const intentLabels: Record<Intent, string> = {
    grocery: "Grocery replenishment",
    date: "Date night / dining",
    fitness: "Fitness meal planning",
    budget: "Budget-constrained ordering",
    routine: "Recurring order setup",
    general: "General lifestyle request",
  };

  const planLabels: Record<Intent, string> = {
    grocery: "Search → compare → add to cart",
    date: "Discover → compare → reserve",
    fitness: "Filter protein → order → log",
    budget: "Filter budget → order → split",
    routine: "Create trigger → bind tools → confirm",
    general: "Search → present → refine",
  };

  const steps = await buildAgentSteps(intent, query);

  const answer = generateAnswer(intent, steps);

  return {
    intent: intentLabels[intent],
    plan: planLabels[intent],
    steps,
    answer,
  };
}

// Export for use in agent console
export { type Intent, classifyIntent };
