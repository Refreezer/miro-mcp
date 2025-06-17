# Comprehensive Miro MCP Server

A powerful Model Context Protocol server providing complete access to the Miro REST API v2. This enhanced version offers extensive functionality for board management, content creation, collaboration, and advanced features.

## Features

### 🎯 Complete API Coverage
- **40+ tools** covering all major Miro API endpoints
- Full CRUD operations for all content types
- Advanced board management and collaboration features
- Experimental features like webhooks and advanced search

### 📋 Board Operations
- `list_boards` - List all boards with search and team filtering
- `get_board` - Get detailed board information
- `create_board` - Create new boards with custom settings
- `update_board` - Modify board properties
- `copy_board` - Duplicate existing boards
- `delete_board` - Remove boards permanently

### 🎨 Content Creation
- **Sticky Notes**: 15+ colors, custom positioning, text content
- **Text Items**: Rich formatting, custom fonts and sizes
- **Shapes**: 25+ shapes including flowchart elements
- **Cards**: Title/description cards for structured content
- **Images**: Direct URL embedding with size control
- **Documents**: PDF and document embedding
- **Embeds**: Video and web content embedding
- **Frames**: Container elements for organizing content
- **Connectors**: Link items with optional labels and styling

### 🏷️ Organization Features
- **Tags**: Create, manage, and attach tags to items
- **Groups**: Group multiple items for batch operations
- **Frames**: Organize content in containers
- **Search**: Find items by content and metadata

### 🚀 Advanced Operations
- **Bulk Operations**: Create, update, or delete up to 20 items simultaneously (implemented via sequential API calls)
- **Bulk Connectors**: Create multiple connectors at once to efficiently link items
- **Board Sharing**: Invite users with granular permissions
- **Member Management**: Manage board access and roles
- **Webhooks**: Real-time event notifications (experimental)

### 🎛️ Precise Control
- **Positioning**: Exact pixel placement with configurable origins
- **Styling**: Comprehensive visual customization
- **Geometry**: Control size, rotation, and dimensions
- **Typography**: Font families, sizes, colors, and alignment

## Installation

```bash
npm install @aditya.mishra/miro-mcp
```

## ⚠️ Important API Limitations & Best Practices

Based on extensive testing with the Miro API v2, please note these critical requirements:

### 🎨 Content Creation Requirements
- **Text Items**: Only support `width` in geometry, `height` is NOT supported by Miro API
- **Sticky Notes & Tags**: Must use predefined color names (e.g., "yellow", "red", "blue"), NOT hex codes
- **Connectors**: Both start and end items MUST exist on the board before creating connectors

### 📊 API Limits
- **Bulk Operations**: Maximum 20 items per request (create/update/delete)
- **Board Items**: Minimum limit is 10 when using `get_board_items` with limit parameter
- **Rate Limiting**: Miro API has rate limits - consider delays for large operations

### 🔍 Working with Items
- **Item IDs**: Always obtain item IDs from `get_board_items` or item creation responses
- **Connectors**: Require existing item IDs - use `get_board_items` to find valid item IDs first
- **Tags**: Use predefined color names from the enum lists in tool descriptions

### 📍 Positioning
- **Coordinates**: Use `x`, `y` coordinates for precise placement (pixels from board center)
- **Origins**: Default origin is "center" - items are positioned from their center point

## Authentication

Obtain a Miro OAuth token from your Miro app and provide it via:

### Environment Variable
```bash
export MIRO_OAUTH_TOKEN="your_token_here"
```

### Command Line
```bash
miro-mcp --token "your_token_here"
```

## Usage

### As MCP Server
```json
{
  "mcpServers": {
    "miro-mcp": {
      "command": "npx",
      "args": ["@aditya.mishra/miro-mcp"],
      "env": {
        "MIRO_OAUTH_TOKEN": "your_token_here"
      }
    }
  }
}
```

### Direct Execution
```bash
# List available tools
npx @modelcontextprotocol/inspector build/index.js

# Run with token
MIRO_OAUTH_TOKEN=your_token miro-mcp
```

## Tool Categories

### Board Management (6 tools)
- Complete board lifecycle management
- Search and filtering capabilities
- Team-based organization

### Content Creation (9 tools)
- All major content types supported
- Rich styling and positioning options
- URL-based media embedding

### Item Operations (4 tools)
- Universal item management
- Advanced filtering and search
- Batch processing capabilities

### Bulk Operations (4 tools)
- Efficient batch create/update/delete via sequential API calls
- Bulk connector creation for linking multiple items efficiently
- Up to 20 items per operation (validated and enforced)
- Optimized for large-scale changes with proper error handling

### Organization (8 tools)
- Tags for categorization
- Groups for logical clustering
- Frames for spatial organization
- Advanced search capabilities

### Collaboration (2 tools)
- User invitation and management
- Role-based permissions
- Real-time sharing

### Advanced Features (8 tools)
- Webhook management
- Frame-based operations
- Member administration
- Experimental features

## Examples

### Creating a Project Board
```javascript
// 1. Create a new board
await createBoard({
  name: "Project Planning",
  description: "Q1 project planning board"
});

// 2. Create frames for organization
await createFrame({
  boardId: "board_id",
  title: "Backlog",
  x: 0, y: 0, width: 400, height: 600
});

// 3. Add task cards
await createCard({
  boardId: "board_id",
  title: "User Authentication",
  description: "Implement OAuth2 login flow",
  x: 50, y: 50
});

// 4. Connect related items
await createConnector({
  boardId: "board_id",
  startItemId: "item1",
  endItemId: "item2",
  caption: "depends on"
});

// 5. Share with team
await shareBoardWithUser({
  boardId: "board_id",
  email: "team@company.com",
  role: "editor"
});
```

### Creating a Mind Map
```javascript
// 1. Central topic
await createStickyNote({
  boardId: "board_id",
  content: "Main Topic",
  color: "yellow",
  x: 0, y: 0
});

// 2. Branch topics
const branches = ["Idea 1", "Idea 2", "Idea 3"];
for (let i = 0; i < branches.length; i++) {
  const item = await createStickyNote({
    boardId: "board_id",
    content: branches[i],
    color: "light_blue",
    x: Math.cos(i * 2 * Math.PI / 3) * 200,
    y: Math.sin(i * 2 * Math.PI / 3) * 200
  });
  
  await createConnector({
    boardId: "board_id",
    startItemId: "central_item_id",
    endItemId: item.id
  });
}

// 3. Add tags for categorization
await createTag({
  boardId: "board_id",
  title: "Priority High",
  fillColor: "#ff0000"
});
```

### Bulk Content Creation
```javascript
// Create multiple items efficiently (up to 20 items)
// Note: Implemented via sequential API calls for reliability
await bulkCreateItems({
  boardId: "board_id",
  items: [
    {
      type: "sticky_note",
      data: { content: "Task 1" },
      style: { fillColor: "yellow" },
      position: { x: 0, y: 0 }
    },
    {
      type: "sticky_note", 
      data: { content: "Task 2" },
      style: { fillColor: "pink" },
      position: { x: 100, y: 0 }
    },
    {
      type: "shape",
      data: { shape: "rectangle", content: "Process" },
      position: { x: 200, y: 0 },
      geometry: { width: 150, height: 100 }
    }
  ]
});

// Update multiple items at once
await bulkUpdateItems({
  boardId: "board_id",
  updates: [
    {
      id: "item_id_1",
      data: {
        data: { content: "Updated Task 1" },
        style: { fillColor: "green" }
      }
    },
    {
      id: "item_id_2", 
      data: {
        data: { content: "Updated Task 2" },
        style: { fillColor: "blue" }
      }
    }
  ]
});

// Delete multiple items at once  
await bulkDeleteItems({
  boardId: "board_id",
  itemIds: ["item_id_1", "item_id_2", "item_id_3"]
});
```

## Available Shapes

### Basic Shapes
- rectangle, round_rectangle, circle, triangle
- rhombus, parallelogram, trapezoid
- pentagon, hexagon, octagon, star
- cloud, cross, can

### Arrows
- right_arrow, left_arrow, left_right_arrow

### Flowchart Elements
- flow_chart_process, flow_chart_decision
- flow_chart_document, flow_chart_terminator
- flow_chart_input_output, flow_chart_delay
- flow_chart_display, flow_chart_preparation

## Color Palette

### Sticky Note Colors
- gray, light_yellow, yellow, orange
- light_green, green, dark_green, cyan
- light_pink, pink, violet, red
- light_blue, blue, dark_blue, black

### Custom Colors
Use any hex color code for shapes, text, and other elements.

## Error Handling

All operations include comprehensive error handling:
- Detailed error messages
- Proper HTTP status codes
- Graceful fallbacks
- Clear debugging information

## Rate Limiting

The server respects Miro's API rate limits:
- Automatic retry logic
- Exponential backoff
- Rate limit headers monitoring

## API Compliance

- Full Miro REST API v2 compatibility
- Consistent data structures
- Standard HTTP methods
- Proper authentication handling

## Development

### Building
```bash
npm run build
```

### Testing
```bash
npm run inspector
```

### Watching
```bash
npm run watch
```

## Limitations

- Maximum 20 items per bulk operation (enforced and validated)
- Bulk operations use sequential API calls (not true bulk endpoints)
- DELETE operations may return empty responses (handled automatically)
- Webhook feature is experimental
- Some advanced enterprise features require appropriate Miro plan
- File uploads not supported (URL-based only)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- GitHub Issues for bug reports
- Miro API Documentation: https://miroapp.github.io/api-clients/node/
- MCP Documentation: https://modelcontextprotocol.io/

## Changelog

### v0.2.0 - Comprehensive Enhancement
- Added 35+ new tools covering complete Miro API
- Implemented board management operations
- Added content creation for all item types
- Introduced tags, groups, and organization features
- Added bulk operations for efficiency
- Implemented board sharing and collaboration
- Added webhooks and experimental features
- Enhanced error handling and documentation

### v0.1.1 - Initial Release
- Basic sticky note creation
- Simple board listing
- Frame operations
- Limited shape support
