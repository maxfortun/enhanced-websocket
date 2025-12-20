# enhanced-websocket

An enhanced WebSocket implementation that works in both Node.js and browser environments with support for:
- JSON message parsing
- Binary data handling with SHA256 hashing
- Automatic attachment extraction and reconstruction
- Request/response correlation with timeouts
- Stream message support

## Installation

```bash
npm install @maxfortun/enhanced-websocket
```

## Quick Start

### Browser

```javascript
import { EnhancedWebSocket } from '@maxfortun/enhanced-websocket';

const ws = EnhancedWebSocket('wss://api.example.com');

ws.sendEnhanced({ message: 'Hello' });

ws.on('enhanced_message', (msg) => {
  console.log('Received:', msg);
});
```

### Node.js

```javascript
import { EnhancedWebSocket } from '@maxfortun/enhanced-websocket';

const ws = EnhancedWebSocket('ws://localhost:8080');

ws.sendEnhanced({ message: 'Hello' });

ws.on('enhanced_message', (msg) => {
  console.log('Received:', msg);
});
```

## Constructor

```javascript
EnhancedWebSocket(url, protocols?, options?)

// Parameters:
// - url (string): WebSocket server URL
// - protocols (string | string[] | optional): Protocol(s) to use
// - options (object | optional): Configuration
//   - WebSocket: Custom WebSocket implementation (Node.js)
```

### Examples

```javascript
// Just URL
const ws = EnhancedWebSocket('ws://localhost:8080');

// With protocols
const ws = EnhancedWebSocket('ws://localhost:8080', ['chat', 'v2']);

// With custom WebSocket (Node.js)
import { WebSocket } from 'ws';
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket });

// With protocols and custom WebSocket
const ws = EnhancedWebSocket('ws://localhost:8080', ['chat'], { WebSocket });
```

---

## Message Types

EnhancedWebSocket handles four types of messages:

### 1. String Messages

Plain text messages.

```javascript
// Send
ws.sendEnhanced('Hello, World!');

// Receive
ws.on('enhanced_message', (msg) => {
  console.log(typeof msg === 'string'); // true
});
```

### 2. JSON Messages

Objects automatically stringified on send, parsed on receive.

```javascript
// Send
ws.sendEnhanced({
  type: 'chat',
  user: 'Alice',
  message: 'Hello!',
  timestamp: Date.now()
});

// Receive
ws.on('enhanced_message', (msg) => {
  console.log(msg.type); // 'chat'
  console.log(msg.user); // 'Alice'
});
```

### 3. Blob Messages

Binary data with automatic header encoding/decoding.

```javascript
// Send
const file = new Blob(['binary data'], { type: 'application/octet-stream' });
await ws.sendEnhancedData({
  file: file
});

// Receive via stream
ws.on('stream_message', (chunk) => {
  console.log(chunk.data instanceof Blob); // true
});
```

### 4. JSON with Attachments (Blobs)

Objects containing files or blobs. Attachments automatically extracted, sent separately, and reconstructed on receive.

```javascript
// Send
const file = new Blob(['file content'], { type: 'text/plain' });
await ws.sendEnhancedData({
  type: 'file_upload',
  fileName: 'document.txt',
  data: file,
  metadata: {
    size: file.size,
    uploadedBy: 'Alice'
  }
});

// Receive
ws.on('enhanced_message', (msg) => {
  console.log(msg.type); // 'file_upload'
  console.log(msg.data instanceof Blob); // true
  console.log(msg.metadata.uploadedBy); // 'Alice'
});
```

---

## Communication Patterns

### 1. Fire-and-Forget (One-way Messages)

Send a message without expecting a response.

```javascript
// Send
ws.sendEnhanced({
  type: 'notification',
  message: 'Server is restarting'
});

// Receive
ws.on('enhanced_message', (msg) => {
  if (msg.type === 'notification') {
    console.log(msg.message);
  }
});
```

### 2. Request-Response Pattern

Send a message and wait for a correlated response with automatic timeout.

```javascript
import { v4 as uuid } from 'uuid';

// Send request
const req_id = uuid();
try {
  const response = await ws.sendEnhancedImpl(
    JSON.stringify({ action: 'query', data: 'SELECT *' }),
    {
      req_id,
      timeout: 5000 // 5 second timeout
    }
  );
  console.log('Response:', response);
} catch (err) {
  console.error('Request failed:', err);
}

// Server receives with req_id, must respond with same req_id
ws.on('enhanced_message', (msg) => {
  if (msg.action === 'query') {
    // Process query and send response with same req_id
    ws.sendEnhanced({
      req_id: msg.req_id,
      result: 'query results...'
    });
  }
});
```

### 3. Streaming Pattern

Send large files or data in chunks with automatic stream start/end markers.

```javascript
// Send large file
const largeFile = new Blob(['...large data...']);
await ws.sendEnhancedData({
  type: 'large_file',
  data: largeFile,
  req_id: uuid()
}, {
  req_id: uuid(),
  timeout: 60000
});

// Receive stream chunks
ws.on('stream_message', (chunk) => {
  console.log('Stream chunk:', chunk);
  if (chunk.is_stream_start) {
    console.log('Stream started');
  }
  if (chunk.is_stream_end) {
    console.log('Stream ended');
  }
});
```

### 4. Publish-Subscribe Pattern

Emit messages to a specific channel that multiple listeners can receive.

```javascript
// Publish
ws.sendEnhanced({
  type: 'channel',
  channel: 'news',
  event: 'article_published',
  data: { title: 'Breaking News' }
});

// Subscribe
ws.on('enhanced_message', (msg) => {
  if (msg.type === 'channel' && msg.channel === 'news') {
    if (msg.event === 'article_published') {
      console.log('New article:', msg.data.title);
    }
  }
});
```

---

## Events

### `enhanced_message`

Emitted when a message is received without a `req_id` (one-way messages).

```javascript
ws.on('enhanced_message', (message) => {
  // message is the parsed message (JSON, string, or blob)
  console.log('Received:', message);
});
```

### `stream_message`

Emitted when a chunk of streaming data is received (large files split into chunks).

```javascript
ws.on('stream_message', (chunk) => {
  // chunk.data contains the Blob/binary data
  // chunk.is_stream_start indicates stream start
  // chunk.is_stream_end indicates stream end
  
  if (chunk.is_stream_start) {
    console.log('Stream started');
  } else if (chunk.is_stream_end) {
    console.log('Stream complete');
  } else {
    // Process chunk
    console.log('Received chunk:', chunk.data);
  }
});
```

### Standard WebSocket Events

Standard WebSocket events still work:

```javascript
ws.addEventListener('open', () => console.log('Connected'));
ws.addEventListener('close', () => console.log('Disconnected'));
ws.addEventListener('error', (err) => console.error('Error:', err));
```

---

## API Reference

### Methods

#### `sendEnhanced(message, options?)`
Send a message (string or object). Objects are automatically stringified.

```javascript
await ws.sendEnhanced({ type: 'ping' });
await ws.sendEnhanced('plain text');
```

#### `sendEnhancedData(message, options?)`
Send a message with optional file/blob attachments. Automatically extracts attachments.

```javascript
await ws.sendEnhancedData({
  text: 'Check this file',
  file: blob,
  timestamp: Date.now()
});
```

#### `sendEnhancedImpl(message, options?)`
Low-level method for sending messages with correlation IDs and timeouts.

```javascript
const response = await ws.sendEnhancedImpl(message, {
  req_id: 'unique-id',
  timeout: 5000
});
```

#### `parseEnhancedMessage(message)`
Parse incoming messages (handles JSON, binary, and plain text).

```javascript
const parsed = await ws.parseEnhancedMessage(event.data);
```

#### `fileSha256(file)`
Calculate SHA256 hash of a file or blob.

```javascript
const hash = await ws.fileSha256(file);
```

#### `fileSha256IdGen(file)`
Generate a unique ID based on file's SHA256 hash.

```javascript
const id = await ws.fileSha256IdGen(file);
// Returns: '${sha256:a1b2c3...}'
```

#### `extractAttachments(obj, attachments?, idGenerator?)`
Recursively extract blobs/files from objects and arrays.

```javascript
const attachments = [];
const cleaned = await ws.extractAttachments(data, attachments);
// attachments: Array of { id, data } objects
// cleaned: Same structure with blobs replaced by ID strings
```

---

## Compatibility

### Browser Support
- ✅ Chrome 38+ (2014)
- ✅ Firefox 35+ (2014)
- ✅ Safari 10.1+ (2016)
- ✅ Edge (all versions)
- ✅ Opera 25+ (2014)

### Node.js Support
- ✅ v12.0.0+ (with fallbacks)
- ✅ v15.0.0+ (full native support)
- ✅ v16.0.0+ (recommended)

### API Compatibility

| API | Browser | Node.js 12-14 | Node.js 15+ |
|-----|---------|---------------|------------|
| TextEncoder | ✅ Native | ⚠️ Buffer | ✅ Native |
| TextDecoder | ✅ Native | ⚠️ Buffer | ✅ Native |
| crypto.subtle | ✅ Native | ❌ Fallback | ✅ Native |
| Blob API | ✅ Native | ⚠️ Compatible | ✅ Native |
| WebSocket | ✅ Native | ⚠️ Install ws | ✅ Install ws |

---

## Configuration

### Node.js with specific WebSocket library

```javascript
import { WebSocket } from 'ws';

const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket });
```

### Debug Output

Enable debug logging:

```bash
# Node.js
DEBUG=EnhancedWebSocket node app.js
```

---

## Testing

```bash
npm test
```

Runs 19 comprehensive tests covering all functionality.

## License

MIT
