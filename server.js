const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const NodeMediaServer = require('node-media-server');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const path = require('path');

// Connect to SQLite database with an absolute path
const dbPath = path.resolve(__dirname, 'streams.db');
const db = new sqlite3.Database(dbPath);

// Create a 'streams' table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS streams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    streamKey TEXT UNIQUE,
    streamName TEXT
  )
`);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files (you might need to customize this based on your project structure)
app.use(express.static('public'));
app.use(express.json());

// WebSocket server
const clients = new Set(); // Track connected clients

// Function to broadcast messages to all connected clients
const broadcast = (message) => {
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.add(ws);

  ws.on('message', (message) => {
    console.log(`Received message: ${message}`);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });
});

// Create a function to extract the stream key from the stream path
// Create a function to extract the stream key from the stream path
const extractStreamName = (streamPath) => {
  // Assuming the stream path is in the format '/live/streamName'
  const parts = streamPath.split('/');
  return parts[2]; // Adjust the index based on your stream path format
};

// Node Media Server configuration
const nms = new NodeMediaServer({
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    allow_origin: '*'
  },
  
});

// Start Node Media Server
nms.run();

nms.on('preConnect', (id, args) => {
  console.log('[NodeEvent on preConnect]', `id=${id} args=${JSON.stringify(args)}`);
  // let session = nms.getSession(id);
  // session.reject();
});

nms.on('postConnect', (id, args) => {
  console.log('[NodeEvent on postConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('doneConnect', (id, args) => {
  console.log('[NodeEvent on doneConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('prePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  // let session = nms.getSession(id);
  // session.reject();
  const streamName = extractStreamName(StreamPath);
    console.log(`Stream started with name: ${streamName}`);
    // Update the stream name in the database
   // db.run('UPDATE streams SET streamName = ? WHERE streamKey = ?', [streamName, args.key]);
});

nms.on('postPublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('prePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  // let session = nms.getSession(id);
  // session.reject();
});

nms.on('postPlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

// Express route to create a new stream
app.post('/createStream', (req, res) => {
  const { streamName } = req.body;
  const streamKey = uuidv4(); // Generate a unique stream key
  db.run('INSERT INTO streams (streamKey, streamName) VALUES (?, ?)', [streamKey, streamName], (err) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create stream' });
    } else {
      res.json({ streamKey });
    }
  });
});

// Express route to get stream information
app.get('/getStream/:streamKey', (req, res) => {
  const { streamKey } = req.params;
  db.get('SELECT * FROM streams WHERE streamKey = ?', [streamKey], (err, row) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to get stream information' });
    } else if (!row) {
      res.status(404).json({ error: 'Stream not found' });
    } else {
      res.json({ streamKey: row.streamKey, streamName: row.streamName });
    }
  });
});

// Express route to end the livestream
app.post('/endLivestream/:streamKey', (req, res) => {
  const { streamKey } = req.params;
  // Add logic to handle the end of the livestream (e.g., update database)
  // For simplicity, let's just remove the stream from the database in this example
  db.run('DELETE FROM streams WHERE streamKey = ?', [streamKey], (err) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to end livestream' });
    } else {
      // Notify connected clients about the end of the livestream
      const message = JSON.stringify({ event: 'livestreamEnded', streamKey });
      broadcast(message);
      res.json({ message: 'Livestream ended successfully' });
    }
  });
});

// Start Express server
const PORT = process.env.PORT || 3004;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
