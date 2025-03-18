import { WebSocketServer } from 'ws';
import http from 'http';
import jwt from 'jsonwebtoken';
import logger from './logger';

class WebSocketService {
  constructor(server) {
    this.wss = new WebSocketServer({ server });
    this.clients = new Map(); // Map to store client connections

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });
  }

  handleConnection(ws, req) {
    try {
      // Extract token from query string
      const token = new URL(req.url, 'ws://localhost').searchParams.get('token');
      
      if (!token) {
        ws.close(1008, 'Token required');
        return;
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;

      // Store client connection
      this.clients.set(userId, ws);

      logger.info(`WebSocket client connected: ${userId}`);

      ws.on('message', (message) => {
        this.handleMessage(userId, message);
      });

      ws.on('close', () => {
        this.clients.delete(userId);
        logger.info(`WebSocket client disconnected: ${userId}`);
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error for client ${userId}:`, error);
      });

    } catch (error) {
      logger.error('WebSocket connection error:', error);
      ws.close(1008, 'Authentication failed');
    }
  }

  handleMessage(userId, message) {
    try {
      const data = JSON.parse(message);
      logger.info(`Received message from ${userId}:`, data);
      // Handle different message types here
    } catch (error) {
      logger.error('Error handling WebSocket message:', error);
    }
  }

  // Send notification to specific user
  sendToUser(userId, data) {
    const client = this.clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  }

  // Broadcast to all connected clients
  broadcast(data, excludeUserId = null) {
    this.clients.forEach((client, userId) => {
      if (userId !== excludeUserId && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }
}

let instance = null;

export const initializeWebSocket = (server) => {
  instance = new WebSocketService(server);
  return instance;
};

export const getWebSocketService = () => {
  if (!instance) {
    throw new Error('WebSocket service not initialized');
  }
  return instance;
}; 