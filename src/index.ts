#!/usr/bin/env node

import yargs from "yargs/yargs";
import express from "express";
import cors from "cors";
import { hideBin } from "yargs/helpers";
import { MiroClient } from "./MiroClient.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";


// Parse command line arguments
const argv = await yargs(hideBin(process.argv))
  .option("token", {
    alias: "t",
    type: "string",
    description: "Miro OAuth token",
  })
  .help().argv;

// Get token with precedence: command line > environment variable
const oauthToken = (argv.token as string) || process.env.MIRO_OAUTH_TOKEN;

console.log("OAuth Token (masked):", oauthToken ? `${oauthToken.substring(0, 5)}...${oauthToken.substring(oauthToken.length - 5)}` : "undefined");
console.log("MIRO_OAUTH_TOKEN env var exists:", process.env.MIRO_OAUTH_TOKEN ? "Yes" : "No");

if (!oauthToken) {
  console.error(
    "Error: Miro OAuth token is required. Provide it via MIRO_OAUTH_TOKEN environment variable or --token argument"
  );
  process.exit(1);
}

const server = new Server(
  {
    name: "miro-mcp",
          version: "0.1.1",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

const miroClient = new MiroClient(oauthToken);

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const boards = await miroClient.getBoards();

  return {
    resources: boards.map((board) => ({
      uri: `miro://board/${board.id}`,
      mimeType: "application/json",
      name: board.name,
      description: board.description || `Miro board: ${board.name}`,
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const url = new URL(request.params.uri);

  if (!request.params.uri.startsWith("miro://board/")) {
    throw new Error(
      "Invalid Miro resource URI - must start with miro://board/"
    );
  }

  const boardId = url.pathname.substring(1); // Remove leading slash from pathname
  const items = await miroClient.getBoardItems(boardId);

  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(items, null, 2),
      },
    ],
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_boards",
        description: "List all available Miro boards with optional query filter",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Optional search query" },
            teamId: { type: "string", description: "Optional team ID filter" }
          },
        },
      },
      {
        name: "get_board",
        description: "Get detailed information about a specific board",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "ID of the board" }
          },
          required: ["boardId"],
        },
      },
      {
        name: "create_board",
        description: "Create a new Miro board",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Board name" },
            description: { type: "string", description: "Board description" },
            teamId: { type: "string", description: "Team ID" }
          },
          required: ["name"],
        },
      },
      {
        name: "update_board",
        description: "Update board properties",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            name: { type: "string", description: "New board name" },
            description: { type: "string", description: "New board description" }
          },
          required: ["boardId"],
        },
      },
      {
        name: "copy_board",
        description: "Copy an existing board",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Source board ID" },
            name: { type: "string", description: "New board name" },
            description: { type: "string", description: "New board description" },
            teamId: { type: "string", description: "Team ID" }
          },
          required: ["boardId", "name"],
        },
      },
      {
        name: "delete_board",
        description: "Delete a board",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID to delete" }
          },
          required: ["boardId"],
        },
      },

      {
        name: "get_board_items",
        description: "Get all items from a board with filtering options (Note: minimum limit is 10, not less)",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            type: { type: "string", description: "Filter by item type (e.g., 'sticky_note', 'shape', 'text', 'card')" },
            parentItemId: { type: "string", description: "Filter by parent item ID" },
            limit: { type: "number", description: "Limit number of results (minimum 10)", minimum: 10 }
          },
          required: ["boardId"],
        },
      },
      {
        name: "get_item",
        description: "Get detailed information about a specific item on the board",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            itemId: { type: "string", description: "Item ID (get from get_board_items or other item creation)" }
          },
          required: ["boardId", "itemId"],
        },
      },
      {
        name: "update_item",
        description: "Update any item properties (position, style, data, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            itemId: { type: "string", description: "Item ID to update" },
            data: { type: "object", description: "Updated item data (structure varies by item type)" }
          },
          required: ["boardId", "itemId", "data"],
        },
      },
      {
        name: "delete_item", 
        description: "Delete an item from the board (handles empty API responses correctly)",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            itemId: { type: "string", description: "Item ID to delete" }
          },
          required: ["boardId", "itemId"],
        },
      },

      {
        name: "create_sticky_note",
        description: "Create a sticky note with predefined color names (REQUIRED: use color names, not hex codes)",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            content: { type: "string", description: "Text content for the sticky note" },
            color: { 
              type: "string", 
              description: "IMPORTANT: Use predefined color names only. Available colors: gray, light_yellow, yellow, orange, light_green, green, dark_green, cyan, light_pink, pink, violet, red, light_blue, blue, dark_blue, black",
              default: "yellow",
              enum: ["gray", "light_yellow", "yellow", "orange", "light_green", "green", "dark_green", "cyan", "light_pink", "pink", "violet", "red", "light_blue", "blue", "dark_blue", "black"]
            },
            x: { type: "number", default: 0, description: "X coordinate on board" },
            y: { type: "number", default: 0, description: "Y coordinate on board" }
          },
          required: ["boardId", "content"],
        },
      },
      {
        name: "create_text",
        description: "Create a text item (LIMITATION: text items only support width in geometry, height is NOT supported by Miro API)",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            content: { type: "string", description: "Text content to display" },
            x: { type: "number", default: 0, description: "X coordinate on board" },
            y: { type: "number", default: 0, description: "Y coordinate on board" },
            fontSize: { type: "number", default: 14, description: "Font size in points (e.g., 14, 16, 18)" },
            color: { type: "string", default: "#000000", description: "Text color in hex format (e.g., #000000, #FF0000)" }
          },
          required: ["boardId", "content"],
        },
      },
      {
        name: "create_shape",
        description: "Create a geometric shape with content and styling options",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            shape: {
              type: "string",
              enum: ["rectangle", "round_rectangle", "circle", "triangle", "rhombus", "parallelogram", "trapezoid", "pentagon", "hexagon", "octagon", "star", "cloud", "cross", "can", "right_arrow", "left_arrow", "left_right_arrow", "flow_chart_process", "flow_chart_decision", "flow_chart_document", "flow_chart_terminator"],
              default: "rectangle",
              description: "Shape type to create"
            },
            content: { type: "string", description: "Text content inside the shape (optional)" },
            x: { type: "number", default: 0, description: "X coordinate on board" },
            y: { type: "number", default: 0, description: "Y coordinate on board" },
            width: { type: "number", default: 200, description: "Shape width in pixels" },
            height: { type: "number", default: 200, description: "Shape height in pixels" },
            fillColor: { type: "string", default: "#ffffff", description: "Fill color in hex format" },
            borderColor: { type: "string", default: "#000000", description: "Border color in hex format" }
          },
          required: ["boardId", "shape"],
        },
      },
      {
        name: "create_card",
        description: "Create a card item with title and description",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            title: { type: "string", description: "Card title (optional but recommended)" },
            description: { type: "string", description: "Card description/content" },
            x: { type: "number", default: 0, description: "X coordinate on board" },
            y: { type: "number", default: 0, description: "Y coordinate on board" }
          },
          required: ["boardId"],
        },
      },
      {
        name: "create_connector",
        description: "Create a connector/line between two existing items (CRITICAL: both items must already exist on the board)",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            startItemId: { type: "string", description: "REQUIRED: ID of the starting item (must be an existing item on the board - get from get_board_items)" },
            endItemId: { type: "string", description: "REQUIRED: ID of the ending item (must be an existing item on the board - get from get_board_items)" },
            caption: { type: "string", description: "Optional text label to display on the connector" }
          },
          required: ["boardId", "startItemId", "endItemId"],
        },
      },
      {
        name: "create_frame",
        description: "Create a frame container to organize other items",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            title: { type: "string", description: "Frame title" },
            x: { type: "number", default: 0, description: "X coordinate on board" },
            y: { type: "number", default: 0, description: "Y coordinate on board" },
            width: { type: "number", default: 400, description: "Frame width in pixels" },
            height: { type: "number", default: 300, description: "Frame height in pixels" }
          },
          required: ["boardId"],
        },
      },
      {
        name: "create_image",
        description: "Create an image item from a URL",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            url: { type: "string", description: "Public image URL (must be accessible)" },
            x: { type: "number", default: 0, description: "X coordinate on board" },
            y: { type: "number", default: 0, description: "Y coordinate on board" },
            width: { type: "number", default: 200, description: "Image width in pixels" },
            height: { type: "number", default: 200, description: "Image height in pixels" }
          },
          required: ["boardId", "url"],
        },
      },
      {
        name: "create_document",
        description: "Create a document item from a URL",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            url: { type: "string", description: "Document URL (PDF, DOC, etc.)" },
            title: { type: "string", description: "Document title (optional)" },
            x: { type: "number", default: 0, description: "X coordinate on board" },
            y: { type: "number", default: 0, description: "Y coordinate on board" }
          },
          required: ["boardId", "url"],
        },
      },
      {
        name: "create_embed",
        description: "Create an embedded content item from a URL",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            url: { type: "string", description: "Embeddable URL (YouTube, etc.)" },
            x: { type: "number", default: 0, description: "X coordinate on board" },
            y: { type: "number", default: 0, description: "Y coordinate on board" },
            width: { type: "number", default: 320, description: "Embed width in pixels" },
            height: { type: "number", default: 180, description: "Embed height in pixels" }
          },
          required: ["boardId", "url"],
        },
      },

      {
        name: "bulk_create_items",
        description: "Create multiple items at once efficiently (max 20 items per request, implemented via sequential API calls)",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            items: {
              type: "array",
              maxItems: 20,
              description: "Array of items to create (maximum 20 items)",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["sticky_note", "text", "shape", "card", "connector", "frame", "image", "document", "embed"], description: "Item type" },
                  data: { type: "object", description: "Item-specific data (content, shape type, etc.)" },
                  style: { type: "object", description: "Item styling (colors, etc.)" },
                  position: { type: "object", description: "Position on board {x, y}" },
                  geometry: { type: "object", description: "Size and rotation {width, height, rotation}" }
                },
                required: ["type"]
              }
            }
          },
          required: ["boardId", "items"],
        },
      },
      {
        name: "bulk_update_items",
        description: "Update multiple items at once efficiently (max 20 items per request, implemented via sequential API calls)",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            updates: {
              type: "array",
              maxItems: 20,
              description: "Array of item updates (maximum 20 items)",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", description: "Item ID to update" },
                  data: { type: "object", description: "Updated item data" }
                },
                required: ["id", "data"]
              }
            }
          },
          required: ["boardId", "updates"],
        },
      },
      {
        name: "bulk_delete_items",
        description: "Delete multiple items at once efficiently (max 20 items per request, implemented via sequential API calls)",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            itemIds: {
              type: "array",
              maxItems: 20,
              description: "Array of item IDs to delete (maximum 20 items)",
              items: { type: "string" }
            }
          },
          required: ["boardId", "itemIds"],
        },
      },

      {
        name: "bulk_create_connectors",
        description: "Create multiple connectors at once efficiently (max 20 connectors per request, implemented via sequential API calls)",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            connectors: {
              type: "array",
              maxItems: 20,
              description: "Array of connectors to create (maximum 20 connectors)",
              items: {
                type: "object",
                properties: {
                  startItemId: { type: "string", description: "ID of starting item" },
                  endItemId: { type: "string", description: "ID of ending item" },
                  caption: { type: "string", description: "Optional caption text for the connector" },
                  style: { type: "object", description: "Optional connector styling (strokeColor, strokeWidth, strokeStyle)" }
                },
                required: ["startItemId", "endItemId"]
              }
            }
          },
          required: ["boardId", "connectors"],
        },
      },

      {
        name: "get_frames",
        description: "Get all frame items from a board",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" }
          },
          required: ["boardId"],
        },
      },
      {
        name: "get_items_in_frame",
        description: "Get all items contained within a specific frame",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            frameId: { type: "string", description: "Frame ID (get from get_frames or create_frame)" }
          },
          required: ["boardId", "frameId"],
        },
      },

      {
        name: "get_tags",
        description: "Get all tags from a board",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" }
          },
          required: ["boardId"],
        },
      },
      {
        name: "create_tag",
        description: "Create a new tag with predefined color names (CRITICAL: use predefined color names, NOT hex colors)",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            title: { type: "string", description: "Tag title/name" },
            fillColor: { 
              type: "string", 
              description: "IMPORTANT: Use predefined color names only. Available colors: red, magenta, violet, light_green, green, dark_green, cyan, blue, dark_blue, yellow, gray, black", 
              default: "red",
              enum: ["red", "magenta", "violet", "light_green", "green", "dark_green", "cyan", "blue", "dark_blue", "yellow", "gray", "black"]
            }
          },
          required: ["boardId", "title"],
        },
      },
      {
        name: "attach_tag_to_item",
        description: "Attach an existing tag to an item on the board",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            itemId: { type: "string", description: "Item ID (get from get_board_items)" },
            tagId: { type: "string", description: "Tag ID (get from get_tags or create_tag)" }
          },
          required: ["boardId", "itemId", "tagId"],
        },
      },
      {
        name: "remove_tag_from_item",
        description: "Remove a tag from an item on the board",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            itemId: { type: "string", description: "Item ID" },
            tagId: { type: "string", description: "Tag ID to remove" }
          },
          required: ["boardId", "itemId", "tagId"],
        },
      },

      {
        name: "create_group",
        description: "Group multiple existing items together",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            itemIds: {
              type: "array",
              items: { type: "string" },
              description: "Array of item IDs to group together (get from get_board_items)"
            },
            title: { type: "string", description: "Group title (optional)" }
          },
          required: ["boardId", "itemIds"],
        },
      },

      {
        name: "get_board_members",
        description: "Get all members with access to a board",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" }
          },
          required: ["boardId"],
        },
      },
      {
        name: "share_board_with_user",
        description: "Invite a user to collaborate on a board via email",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            email: { type: "string", description: "User email address" },
            role: { type: "string", enum: ["viewer", "commenter", "editor"], description: "Access level: viewer (read-only), commenter (can comment), editor (can edit)" },
            message: { type: "string", description: "Optional invitation message" }
          },
          required: ["boardId", "email", "role"],
        },
      },

      {
        name: "search_items",
        description: "Search for items on a board by content/text",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "string", description: "Board ID" },
            query: { type: "string", description: "Search query (searches item content, titles, etc.)" }
          },
          required: ["boardId", "query"],
        },
      },

      {
        name: "create_webhook",
        description: "Create a webhook subscription for board events (experimental feature)",
        inputSchema: {
          type: "object",
          properties: {
            callbackUrl: { type: "string", description: "Webhook callback URL (must be publicly accessible)" },
            boardId: { type: "string", description: "Board ID to monitor" },
            events: {
              type: "array",
              items: { type: "string" },
              description: "Array of event types to listen for (e.g., 'item_created', 'item_updated')"
            }
          },
          required: ["callbackUrl", "boardId", "events"],
        },
      },
      {
        name: "get_webhooks",
        description: "Get all webhook subscriptions",
        inputSchema: {
          type: "object",
          properties: {
            random_string: { type: "string", description: "Dummy parameter for no-parameter tools" }
          },
          required: ["random_string"],
        },
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    console.log("Received tool call:", request.params.name);
    console.log("Tool arguments:", JSON.stringify(request.params.arguments));
    
    switch (request.params.name) {
      // Board Operations
      case "list_boards": {
        const { query, teamId } = request.params.arguments as any;
        const boards = await miroClient.getBoards(query, teamId);
        return {
          content: [
            {
              type: "text",
              text: `Found ${boards.length} board(s):\n` + 
                    boards.map(b => `- ${b.name} (ID: ${b.id})`).join('\n'),
            },
          ],
        };
      }

      case "get_board": {
        const { boardId } = request.params.arguments as any;
        const board = await miroClient.getBoard(boardId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(board, null, 2),
            },
          ],
        };
      }

      case "create_board": {
        const { name, description, teamId } = request.params.arguments as any;
        const board = await miroClient.createBoard({ name, description, teamId });
        return {
          content: [
            {
              type: "text",
              text: `Created board "${board.name}" with ID: ${board.id}`,
            },
          ],
        };
      }

      case "update_board": {
        const { boardId, name, description } = request.params.arguments as any;
        const board = await miroClient.updateBoard(boardId, { name, description });
        return {
          content: [
            {
              type: "text",
              text: `Updated board "${board.name}" (ID: ${board.id})`,
            },
          ],
        };
      }

      case "copy_board": {
        const { boardId, name, description, teamId } = request.params.arguments as any;
        const board = await miroClient.copyBoard(boardId, { name, description, teamId });
        return {
          content: [
            {
              type: "text",
              text: `Copied board to "${board.name}" with ID: ${board.id}`,
            },
          ],
        };
      }

      case "delete_board": {
        const { boardId } = request.params.arguments as any;
        await miroClient.deleteBoard(boardId);
        return {
          content: [
            {
              type: "text",
              text: `Deleted board ${boardId}`,
            },
          ],
        };
      }

      // Item Operations
      case "get_board_items": {
        const { boardId, type, parentItemId, limit } = request.params.arguments as any;
        const items = await miroClient.getBoardItems(boardId, { type, parentItemId, limit });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(items, null, 2),
            },
          ],
        };
      }

      case "get_item": {
        const { boardId, itemId } = request.params.arguments as any;
        const item = await miroClient.getItem(boardId, itemId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(item, null, 2),
            },
          ],
        };
      }

      case "update_item": {
        const { boardId, itemId, data } = request.params.arguments as any;
        const item = await miroClient.updateItem(boardId, itemId, data);
        return {
          content: [
            {
              type: "text",
              text: `Updated item ${itemId}`,
            },
          ],
        };
      }

      case "delete_item": {
        const { boardId, itemId } = request.params.arguments as any;
        await miroClient.deleteItem(boardId, itemId);
        return {
          content: [
            {
              type: "text",
              text: `Deleted item ${itemId}`,
            },
          ],
        };
      }

      // Content Creation
      case "create_sticky_note": {
        const { boardId, content, color = "yellow", x = 0, y = 0 } = request.params.arguments as any;
        console.log(`Creating sticky note on board ${boardId} with content: ${content}`);
        
        try {
          const stickyNote = await miroClient.createStickyNote(boardId, {
            content,
            color,
            position: { x, y, origin: 'center' }
          });
          console.log("Sticky note created successfully:", stickyNote.id);
          
          return {
            content: [
              {
                type: "text",
                text: `Created sticky note with ID: ${stickyNote.id}`,
              },
            ],
          };
        } catch (error) {
          console.error("Error creating sticky note:", error);
          throw error;
        }
        // Этот блок return не нужен, так как у нас уже есть return внутри блока try
      }

      case "create_text": {
        const { boardId, content, x = 0, y = 0, fontSize = 14, color = "#000000" } = request.params.arguments as any;
        console.log(`Creating text on board ${boardId} with content: ${content}`);
        
        try {
          const textItem = await miroClient.createText(boardId, {
            content,
            position: { x, y, origin: 'center' },
            style: { fontSize, color }
          });
          console.log("Text created successfully:", textItem.id);
          return {
            content: [
              {
                type: "text",
                text: `Created text item with ID: ${textItem.id}`,
              },
            ],
          };
        } catch (error) {
          console.error("Error creating text:", error);
          throw error;
        }
      }

      case "create_shape": {
        const { boardId, shape, content, x = 0, y = 0, width = 200, height = 200, fillColor = "#ffffff", borderColor = "#000000" } = request.params.arguments as any;
        console.log(`Creating shape on board ${boardId}, shape: ${shape}, content: ${content}`);
        console.log("Shape parameters:", { x, y, width, height, fillColor, borderColor });
        
        try {
          const item = await miroClient.createShape(boardId, {
            shape,
            content,
            position: { x, y, origin: 'center' },
            geometry: { width, height },
            style: { fillColor, borderColor }
          });
          console.log("Shape created successfully:", item.id);
          return {
            content: [
              {
                type: "text",
                text: `Created ${shape} shape with ID: ${item.id}`,
              },
            ],
          };
        } catch (error) {
          console.error("Error creating shape:", error);
          throw error;
        }
      }

      case "create_card": {
        const { boardId, title, description, x = 0, y = 0 } = request.params.arguments as any;
        const item = await miroClient.createCard(boardId, {
          title,
          description,
          position: { x, y, origin: 'center' }
        });
        return {
          content: [
            {
              type: "text",
              text: `Created card with ID: ${item.id}`,
            },
          ],
        };
      }

      case "create_connector": {
        const { boardId, startItemId, endItemId, caption } = request.params.arguments as any;
        const item = await miroClient.createConnector(boardId, {
          startItemId,
          endItemId,
          caption
        });
        return {
          content: [
            {
              type: "text",
              text: `Created connector with ID: ${item.id}`,
            },
          ],
        };
      }

      case "create_frame": {
        const { boardId, title, x = 0, y = 0, width = 400, height = 300 } = request.params.arguments as any;
        const item = await miroClient.createFrame(boardId, {
          title,
          position: { x, y, origin: 'center' },
          geometry: { width, height }
        });
        return {
          content: [
            {
              type: "text",
              text: `Created frame with ID: ${item.id}`,
            },
          ],
        };
      }

      case "create_image": {
        const { boardId, url, x = 0, y = 0, width = 200, height = 200 } = request.params.arguments as any;
        const item = await miroClient.createImage(boardId, {
          url,
          position: { x, y, origin: 'center' },
          geometry: { width, height }
        });
        return {
          content: [
            {
              type: "text",
              text: `Created image with ID: ${item.id}`,
            },
          ],
        };
      }

      case "create_document": {
        const { boardId, url, title, x = 0, y = 0 } = request.params.arguments as any;
        const item = await miroClient.createDocument(boardId, {
          url,
          title,
          position: { x, y, origin: 'center' }
        });
        return {
          content: [
            {
              type: "text",
              text: `Created document with ID: ${item.id}`,
            },
          ],
        };
      }

      case "create_embed": {
        const { boardId, url, x = 0, y = 0, width = 320, height = 180 } = request.params.arguments as any;
        const item = await miroClient.createEmbed(boardId, {
          url,
          position: { x, y, origin: 'center' },
          geometry: { width, height }
        });
        return {
          content: [
            {
              type: "text",
              text: `Created embed with ID: ${item.id}`,
            },
          ],
        };
      }

      // Bulk Operations
      case "bulk_create_items": {
        const { boardId, items } = request.params.arguments as any;
        const createdItems = await miroClient.bulkCreateItems(boardId, items);
        return {
          content: [
            {
              type: "text",
              text: `Created ${createdItems.length} items on board ${boardId}`,
            },
          ],
        };
      }

      case "bulk_update_items": {
        const { boardId, updates } = request.params.arguments as any;
        const updatedItems = await miroClient.bulkUpdateItems(boardId, updates);
        return {
          content: [
            {
              type: "text",
              text: `Updated ${updatedItems.length} items on board ${boardId}`,
            },
          ],
        };
      }

      case "bulk_delete_items": {
        const { boardId, itemIds } = request.params.arguments as any;
        await miroClient.bulkDeleteItems(boardId, itemIds);
        return {
          content: [
            {
              type: "text",
              text: `Deleted ${itemIds.length} items from board ${boardId}`,
            },
          ],
        };
      }

      case "bulk_create_connectors": {
        const { boardId, connectors } = request.params.arguments as any;
        const createdConnectors = await miroClient.bulkCreateConnectors(boardId, connectors);
        return {
          content: [
            {
              type: "text",
              text: `Created ${createdConnectors.length} connectors on board ${boardId}`,
            },
          ],
        };
      }

      // Frame Operations
      case "get_frames": {
        const { boardId } = request.params.arguments as any;
        const frames = await miroClient.getFrames(boardId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(frames, null, 2),
            },
          ],
        };
      }

      case "get_items_in_frame": {
        const { boardId, frameId } = request.params.arguments as any;
        const items = await miroClient.getItemsInFrame(boardId, frameId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(items, null, 2),
            },
          ],
        };
      }

      // Tags
      case "get_tags": {
        const { boardId } = request.params.arguments as any;
        const tags = await miroClient.getTags(boardId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(tags, null, 2),
            },
          ],
        };
      }

      case "create_tag": {
        const { boardId, title, fillColor = "red" } = request.params.arguments as any;
        const tag = await miroClient.createTag(boardId, { title, fillColor });
        return {
          content: [
            {
              type: "text",
              text: `Created tag "${title}" with ID: ${tag.id}`,
            },
          ],
        };
      }

      case "attach_tag_to_item": {
        const { boardId, itemId, tagId } = request.params.arguments as any;
        await miroClient.attachTagToItem(boardId, itemId, tagId);
        return {
          content: [
            {
              type: "text",
              text: `Attached tag ${tagId} to item ${itemId}`,
            },
          ],
        };
      }

      case "remove_tag_from_item": {
        const { boardId, itemId, tagId } = request.params.arguments as any;
        await miroClient.removeTagFromItem(boardId, itemId, tagId);
        return {
          content: [
            {
              type: "text",
              text: `Removed tag ${tagId} from item ${itemId}`,
            },
          ],
        };
      }

      // Groups
      case "create_group": {
        const { boardId, itemIds, title } = request.params.arguments as any;
        const group = await miroClient.createGroup(boardId, { itemIds, title });
        return {
          content: [
            {
              type: "text",
              text: `Created group with ID: ${group.id}`,
            },
          ],
        };
      }

      // Board Members
      case "get_board_members": {
        const { boardId } = request.params.arguments as any;
        const members = await miroClient.getBoardMembers(boardId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(members, null, 2),
            },
          ],
        };
      }

      case "share_board_with_user": {
        const { boardId, email, role, message } = request.params.arguments as any;
        const member = await miroClient.shareBoardWithUser(boardId, { email, role, message });
        return {
          content: [
            {
              type: "text",
              text: `Shared board with ${email} as ${role}`,
            },
          ],
        };
      }

      // Search
      case "search_items": {
        const { boardId, query } = request.params.arguments as any;
        const items = await miroClient.searchItems(boardId, query);
        return {
          content: [
            {
              type: "text",
              text: `Found ${items.length} items matching "${query}":\n` + 
                    JSON.stringify(items, null, 2),
            },
          ],
        };
      }

      // Webhooks
      case "create_webhook": {
        const { callbackUrl, boardId, events } = request.params.arguments as any;
        const webhook = await miroClient.createWebhook({ callbackUrl, boardId, events });
        return {
          content: [
            {
              type: "text",
              text: `Created webhook with ID: ${webhook.id}`,
            },
          ],
        };
      }

      case "get_webhooks": {
        const webhooks = await miroClient.getWebhooks();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(webhooks, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    console.error("Error handling tool call:", error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "Working with MIRO",
        description: "Comprehensive guide for working with MIRO boards and all available features",
      },
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === "Working with MIRO") {
    const keyFacts = `# Comprehensive Miro MCP Server Guide

This MCP server provides complete access to the Miro REST API v2 with the following capabilities:

## Board Operations
- **list_boards**: List all boards with optional search and team filtering
- **get_board**: Get detailed board information including metadata
- **create_board**: Create new boards with custom settings
- **update_board**: Modify board properties like name and description
- **copy_board**: Duplicate existing boards
- **delete_board**: Remove boards permanently

## Content Creation Tools
- **Sticky Notes**: Full color palette (15+ colors), custom positioning
- **Text Items**: Rich text formatting, custom fonts and sizes
- **Shapes**: 25+ shapes including flowchart elements (rectangles, circles, arrows, decision diamonds)
- **Cards**: Title/description cards for structured content
- **Images**: Direct URL embedding with size control
- **Documents**: PDF and document embedding
- **Embeds**: Video and web content embedding
- **Frames**: Container elements for organizing content

## Advanced Features
- **Connectors**: Link any items with optional labels and custom styling
- **Tags**: Create, manage, and attach tags to items for organization
- **Groups**: Group multiple items together for batch operations
- **Bulk Operations**: Create, update, or delete up to 20 items simultaneously
- **Bulk Connectors**: Create multiple connectors at once (up to 20) to efficiently link items
- **Search**: Find items by content, metadata, and properties
- **Board Sharing**: Invite users with granular permissions (viewer, commenter, editor)

## Item Management
- **get_board_items**: List items with filtering by type, parent, or search
- **get_item**: Get detailed item information
- **update_item**: Modify any item properties
- **delete_item**: Remove items from boards

## Frame Management
- **create_frame**: Create containers for organizing content
- **get_frames**: List all frames on a board
- **get_items_in_frame**: Get items within specific frames

## Tag System
- **get_tags**: List all tags on a board
- **create_tag**: Create new tags with custom colors
- **attach_tag_to_item**: Tag items for organization
- **remove_tag_from_item**: Remove tags from items

## Board Collaboration
- **get_board_members**: List all board members and their roles
- **share_board_with_user**: Invite users via email with specific permissions
- **Member roles**: owner, editor, commenter, viewer

## Experimental Features
- **Webhooks**: Real-time event notifications for board changes
- **Advanced Search**: Query items by various criteria
- **Bulk Operations**: Efficient batch processing (items and connectors)

## Position System
All items support precise positioning:
- **x, y coordinates**: Exact pixel placement
- **origin**: center, top-left, etc.
- **geometry**: width, height, rotation for supported items

## Styling Options
Comprehensive styling for visual elements:
- **Colors**: Hex codes, predefined palettes
- **Borders**: Width, style (solid, dashed, dotted), opacity
- **Text**: Font family, size, alignment, color
- **Fill**: Background colors and opacity

## Authentication
Requires a Miro OAuth token:
- Set MIRO_OAUTH_TOKEN environment variable
- Or use --token command line argument

## Error Handling
All operations include comprehensive error handling with detailed messages.

## API Compliance
Full compatibility with Miro REST API v2
- Rate limiting respected
- Proper error codes returned
- Consistent data structures

For detailed API documentation: https://miroapp.github.io/api-clients/node/index.html

## Examples

### Creating a Mind Map
1. Create a central frame
2. Add sticky notes for main ideas
3. Create connectors between related concepts
4. Use tags to categorize topics
5. Group related items together

### Project Planning Board
1. Create swimlanes with frames
2. Add cards for tasks with descriptions
3. Use connectors to show dependencies
4. Tag items by priority or status
5. Share with team members

### Flowchart Creation
1. Use flowchart shapes (process, decision, terminator)
2. Connect with labeled connectors
3. Add text annotations
4. Group logical sections in frames`;
    
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: keyFacts,
          },
        },
      ],
    };
  }
  throw new Error("Unknown prompt");
});

async function main() {
  const app = express();
  
  app.use(express.json());
  
  // Middleware для логирования запросов
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });
  
  // Serve static files from the public directory
  app.use(express.static('public'));
      
  // Use the existing server with all the Miro functionality
  // instead of creating a new empty server
  
  // Создаем прямой обработчик для запросов к API Miro
  app.post("/api/create-shape", async (req, res) => {
    try {
      const { boardId, shape, content, x, y, width, height, fillColor, borderColor } = req.body;
      
      console.log(`Creating shape on board ${boardId}`);
      
      // Используем MiroClient напрямую
      const item = await miroClient.createShape(boardId, {
        shape,
        content,
        position: { x, y, origin: 'center' },
        geometry: { width, height },
        style: { fillColor, borderColor }
      });
      
      res.json({
        success: true,
        message: `Created ${shape} shape with ID: ${item.id}`,
        item
      });
    } catch (error) {
      console.error('Error creating shape:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  app.get("/sse", async (req, res) => {
    let transport = new SSEServerTransport("/messages", res);
    server.connect(transport);
  });
  
  app.post("/messages", async (req, res) => {
    try {
      const body = req.body;
      console.log('Received message:', JSON.stringify(body));
      

    } catch (error) {
      console.error('Error handling message:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const PORT = 3002;
  const HOST = '0.0.0.0'; // Listen on all interfaces
  console.log(`Starting Miro MCP server on ${HOST}:${PORT}`);
  console.log(`Use the following URL to connect: http://localhost:${PORT}/sse`);
  
  app.listen(PORT, HOST);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
