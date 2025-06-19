import fetch from 'node-fetch';

// Core interfaces
interface MiroBoard {
  id: string;
  name: string;
  description?: string;
  team?: { id: string; name: string };
  project?: { id: string; name: string };
  owner?: { id: string; name: string; email: string };
  sharingPolicy?: {
    access: 'private' | 'view' | 'comment' | 'edit';
    inviteToAccountAndBoardLinkAccess: 'no_access' | 'view' | 'comment' | 'edit';
    organizationAccess: 'no_access' | 'view' | 'comment' | 'edit';
    teamAccess: 'no_access' | 'view' | 'comment' | 'edit';
  };
  createdAt: string;
  modifiedAt: string;
}

interface MiroBoardsResponse {
  data: MiroBoard[];
  total: number;
  size: number;
  offset: number;
}

interface MiroItem {
  id: string;
  type: string;
  data?: any;
  style?: any;
  geometry?: any;
  position?: any;
  parent?: any;
  createdAt?: string;
  modifiedAt?: string;
  createdBy?: { id: string; name: string };
  modifiedBy?: { id: string; name: string };
}

interface MiroItemsResponse {
  data: MiroItem[];
  cursor?: string;
}

interface MiroTag {
  id: string;
  title: string;
  fillColor: string;
}

interface MiroGroup {
  id: string;
  data: {
    title?: string;
  };
  style?: {
    fillColor?: string;
  };
  geometry: {
    width: number;
    height: number;
  };
  position: {
    x: number;
    y: number;
    origin: string;
  };
}

interface MiroMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'editor' | 'commenter' | 'viewer';
  createdAt: string;
  modifiedAt: string;
}

interface MiroWebhook {
  id: string;
  callbackUrl: string;
  boardId: string;
  status: 'enabled' | 'disabled';
  events: string[];
}

interface CreateItemData {
  type: 'sticky_note' | 'shape' | 'text' | 'card' | 'connector' | 'frame' | 'image' | 'document' | 'embed' | 'app_card';
  data: any;
  style?: any;
  position?: { x: number; y: number; origin?: string };
  geometry?: { width?: number; height?: number; rotation?: number };
  parent?: { id: string };
}

export class MiroClient {
  constructor(private token: string) {}

  private async fetchApi(path: string, options: { method?: string; body?: any; params?: Record<string, string> } = {}) {
    let url = `https://api.miro.com/v2${path}`;
    
    // Add query parameters if provided
    if (options.params) {
      const searchParams = new URLSearchParams(options.params);
      url += `?${searchParams.toString()}`;
    }

    const requestBody = options.body ? JSON.stringify(options.body) : undefined;

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      ...(requestBody ? { body: requestBody } : {})
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Miro API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    if (response.status === 204 || options.method === 'DELETE') {
      return {};
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }

    return {};
  }

  // Board Operations
  async getBoards(query?: string, teamId?: string): Promise<MiroBoard[]> {
    const params: Record<string, string> = {};
    if (query) params.query = query;
    if (teamId) params.team_id = teamId;
    
    const response = await this.fetchApi('/boards', { params }) as MiroBoardsResponse;
    return response.data;
  }

  async getBoard(boardId: string): Promise<MiroBoard> {
    return this.fetchApi(`/boards/${boardId}`) as Promise<MiroBoard>;
  }

  async createBoard(data: { name: string; description?: string; sharingPolicy?: any; teamId?: string }): Promise<MiroBoard> {
    return this.fetchApi('/boards', {
      method: 'POST',
      body: data
    }) as Promise<MiroBoard>;
  }

  async updateBoard(boardId: string, data: { name?: string; description?: string; sharingPolicy?: any }): Promise<MiroBoard> {
    return this.fetchApi(`/boards/${boardId}`, {
      method: 'PATCH',
      body: data
    }) as Promise<MiroBoard>;
  }

  async copyBoard(boardId: string, data: { name: string; description?: string; teamId?: string; sharingPolicy?: any }): Promise<MiroBoard> {
    return this.fetchApi(`/boards/${boardId}/copy`, {
      method: 'POST',
      body: data
    }) as Promise<MiroBoard>;
  }

  async deleteBoard(boardId: string): Promise<void> {
    await this.fetchApi(`/boards/${boardId}`, { method: 'DELETE' });
  }

  // Item Operations - Generic
  async getBoardItems(boardId: string, options?: {
    type?: string;
    parentItemId?: string;
    cursor?: string;
    limit?: number;
  }): Promise<MiroItem[]> {
    const params: Record<string, string> = {};
    if (options?.type) params.type = options.type;
    if (options?.parentItemId) params.parent_item_id = options.parentItemId;
    if (options?.cursor) params.cursor = options.cursor;
    if (options?.limit) params.limit = options.limit.toString();

    const response = await this.fetchApi(`/boards/${boardId}/items`, { params }) as MiroItemsResponse;
    return response.data;
  }

  async getItem(boardId: string, itemId: string): Promise<MiroItem> {
    return this.fetchApi(`/boards/${boardId}/items/${itemId}`) as Promise<MiroItem>;
  }

  async updateItem(boardId: string, itemId: string, data: any): Promise<MiroItem> {
    const item = await this.getItem(boardId, itemId);
    
    let endpoint: string;
    switch (item.type) {
      case 'sticky_note':
        endpoint = `/boards/${boardId}/sticky_notes/${itemId}`;
        break;
      case 'shape':
        endpoint = `/boards/${boardId}/shapes/${itemId}`;
        break;
      case 'text':
        endpoint = `/boards/${boardId}/texts/${itemId}`;
        break;
      case 'card':
        endpoint = `/boards/${boardId}/cards/${itemId}`;
        break;
      case 'connector':
        endpoint = `/boards/${boardId}/connectors/${itemId}`;
        break;
      case 'frame':
        endpoint = `/boards/${boardId}/frames/${itemId}`;
        break;
      case 'image':
        endpoint = `/boards/${boardId}/images/${itemId}`;
        break;
      case 'document':
        endpoint = `/boards/${boardId}/documents/${itemId}`;
        break;
      case 'embed':
        endpoint = `/boards/${boardId}/embeds/${itemId}`;
        break;
      default:
        endpoint = `/boards/${boardId}/items/${itemId}`;
    }
    
    return this.fetchApi(endpoint, {
      method: 'PATCH',
      body: data
    }) as Promise<MiroItem>;
  }

  async deleteItem(boardId: string, itemId: string): Promise<void> {
    await this.fetchApi(`/boards/${boardId}/items/${itemId}`, { method: 'DELETE' });
  }

  // Sticky Notes
  async createStickyNote(boardId: string, data: {
    content: string;
    color?: string;
    shape?: 'square' | 'rectangle';
    position?: { x: number; y: number; origin?: string };
  }): Promise<MiroItem> {
    const stickyData = {
      data: { content: data.content },
      style: {
        fillColor: data.color || 'yellow',
        textAlign: 'center',
        textAlignVertical: 'middle'
      },
      position: data.position || { x: 0, y: 0, origin: 'center' }
    };

    return this.fetchApi(`/boards/${boardId}/sticky_notes`, {
      method: 'POST',
      body: stickyData
    }) as Promise<MiroItem>;
  }

  async updateStickyNote(boardId: string, itemId: string, data: any): Promise<MiroItem> {
    return this.fetchApi(`/boards/${boardId}/sticky_notes/${itemId}`, {
      method: 'PATCH',
      body: data
    }) as Promise<MiroItem>;
  }

  // Shapes
  async createShape(boardId: string, data: {
    shape: string;
    content?: string;
    position?: { x: number; y: number; origin?: string };
    geometry?: { width?: number; height?: number; rotation?: number };
    style?: any;
  }): Promise<MiroItem> {
    const shapeData = {
      data: { 
        shape: data.shape,
        ...(data.content ? { content: data.content } : {})
      },
      position: data.position || { x: 0, y: 0, origin: 'center' },
      geometry: data.geometry || { width: 200, height: 200, rotation: 0 },
      style: data.style || {
        fillColor: '#ffffff',
        borderColor: '#000000',
        borderWidth: 2,
        borderStyle: 'normal',
        fillOpacity: 1,
        borderOpacity: 1
      }
    };

    return this.fetchApi(`/boards/${boardId}/shapes`, {
      method: 'POST',
      body: shapeData
    }) as Promise<MiroItem>;
  }

  async updateShape(boardId: string, itemId: string, data: any): Promise<MiroItem> {
    return this.fetchApi(`/boards/${boardId}/shapes/${itemId}`, {
      method: 'PATCH',
      body: data
    }) as Promise<MiroItem>;
  }

  // Text Items
  async createText(boardId: string, data: {
    content: string;
    position?: { x: number; y: number; origin?: string };
    style?: any;
    geometry?: { width?: number; rotation?: number };
  }): Promise<MiroItem> {
    const textData = {
      data: { content: data.content },
      position: data.position || { x: 0, y: 0, origin: 'center' },
      style: data.style || {
        color: '#000000',
        fontSize: 14,
        fontFamily: 'Arial',
        textAlign: 'left'
      },
      geometry: data.geometry || { width: 200 }
    };

    return this.fetchApi(`/boards/${boardId}/texts`, {
      method: 'POST',
      body: textData
    }) as Promise<MiroItem>;
  }

  async updateText(boardId: string, itemId: string, data: any): Promise<MiroItem> {
    return this.fetchApi(`/boards/${boardId}/texts/${itemId}`, {
      method: 'PATCH',
      body: data
    }) as Promise<MiroItem>;
  }

  // Cards
  async createCard(boardId: string, data: {
    title?: string;
    description?: string;
    position?: { x: number; y: number; origin?: string };
    style?: any;
  }): Promise<MiroItem> {
    const cardData = {
      data: {
        ...(data.title ? { title: data.title } : {}),
        ...(data.description ? { description: data.description } : {})
      },
      position: data.position || { x: 0, y: 0, origin: 'center' },
      style: data.style || {
        cardTheme: '#ffffff'
      }
    };

    return this.fetchApi(`/boards/${boardId}/cards`, {
      method: 'POST',
      body: cardData
    }) as Promise<MiroItem>;
  }

  async updateCard(boardId: string, itemId: string, data: any): Promise<MiroItem> {
    return this.fetchApi(`/boards/${boardId}/cards/${itemId}`, {
      method: 'PATCH',
      body: data
    }) as Promise<MiroItem>;
  }

  // Connectors
  async createConnector(boardId: string, data: {
    startItemId: string;
    endItemId: string;
    caption?: string;
    style?: any;
  }): Promise<MiroItem> {
    const connectorData = {
      startItem: { id: data.startItemId, snapTo: 'auto' },
      endItem: { id: data.endItemId, snapTo: 'auto' },
      ...(data.caption ? { captions: [{ content: data.caption, position: '50%' }] } : {}),
      style: data.style || {
        strokeColor: '#000000',
        strokeWidth: 2,
        strokeStyle: 'normal'
      }
    };

    return this.fetchApi(`/boards/${boardId}/connectors`, {
      method: 'POST',
      body: connectorData
    }) as Promise<MiroItem>;
  }

  async updateConnector(boardId: string, itemId: string, data: any): Promise<MiroItem> {
    return this.fetchApi(`/boards/${boardId}/connectors/${itemId}`, {
      method: 'PATCH',
      body: data
    }) as Promise<MiroItem>;
  }

  // Frames
  async createFrame(boardId: string, data: {
    title?: string;
    position?: { x: number; y: number; origin?: string };
    geometry?: { width: number; height: number };
    style?: any;
  }): Promise<MiroItem> {
    const frameData = {
      data: {
        ...(data.title ? { title: data.title } : {})
      },
      position: data.position || { x: 0, y: 0, origin: 'center' },
      geometry: data.geometry || { width: 400, height: 300 },
      style: data.style || {
        fillColor: '#ffffff'
      }
    };

    return this.fetchApi(`/boards/${boardId}/frames`, {
      method: 'POST',
      body: frameData
    }) as Promise<MiroItem>;
  }

  async updateFrame(boardId: string, itemId: string, data: any): Promise<MiroItem> {
    return this.fetchApi(`/boards/${boardId}/frames/${itemId}`, {
      method: 'PATCH',
      body: data
    }) as Promise<MiroItem>;
  }

  async getFrames(boardId: string): Promise<MiroItem[]> {
    return this.getBoardItems(boardId, { type: 'frame' });
  }

  async getItemsInFrame(boardId: string, frameId: string): Promise<MiroItem[]> {
    return this.getBoardItems(boardId, { parentItemId: frameId });
  }

  // Images
  async createImage(boardId: string, data: {
    url: string;
    position?: { x: number; y: number; origin?: string };
    geometry?: { width?: number; height?: number; rotation?: number };
  }): Promise<MiroItem> {
    const imageData = {
      data: { url: data.url },
      position: data.position || { x: 0, y: 0, origin: 'center' },
      geometry: data.geometry || { width: 200, height: 200 }
    };

    return this.fetchApi(`/boards/${boardId}/images`, {
      method: 'POST',
      body: imageData
    }) as Promise<MiroItem>;
  }

  async updateImage(boardId: string, itemId: string, data: any): Promise<MiroItem> {
    return this.fetchApi(`/boards/${boardId}/images/${itemId}`, {
      method: 'PATCH',
      body: data
    }) as Promise<MiroItem>;
  }

  // Documents
  async createDocument(boardId: string, data: {
    url: string;
    title?: string;
    position?: { x: number; y: number; origin?: string };
  }): Promise<MiroItem> {
    const documentData = {
      data: { 
        url: data.url,
        ...(data.title ? { title: data.title } : {})
      },
      position: data.position || { x: 0, y: 0, origin: 'center' }
    };

    return this.fetchApi(`/boards/${boardId}/documents`, {
      method: 'POST',
      body: documentData
    }) as Promise<MiroItem>;
  }

  async updateDocument(boardId: string, itemId: string, data: any): Promise<MiroItem> {
    return this.fetchApi(`/boards/${boardId}/documents/${itemId}`, {
      method: 'PATCH',
      body: data
    }) as Promise<MiroItem>;
  }

  // Embeds
  async createEmbed(boardId: string, data: {
    url: string;
    position?: { x: number; y: number; origin?: string };
    geometry?: { width?: number; height?: number };
  }): Promise<MiroItem> {
    const embedData = {
      data: { url: data.url },
      position: data.position || { x: 0, y: 0, origin: 'center' },
      geometry: data.geometry || { width: 320, height: 180 }
    };

    return this.fetchApi(`/boards/${boardId}/embeds`, {
      method: 'POST',
      body: embedData
    }) as Promise<MiroItem>;
  }

  async updateEmbed(boardId: string, itemId: string, data: any): Promise<MiroItem> {
    return this.fetchApi(`/boards/${boardId}/embeds/${itemId}`, {
      method: 'PATCH',
      body: data
    }) as Promise<MiroItem>;
  }

  // Bulk Operations
  async bulkCreateItems(boardId: string, items: CreateItemData[]): Promise<MiroItem[]> {
    if (items.length > 20) {
      throw new Error('Cannot create more than 20 items in a single bulk operation');
    }

    const createdItems: MiroItem[] = [];
    for (const item of items) {
      try {
        let createdItem: MiroItem;
        switch (item.type) {
          case 'sticky_note':
            createdItem = await this.createStickyNote(boardId, {
              content: item.data.content,
              color: item.style?.fillColor || 'yellow',
              position: item.position
            });
            break;
          case 'text':
            createdItem = await this.createText(boardId, {
              content: item.data.content,
              position: item.position,
              style: item.style,
              geometry: item.geometry
            });
            break;
          case 'shape':
            createdItem = await this.createShape(boardId, {
              shape: item.data.shape,
              content: item.data.content,
              position: item.position,
              geometry: item.geometry,
              style: item.style
            });
            break;
          case 'card':
            createdItem = await this.createCard(boardId, {
              title: item.data.title,
              description: item.data.description,
              position: item.position,
              style: item.style
            });
            break;
                     case 'frame':
             createdItem = await this.createFrame(boardId, {
               title: item.data.title,
               position: item.position,
               geometry: item.geometry ? { width: item.geometry.width || 400, height: item.geometry.height || 300 } : undefined,
               style: item.style
             });
             break;
          case 'image':
            createdItem = await this.createImage(boardId, {
              url: item.data.url,
              position: item.position,
              geometry: item.geometry
            });
            break;
          case 'document':
            createdItem = await this.createDocument(boardId, {
              url: item.data.url,
              title: item.data.title,
              position: item.position
            });
            break;
          case 'embed':
            createdItem = await this.createEmbed(boardId, {
              url: item.data.url,
              position: item.position,
              geometry: item.geometry
            });
            break;
          default:
            throw new Error(`Unsupported item type: ${item.type}`);
        }
        createdItems.push(createdItem);
      } catch (error) {
        console.error(`Failed to create item of type ${item.type}:`, error);
      }
    }

    return createdItems;
  }

  async bulkUpdateItems(boardId: string, updates: { id: string; data: any }[]): Promise<MiroItem[]> {
    if (updates.length > 20) {
      throw new Error('Cannot update more than 20 items in a single bulk operation');
    }

    const updatedItems: MiroItem[] = [];
    for (const update of updates) {
      try {
        const updatedItem = await this.updateItem(boardId, update.id, update.data);
        updatedItems.push(updatedItem);
      } catch (error) {
        console.error(`Failed to update item ${update.id}:`, error);
      }
    }

    return updatedItems;
  }

  async bulkDeleteItems(boardId: string, itemIds: string[]): Promise<void> {
    if (itemIds.length > 20) {
      throw new Error('Cannot delete more than 20 items in a single bulk operation');
    }

    for (const itemId of itemIds) {
      try {
        await this.deleteItem(boardId, itemId);
      } catch (error) {
        console.error(`Failed to delete item ${itemId}:`, error);
      }
    }
  }

  async bulkCreateConnectors(boardId: string, connectors: {
    startItemId: string;
    endItemId: string;
    caption?: string;
    style?: any;
  }[]): Promise<MiroItem[]> {
    if (connectors.length > 20) {
      throw new Error('Cannot create more than 20 connectors at once');
    }

    const createdConnectors: MiroItem[] = [];
    
    for (const connector of connectors) {
      try {
        const createdConnector = await this.createConnector(boardId, connector);
        createdConnectors.push(createdConnector);
      } catch (error) {
        console.error(`Failed to create connector from ${connector.startItemId} to ${connector.endItemId}:`, error);
      }
    }

    return createdConnectors;
  }

  // Tags
  async getTags(boardId: string): Promise<MiroTag[]> {
    const response = await this.fetchApi(`/boards/${boardId}/tags`) as { data: MiroTag[] };
    return response.data;
  }

  async createTag(boardId: string, data: { title: string; fillColor?: string }): Promise<MiroTag> {
    const tagData = {
      title: data.title,
      fillColor: data.fillColor || 'red' // Use predefined color names
    };

    return this.fetchApi(`/boards/${boardId}/tags`, {
      method: 'POST',
      body: tagData
    }) as Promise<MiroTag>;
  }

  async updateTag(boardId: string, tagId: string, data: { title?: string; fillColor?: string }): Promise<MiroTag> {
    return this.fetchApi(`/boards/${boardId}/tags/${tagId}`, {
      method: 'PATCH',
      body: data
    }) as Promise<MiroTag>;
  }

  async deleteTag(boardId: string, tagId: string): Promise<void> {
    await this.fetchApi(`/boards/${boardId}/tags/${tagId}`, { method: 'DELETE' });
  }

  async attachTagToItem(boardId: string, itemId: string, tagId: string): Promise<void> {
    await this.fetchApi(`/boards/${boardId}/items/${itemId}/tags/${tagId}`, { method: 'POST' });
  }

  async removeTagFromItem(boardId: string, itemId: string, tagId: string): Promise<void> {
    await this.fetchApi(`/boards/${boardId}/items/${itemId}/tags/${tagId}`, { method: 'DELETE' });
  }

  // Groups
  async createGroup(boardId: string, data: {
    itemIds: string[];
    title?: string;
    style?: any;
  }): Promise<MiroGroup> {
    const groupData = {
      itemIds: data.itemIds,
      ...(data.title ? { data: { title: data.title } } : {}),
      style: data.style || { fillColor: '#ffffff' }
    };

    return this.fetchApi(`/boards/${boardId}/groups`, {
      method: 'POST',
      body: groupData
    }) as Promise<MiroGroup>;
  }

  async updateGroup(boardId: string, groupId: string, data: any): Promise<MiroGroup> {
    return this.fetchApi(`/boards/${boardId}/groups/${groupId}`, {
      method: 'PATCH',
      body: data
    }) as Promise<MiroGroup>;
  }

  async deleteGroup(boardId: string, groupId: string): Promise<void> {
    await this.fetchApi(`/boards/${boardId}/groups/${groupId}`, { method: 'DELETE' });
  }

  // Board Members
  async getBoardMembers(boardId: string): Promise<MiroMember[]> {
    const response = await this.fetchApi(`/boards/${boardId}/members`) as { data: MiroMember[] };
    return response.data;
  }

  async shareBoardWithUser(boardId: string, data: {
    email: string;
    role: 'viewer' | 'commenter' | 'editor';
    message?: string;
  }): Promise<MiroMember> {
    return this.fetchApi(`/boards/${boardId}/members`, {
      method: 'POST',
      body: data
    }) as Promise<MiroMember>;
  }

  async updateBoardMember(boardId: string, memberId: string, data: { role: 'viewer' | 'commenter' | 'editor' }): Promise<MiroMember> {
    return this.fetchApi(`/boards/${boardId}/members/${memberId}`, {
      method: 'PATCH',
      body: data
    }) as Promise<MiroMember>;
  }

  async removeBoardMember(boardId: string, memberId: string): Promise<void> {
    await this.fetchApi(`/boards/${boardId}/members/${memberId}`, { method: 'DELETE' });
  }

  // Webhooks (experimental)
  async createWebhook(data: {
    callbackUrl: string;
    boardId: string;
    events: string[];
  }): Promise<MiroWebhook> {
    return this.fetchApi('/webhooks', {
      method: 'POST',
      body: data
    }) as Promise<MiroWebhook>;
  }

  async getWebhooks(): Promise<MiroWebhook[]> {
    const response = await this.fetchApi('/webhooks') as { data: MiroWebhook[] };
    return response.data;
  }

  async updateWebhook(webhookId: string, data: {
    callbackUrl?: string;
    events?: string[];
    status?: 'enabled' | 'disabled';
  }): Promise<MiroWebhook> {
    return this.fetchApi(`/webhooks/${webhookId}`, {
      method: 'PATCH',
      body: data
    }) as Promise<MiroWebhook>;
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    await this.fetchApi(`/webhooks/${webhookId}`, { method: 'DELETE' });
  }

  // Search
  async searchItems(boardId: string, query: string): Promise<MiroItem[]> {
    const response = await this.fetchApi(`/boards/${boardId}/items`, {
      params: { query }
    }) as MiroItemsResponse;
    return response.data;
  }
}