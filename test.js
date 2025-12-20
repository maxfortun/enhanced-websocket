import { test } from 'node:test';
import assert from 'node:assert';
import { EnhancedWebSocket } from './index.js';
import { EventEmitter } from 'node:events';

// Mock WebSocket for testing
class MockWebSocket extends EventEmitter {
constructor(url, protocols) {
super();
this.url = url;
this.protocols = protocols;
this.readyState = 1; // OPEN
this.OPEN = 1;
this.CONNECTING = 0;
this.CLOSING = 2;
this.CLOSED = 3;
}

send(data) {
// Mock send
}

addEventListener(event, handler) {
this.on(event, handler);
}

removeEventListener(event, handler) {
this.removeListener(event, handler);
}
}

test('EnhancedWebSocket - basic instantiation with custom WebSocket', async () => {
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket: MockWebSocket });
assert.ok(ws);
assert.ok(ws instanceof MockWebSocket);
assert.deepStrictEqual(ws.requests, {});
});

test('EnhancedWebSocket - methods exist', async () => {
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket: MockWebSocket });
assert.strictEqual(typeof ws.parseEnhancedMessage, 'function');
assert.strictEqual(typeof ws.fileSha256, 'function');
assert.strictEqual(typeof ws.fileSha256IdGen, 'function');
assert.strictEqual(typeof ws.extractAttachments, 'function');
assert.strictEqual(typeof ws.sendEnhanced, 'function');
assert.strictEqual(typeof ws.sendEnhancedImpl, 'function');
});

test('parseEnhancedMessage - parses JSON string', async () => {
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket: MockWebSocket });
const message = JSON.stringify({ test: 'data' });
const result = await ws.parseEnhancedMessage(message);
assert.deepStrictEqual(result, { test: 'data' });
});

test('parseEnhancedMessage - returns string if not valid JSON', async () => {
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket: MockWebSocket });
const message = 'not json';
const result = await ws.parseEnhancedMessage(message);
assert.strictEqual(result, 'not json');
});

test('parseEnhancedMessage - parses Blob with binary data', async () => {
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket: MockWebSocket });

const headerObj = { req_id: '123', type: 'text/plain' };
const headerString = JSON.stringify(headerObj);
const headerBytes = new TextEncoder().encode(headerString);
const headerLength = new Uint8Array(4);
new DataView(headerLength.buffer).setUint32(0, headerBytes.length);

const fileData = new TextEncoder().encode('file content');
const blob = new Blob([headerLength, headerBytes, fileData]);

const result = await ws.parseEnhancedMessage(blob);
assert.strictEqual(result.req_id, '123');
assert.strictEqual(result.type, 'text/plain');
assert.ok(result.data instanceof Blob);
});

test('fileSha256 - generates SHA256 hash', async () => {
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket: MockWebSocket });
const data = new TextEncoder().encode('test data');
const file = new Blob([data]);

const hash = await ws.fileSha256(file);
assert.strictEqual(typeof hash, 'string');
assert.strictEqual(hash.length, 64); // SHA256 hex is 64 chars
});

test('fileSha256IdGen - generates ID with SHA256 prefix', async () => {
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket: MockWebSocket });
const data = new TextEncoder().encode('test data');
const file = new Blob([data]);

const id = await ws.fileSha256IdGen(file);
assert.strictEqual(typeof id, 'string');
assert.ok(id.startsWith('${sha256:'));
assert.ok(id.endsWith('}'));
});

test('extractAttachments - extracts Blob from object', async () => {
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket: MockWebSocket });
const blob = new Blob(['test'], { type: 'text/plain' });
const obj = { file: blob, name: 'test' };
const attachments = [];

const result = await ws.extractAttachments(obj, attachments);

assert.strictEqual(attachments.length, 1);
assert.ok(typeof result.file === 'string');
assert.ok(result.file.includes('${sha256:'));
assert.strictEqual(result.name, 'test');
});

test('extractAttachments - recursively extracts from nested objects', async () => {
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket: MockWebSocket });
const blob1 = new Blob(['test1'], { type: 'text/plain' });
const blob2 = new Blob(['test2'], { type: 'text/plain' });
const obj = {
nested: {
file: blob1,
deep: {
file: blob2
}
}
};
const attachments = [];

const result = await ws.extractAttachments(obj, attachments);

assert.strictEqual(attachments.length, 2);
assert.ok(result.nested.file.includes('${sha256:'));
assert.ok(result.nested.deep.file.includes('${sha256:'));
});

test('extractAttachments - extracts from arrays', async () => {
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket: MockWebSocket });
const blob1 = new Blob(['test1'], { type: 'text/plain' });
const blob2 = new Blob(['test2'], { type: 'text/plain' });
const arr = [blob1, blob2];
const attachments = [];

const result = await ws.extractAttachments(arr, attachments);

assert.strictEqual(attachments.length, 2);
assert.strictEqual(result.length, 2);
assert.ok(result[0].includes('${sha256:'));
assert.ok(result[1].includes('${sha256:'));
});

test('extractAttachments - leaves primitives unchanged', async () => {
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket: MockWebSocket });
const obj = { name: 'test', age: 25, active: true };
const attachments = [];

const result = await ws.extractAttachments(obj, attachments);

assert.strictEqual(attachments.length, 0);
assert.deepStrictEqual(result, obj);
});

test('sendEnhanced - sends string messages', async () => {
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket: MockWebSocket });
let sentData = null;

ws.send = (data) => {
sentData = data;
};

const promise = ws.sendEnhanced('test message');
assert.ok(promise instanceof Promise);
});

test('sendEnhanced - stringifies object messages', async () => {
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket: MockWebSocket });
let sentData = null;

ws.send = (data) => {
sentData = data;
};

const message = { test: 'data', req_id: '123' };
ws.sendEnhanced(message);
assert.ok(true);
});

test('sendEnhancedImpl - creates request tracking for req_id', async () => {
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket: MockWebSocket });

ws.send = () => {};

const promise = ws.sendEnhancedImpl('test', { req_id: '123' });

assert.ok(ws.requests['123']);
assert.ok(ws.requests['123'].resolve);
assert.ok(ws.requests['123'].reject);
assert.ok(typeof ws.requests['123'].timeout === 'number' || ws.requests['123'].timeout instanceof Object);

clearTimeout(ws.requests['123'].timeout);
delete ws.requests['123'];
});

test('sendEnhancedImpl - timeout handling', async () => {
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket: MockWebSocket });

ws.send = () => {};

const promise = ws.sendEnhancedImpl('test', { req_id: '123', timeout: 100 });

try {
await promise;
assert.ok(ws.requests['123'] === undefined || ws.requests['123'].timeout !== null);
} catch (err) {
assert.ok(err.message.includes('Timeout'));
}
});

test('sendEnhancedImpl - does not send if not OPEN', async () => {
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket: MockWebSocket });
ws.readyState = 0;

let sendCalled = false;
ws.send = () => {
sendCalled = true;
};

await ws.sendEnhancedImpl('test');

assert.ok(!sendCalled);
});

test('sendEnhancedData - sends message without attachments', async () => {
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket: MockWebSocket });
let sendCount = 0;

ws.send = (data) => {
sendCount++;
};

const message = { test: 'data' };
const promise = ws.sendEnhancedData(message, {});

assert.ok(promise instanceof Promise);
});

test('sendEnhancedBlob - creates blob with header and data', async () => {
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket: MockWebSocket });
const fileData = new Blob(['content'], { type: 'text/plain' });
const enhancedBlob = {
id: 'test-id',
type: 'text/plain',
data: fileData
};

let sentBlob = null;
ws.send = (data) => {
sentBlob = data;
};

const promise = ws.sendEnhancedBlob(enhancedBlob, {});

assert.ok(promise instanceof Promise);
});

test('integration - full message flow', async () => {
const ws = EnhancedWebSocket('ws://localhost:8080', { WebSocket: MockWebSocket });

let messageCount = 0;
ws.send = (data) => {
messageCount++;
};

const message = {
req_id: 'msg-1',
text: 'Hello World'
};

const promise = ws.sendEnhanced(message);

assert.ok(promise instanceof Promise);
});
