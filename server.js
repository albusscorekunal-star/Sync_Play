const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

// Rooms: { roomId: { host: wsId, users: Map<wsId, {name, color}>, videoUrl, state: {playing, time, updatedAt} } }
const rooms = new Map();

const COLORS = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#C77DFF','#FF9A3C','#00C9A7','#F72585'];

function broadcast(room, data, excludeId = null) {
  rooms.get(room)?.users.forEach((user, wsId) => {
    const ws = user.ws;
    if (wsId !== excludeId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  });
}

function broadcastAll(room, data) {
  broadcast(room, data, null);
}

function getRoomUsers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return [...room.users.entries()].map(([id, u]) => ({
    id,
    name: u.name,
    color: u.color,
    isHost: id === room.host
  }));
}

wss.on('connection', (ws) => {
  const wsId = uuidv4();
  ws.id = wsId;
  ws.roomId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      case 'create_room': {
        const roomId = Math.random().toString(36).substr(2, 6).toUpperCase();
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        rooms.set(roomId, {
          host: wsId,
          users: new Map([[wsId, { name: msg.name, color, ws }]]),
          videoUrl: '',
          state: { playing: false, time: 0, updatedAt: Date.now() }
        });
        ws.roomId = roomId;
        ws.send(JSON.stringify({
          type: 'room_joined',
          roomId,
          userId: wsId,
          color,
          isHost: true,
          users: getRoomUsers(roomId),
          videoUrl: '',
          state: { playing: false, time: 0 }
        }));
        break;
      }

      case 'join_room': {
        const roomId = msg.roomId?.toUpperCase();
        if (!rooms.has(roomId)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room not found. Check the code and try again.' }));
          return;
        }
        const room = rooms.get(roomId);
        const color = COLORS[room.users.size % COLORS.length];
        room.users.set(wsId, { name: msg.name, color, ws });
        ws.roomId = roomId;

        // Send current state to new joiner
        const elapsed = room.state.playing ? (Date.now() - room.state.updatedAt) / 1000 : 0;
        ws.send(JSON.stringify({
          type: 'room_joined',
          roomId,
          userId: wsId,
          color,
          isHost: false,
          users: getRoomUsers(roomId),
          videoUrl: room.videoUrl,
          state: { playing: room.state.playing, time: room.state.time + elapsed }
        }));

        // Tell everyone else someone joined
        broadcast(roomId, {
          type: 'user_joined',
          userId: wsId,
          name: msg.name,
          color,
          users: getRoomUsers(roomId)
        }, wsId);
        break;
      }

      case 'set_video': {
        const room = rooms.get(ws.roomId);
        if (!room || ws.id !== room.host) return;
        room.videoUrl = msg.url;
        room.state = { playing: false, time: 0, updatedAt: Date.now() };
        broadcastAll(ws.roomId, { type: 'video_set', url: msg.url });
        break;
      }

      case 'play': {
        const room = rooms.get(ws.roomId);
        if (!room || ws.id !== room.host) return;
        room.state = { playing: true, time: msg.time, updatedAt: Date.now() };
        broadcast(ws.roomId, { type: 'play', time: msg.time }, wsId);
        break;
      }

      case 'pause': {
        const room = rooms.get(ws.roomId);
        if (!room || ws.id !== room.host) return;
        room.state = { playing: false, time: msg.time, updatedAt: Date.now() };
        broadcast(ws.roomId, { type: 'pause', time: msg.time }, wsId);
        break;
      }

      case 'seek': {
        const room = rooms.get(ws.roomId);
        if (!room || ws.id !== room.host) return;
        const playing = room.state.playing;
        room.state = { playing, time: msg.time, updatedAt: Date.now() };
        broadcast(ws.roomId, { type: 'seek', time: msg.time, playing }, wsId);
        break;
      }

      case 'chat': {
        const room = rooms.get(ws.roomId);
        if (!room) return;
        const user = room.users.get(wsId);
        broadcastAll(ws.roomId, {
          type: 'chat',
          userId: wsId,
          name: user?.name || 'Unknown',
          color: user?.color || '#fff',
          message: msg.message.slice(0, 300),
          timestamp: Date.now()
        });
        break;
      }

      case 'reaction': {
        const room = rooms.get(ws.roomId);
        if (!room) return;
        const user = room.users.get(wsId);
        broadcastAll(ws.roomId, {
          type: 'reaction',
          userId: wsId,
          name: user?.name || 'Unknown',
          color: user?.color || '#fff',
          emoji: msg.emoji
        });
        break;
      }
    }
  });

  ws.on('close', () => {
    const roomId = ws.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    const user = room.users.get(wsId);
    room.users.delete(wsId);

    if (room.users.size === 0) {
      rooms.delete(roomId);
      return;
    }

    // If host left, assign a new host
    if (room.host === wsId) {
      room.host = room.users.keys().next().value;
    }

    broadcast(roomId, {
      type: 'user_left',
      userId: wsId,
      name: user?.name,
      users: getRoomUsers(roomId),
      newHostId: room.host
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎬 WatchParty server running on http://localhost:${PORT}`);
});
