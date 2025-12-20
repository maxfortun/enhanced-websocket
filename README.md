# EnhancedWebSocket: Powerful WebSocket Enhancement for Modern Applications

## Introduction

The **EnhancedWebSocket** module is a drop-in enhancement for the standard WebSocket API that adds powerful features while maintaining full compatibility with native WebSocket implementations. It works seamlessly in both browser and Node.js environments, making it ideal for universal JavaScript applications.

Whether you're building real-time chat applications, live data streaming systems, or collaborative tools, EnhancedWebSocket provides the infrastructure you need with minimal overhead.

## What's Enhanced?

### 1. **JSON Message Parsing**
Automatically parse and stringify JSON messages without boilerplate code.

```javascript
// Automatic JSON handling
ws.sendEnhanced({ type: 'chat', message: 'Hello!' });

// Receive and parse automatically
ws.on('enhanced_message', (msg) => {
  console.log(msg.type); // 'chat'
  console.log(msg.message); // 'Hello!'
});
```

### 2. **Binary Data Transmission with Headers**
Send files and binary data with automatic metadata headers and reconstruction.

```javascript
const file = new Blob(['file content'], { type: 'text/plain' });
await ws.sendEnhancedData({
  req_id: 'file-123',
  data: file,
  metadata: { fileName: 'document.txt' }
});
```

### 3. **SHA256 File Hashing**
Built-in cryptographic hashing for file integrity verification.

```javascript
const file = new Blob(['important data']);
const hash = await ws.fileSha256(file);
console.log(hash); // '3d4f...' (SHA256 hex)
```

### 4. **Request-Response Correlation**
Track requests with automatic timeouts and response matching.

```javascript
// Send request with correlation ID
const response = await ws.sendEnhancedImpl(message, {
  req_id: 'req-456',
  timeout: 30000 // 30 second timeout
});

// Response automatically resolved when server sends matching req_id
console.log(response); // { req_id: 'req-456', result: '...' }
```

### 5. **Stream Message Support**
Handle large files and streaming data with chunked delivery.

```javascript
ws.on('stream_message', (chunk) => {
  console.log('Received chunk:', chunk);
  // Handle streaming data
});
```

### 6. **Recursive Attachment Extraction**
Automatically extract files and blobs from deeply nested objects.

```javascript
const data = {
  user: { name: 'John' },
  avatar: new Blob(['...'], { type: 'image/png' }),
  documents: [
    { file: new Blob(['...']) },
    { nested: { file: new Blob(['...']) } }
  ]
};

const attachments = [];
const extracted = await ws.extractAttachments(data, attachments);
// attachments now contains all Blobs with unique IDs
// extracted contains the same structure with Blob references replaced by IDs
```

## Installation

```bash
npm install @maxfortun/enhanced-websocket
```

### Dependencies
- **Optional**: `debug` (for logging)
- **Optional**: `partysocket` or `ws` (for Node.js)
- **Browser**: Uses native WebSocket

## Quick Start

### Browser Usage

```javascript
import { EnhancedWebSocket } from '@maxfortun/enhanced-websocket';

// Simple WebSocket connection
const ws = EnhancedWebSocket('wss://api.example.com');

// Send enhanced messages
ws.sendEnhanced({ action: 'subscribe', channel: 'news' });

// Listen for messages
ws.on('enhanced_message', (msg) => {
  console.log('Received:', msg);
});

// Send files
const file = await fetch('/document.pdf').then(r => r.blob());
await ws.sendEnhancedData({
  type: 'file_upload',
  data: file
});
```

### Node.js Usage

```javascript
import { EnhancedWebSocket } from '@maxfortun/enhanced-websocket';
import { WebSocket } from 'ws';

// Create connection with custom WebSocket
const ws = EnhancedWebSocket('ws://localhost:8080', {
  WebSocket
});

// Same API as browser
ws.sendEnhanced({ command: 'start' });

ws.on('enhanced_message', (msg) => {
  console.log('Server message:', msg);
});
```

### With Protocols

```javascript
// Add protocols (chat subprotocol)
const ws = EnhancedWebSocket('wss://example.com', ['chat', 'chat-v2']);

// Or with custom WebSocket and protocols
const ws = EnhancedWebSocket(
  'ws://localhost:8080',
  ['protocol1'],
  { WebSocket: CustomWS }
);
```

## Advanced Usage

### Request-Response Pattern with Timeouts

```javascript
import { v4 as uuid } from 'uuid';

// Send a request and wait for response
async function sendQuery(query) {
  const req_id = uuid();
  
  try {
    const response = await ws.sendEnhancedImpl(
      JSON.stringify({ query }),
      {
        req_id,
        timeout: 5000 // 5 second timeout
      }
    );
    
    return response;
  } catch (err) {
    console.error('Request timeout or error:', err);
  }
}

// Usage
const result = await sendQuery('SELECT * FROM users');
```

### File Upload with Progress

```javascript
async function uploadFile(file) {
  const fileId = await ws.fileSha256IdGen(file);
  
  try {
    const response = await ws.sendEnhancedData({
      action: 'upload',
      file,
      fileId,
      size: file.size
    }, {
      req_id: `upload-${fileId}`,
      timeout: 60000
    });
    
    console.log('Upload complete:', response);
  } catch (err) {
    console.error('Upload failed:', err);
  }
}

// Listen for upload progress
ws.on('enhanced_message', (msg) => {
  if (msg.type === 'upload_progress') {
    console.log(`Progress: ${msg.percent}%`);
  }
});
```

### Custom Event Handling

```javascript
// Enhanced messages (regular messages without req_id)
ws.on('enhanced_message', (msg) => {
  console.log('General message:', msg);
});

// Streaming messages (chunked binary data)
ws.on('stream_message', (chunk) => {
  console.log('Stream chunk:', chunk);
  // Handle streaming data here
});

// Standard WebSocket events still work
ws.addEventListener('open', () => {
  console.log('Connected');
});

ws.addEventListener('close', () => {
  console.log('Disconnected');
});

ws.addEventListener('error', (err) => {
  console.error('Error:', err);
});
```

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

### Key APIs Used
| API | Browser | Node.js 12-14 | Node.js 15+ |
|-----|---------|---------------|------------|
| WebSocket | ✅ Native | ⚠️ Install ws | ✅ Install ws |
| TextEncoder | ✅ Native | ⚠️ Buffer | ✅ Native |
| TextDecoder | ✅ Native | ⚠️ Buffer | ✅ Native |
| crypto.subtle | ✅ Native | ❌ crypto module | ✅ Native |

## API Reference

### Constructor

```javascript
EnhancedWebSocket(url, protocols?, options?)

// Parameters:
// - url (string): WebSocket server URL
// - protocols (string | string[] | optional): Protocol(s) to use
// - options (object | optional): Configuration
//   - WebSocket: Custom WebSocket implementation
```

### Methods

#### `sendEnhanced(message, options?)`
Send a message (string or object). Objects are automatically stringified.

```javascript
await ws.sendEnhanced({ action: 'ping' });
await ws.sendEnhanced('plain text message');
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

#### `parseEnhancedMessage(message)`
Parse incoming messages (handles JSON, binary, and plain text).

```javascript
const parsed = await ws.parseEnhancedMessage(event.data);
```

### Events

#### `enhanced_message`
Emitted when a message without `req_id` is received.

```javascript
ws.on('enhanced_message', (msg) => {
  // msg is the parsed message
});
```

#### `stream_message`
Emitted when a streaming message chunk is received.

```javascript
ws.on('stream_message', (chunk) => {
  // chunk is part of a stream
});
```

## Performance Characteristics

### Modern Environments (Browser / Node.js 15+)
- Message parsing: <1ms
- SHA256 hashing: 50-100μs (hardware accelerated)
- Attachment extraction: 1-10ms (depending on size)

### Older Environments (Node.js 12-14)
- Message parsing: <1ms
- SHA256 hashing: 100-500μs (software)
- Attachment extraction: 1-10ms

### Bundle Size
- Minified: ~8KB
- Gzipped: ~3KB
- No required external dependencies

## Best Practices

### 1. Always Handle Timeouts
```javascript
try {
  const response = await ws.sendEnhancedImpl(msg, { 
    req_id: uuid(),
    timeout: 5000 
  });
} catch (err) {
  // Handle timeout
}
```

### 2. Clean Up Resources
```javascript
// Close connection properly
ws.close();

// Clear pending requests
for (const reqId in ws.requests) {
  clearTimeout(ws.requests[reqId].timeout);
}
```

### 3. Validate Message Structure
```javascript
ws.on('enhanced_message', (msg) => {
  if (!msg || typeof msg !== 'object') {
    console.error('Invalid message');
    return;
  }
  // Process valid message
});
```

### 4. Use Unique Request IDs
```javascript
import { v4 as uuid } from 'uuid';

const response = await ws.sendEnhancedImpl(msg, {
  req_id: uuid(), // Always unique
  timeout: 10000
});
```

### 5. Handle Large Files Carefully
```javascript
// For large files, consider chunking
const chunk = file.slice(0, 1024 * 1024); // 1MB chunks
await ws.sendEnhancedData({
  data: chunk,
  chunkIndex: 0,
  totalChunks: Math.ceil(file.size / (1024 * 1024))
});
```

## Common Use Cases

### Real-Time Chat
```javascript
// Send message
ws.sendEnhanced({
  type: 'message',
  user: 'Alice',
  text: 'Hello everyone!',
  timestamp: Date.now()
});

// Receive messages
ws.on('enhanced_message', (msg) => {
  if (msg.type === 'message') {
    updateChatUI(msg.user, msg.text);
  }
});
```

### Live Collaboration
```javascript
// Send document changes
ws.sendEnhanced({
  type: 'edit',
  documentId: 'doc-123',
  changes: [{
    position: 10,
    deleted: 5,
    inserted: 'updated'
  }]
});

// Sync changes from others
ws.on('enhanced_message', (msg) => {
  if (msg.type === 'edit') {
    applyChanges(msg.documentId, msg.changes);
  }
});
```

### File Sharing
```javascript
// Upload file
const file = await selectFile();
await ws.sendEnhancedData({
  type: 'file_share',
  recipient: 'user-456',
  data: file
}, {
  req_id: `share-${Date.now()}`,
  timeout: 60000
});

// Receive files
ws.on('stream_message', (chunk) => {
  saveToLocalStorage(chunk);
});
```

## Troubleshooting

### Messages Not Arriving
- Check WebSocket connection state: `console.log(ws.readyState)`
- Verify message format is valid JSON or string
- Check browser console for errors

### File Upload Fails
- Ensure file size is reasonable
- Check server has sufficient storage
- Verify timeout is long enough: `timeout: 60000` for large files

### Performance Issues
- Reduce message frequency if polling
- Use `sendEnhancedData` for large payloads
- Consider batching small messages

### TypeScript Support
```typescript
interface EnhancedMessage {
  req_id?: string;
  type?: string;
  [key: string]: any;
}

const ws: EnhancedWebSocket = EnhancedWebSocket(
  'ws://localhost:8080'
);
```

## Conclusion

EnhancedWebSocket bridges the gap between basic WebSocket functionality and the advanced features needed by modern real-time applications. With automatic message parsing, file handling, request correlation, and streaming support, it enables developers to build sophisticated real-time systems with less boilerplate code.

Whether you're building a simple chat application or a complex collaborative platform, EnhancedWebSocket provides the tools you need with minimal overhead and maximum compatibility.

---

**Ready to get started?** 

```bash
npm install @maxfortun/enhanced-websocket
```

Then check out the [README.md](./README.md) for detailed API documentation and the [COMPATIBILITY.md](./COMPATIBILITY.md) for environment-specific setup.
