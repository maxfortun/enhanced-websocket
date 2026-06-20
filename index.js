import Debug from 'debug';
import { WebSocket } from 'partysocket';
const debug = Debug('EnhancedWebSocket');

export function EnhancedWebSocket(...allArgs) {
	// Extract options from last argument if it has WebSocket property
	let wsArgs = allArgs;
	let options = {};
	
	if (allArgs.length > 0) {
		const lastArg = allArgs[allArgs.length - 1];
		
		// Only treat as options if it's an object with WebSocket property
		if (typeof lastArg === 'object' && 
		    lastArg !== null &&
		    !Array.isArray(lastArg) &&
		    'WebSocket' in lastArg) {
			
			options = lastArg;
			wsArgs = allArgs.slice(0, -1);
		}
	}
	
	// Get WebSocket implementation
	const WebSocketImpl = options.WebSocket || WebSocket;
	debug('WebSocketImpl:', WebSocketImpl?.name || 'unknown');
	
	// Pass all args to WebSocketImpl
	const ws = new WebSocketImpl(...wsArgs);

	ws.requests = {};
	
	ws.parseEnhancedMessage = async message => {
		if (typeof message === 'string') {
			try {
				return JSON.parse(message);
			} catch(e) {
				debug('parseEnhancedMessage:', e.message, message);
				return message;
			}
		}

		if (message instanceof Blob) {
			const arrayBuffer = await message.arrayBuffer();
		
			const dataView = new DataView(arrayBuffer);
			const headerLength = dataView.getUint32(0); // first 4 bytes
			const headerBytes = new Uint8Array(arrayBuffer, 4, headerLength);
			const decoder = new TextDecoder();
			const headerJson = decoder.decode(headerBytes);
			const enhanced_message = JSON.parse(headerJson);

			const fileBytes = new Uint8Array(arrayBuffer, 4 + headerLength);
			enhanced_message.data = new Blob([fileBytes], { type: enhanced_message.type });
			return enhanced_message;
		}
	};

	ws.addEventListener('message', async event => {
		try {
			const enhanced_message = await ws.parseEnhancedMessage(event.data); 
			
			const req_id = enhanced_message.req_id;
			if(!req_id) {
				debug('Event(no req_id):', enhanced_message);
				const customEvent = new CustomEvent('event_message', { detail: enhanced_message });
				ws.dispatchEvent(customEvent);
				return;
			}

			const promise = ws.requests[req_id];
			if(!promise) {
				debug('Event(no promise):', enhanced_message);
				const customEvent = new CustomEvent('event_message', { detail: enhanced_message });
				ws.dispatchEvent(customEvent);
				return;
			}

			const emitter = promise.emitter || ws;

			// If this is a stream request, wait for is_stream_end before resolving
			if(promise.is_stream) {
				if(enhanced_message.is_stream_end) {
					debug('Stream(end):', enhanced_message);
					clearTimeout(promise?.timeout);
					delete ws.requests[req_id];
					const customEvent = new CustomEvent('stream_message', { detail: enhanced_message });
					emitter.dispatchEvent(customEvent);
					promise.resolve(promise.response || enhanced_message);
					return;
				}

				// Store the main response but don't resolve yet
				if(!promise.response) {
					promise.response = enhanced_message;
					debug('Stream(response stored):', enhanced_message);
				}
				const customEvent = new CustomEvent('stream_message', { detail: enhanced_message });
				emitter.dispatchEvent(customEvent);
				return;
			}

			if(enhanced_message.is_stream) {
				if(!promise.is_stream) {
					promise.is_stream = enhanced_message.is_stream;
					enhanced_message.is_stream_start = true;
					debug('Stream(start):', enhanced_message);
					const customEvent = new CustomEvent('stream_message', { detail: enhanced_message });
					emitter.dispatchEvent(customEvent);
					return;
				}

				if(enhanced_message.is_stream_end) {
					enhanced_message.is_stream_end = true;
					debug('Stream(end):', enhanced_message);
					const customEvent = new CustomEvent('stream_message', { detail: enhanced_message });
					emitter.dispatchEvent(customEvent);
					promise.resolve();
					return;
				}

				debug('Stream(chunk):', enhanced_message);
				const customEvent = new CustomEvent('stream_message', { detail: enhanced_message });
				emitter.dispatchEvent(customEvent);
				return;
			}

			debug('Response:', enhanced_message);
			clearTimeout(promise?.timeout);
			delete ws.requests[req_id];
			const customEvent = new CustomEvent('response_message', { detail: enhanced_message });
			emitter.dispatchEvent(customEvent);
			promise.resolve(enhanced_message);
		} catch(e) {
			debug('Message Error', event, e);
		}
	});

	ws.fileSha256 = async file => {
		const buffer = await file.arrayBuffer();

		const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);

		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		
		return hashHex;
	};

	ws.fileSha256IdGen = async file => {
		const hashHex = await ws.fileSha256(file);
		return `\${sha256:${hashHex}}`;
	};

	ws.extractAttachments = async (obj, attachments = [], idGenerator = ws.fileSha256IdGen) => {
		if (obj instanceof Blob || obj instanceof File) {
			const id = await idGenerator(obj);
			attachments.push({ id, data: obj });
			return id; // replace with string reference
		} else if (Array.isArray(obj)) {
			return Promise.all(obj.map(item => ws.extractAttachments(item, attachments, idGenerator)));
		} else if (obj && typeof obj === 'object') {
			const result = {};
			for (const key in obj) {
				if (Object.hasOwn(obj, key)) {
					result[key] = await ws.extractAttachments(obj[key], attachments, idGenerator);
				}
			}
			return result;
		}
		return obj; // primitives remain unchanged
	};

	ws.ensure_req_id = (enhanced_message, options = {}) => {
		if(!enhanced_message.req_id && !options.req_id) {
			options.req_id = crypto.randomUUID();
			enhanced_message.req_id = options.req_id;
		}

		if(!enhanced_message.req_id && options.req_id) {
			enhanced_message.req_id = options.req_id;
		}

		if(!options.req_id && enhanced_message.req_id) {
			options.req_id = enhanced_message.req_id;
		}
	};

	ws.sendEnhanced = async (enhanced_message, options = {}) => {
		if (typeof enhanced_message === 'string') {
			return ws.sendEnhancedImpl(enhanced_message, options);
		}

		ws.ensure_req_id(enhanced_message, options);

		return ws.sendEnhancedImpl(JSON.stringify(enhanced_message), options);
	};

	ws.sendEnhancedData = async (enhanced_message, options = {}) => {
		if(!enhanced_message.data) {
			return ws.sendEnhanced(enhanced_message);
		}

		ws.ensure_req_id(enhanced_message, options);

		const attachments = [];
		enhanced_message.data = await ws.extractAttachments(enhanced_message.data, attachments);
		if(attachments.length) {
			enhanced_message.is_stream = true;
		}

		const promises = [
			ws.sendEnhancedImpl(JSON.stringify(enhanced_message), { ...options, is_stream: enhanced_message.is_stream })
		];

		const {
			attachment_exists
		} = options || {};

		// check which attachments do not need to be sent. Could be large.
		if(attachment_exists) {
			for(let i = 0; i < attachments.length; i++) {
				const attachment = attachments[i];
				if(await attachment_exists(attachment, enhanced_message)) {
					attachment.exists = true;
				}
			}
		}

		// find the stream end
		for(let i = attachments.length - 1; i >= 0; i--) {
			const attachment = attachments[i];
			if(!attachment.exists) {
				attachment.is_stream_end = true;
				break;
			}
		}

		const encoder = new TextEncoder();
		for(let i = 0; i < attachments.length; i++) {
			const attachment = attachments[i];
			if(attachment.exists) {
				debug('Not sent. Attachment exists.', attachment.id);
				continue;
			}

			promises.push(ws.sendEnhancedBlob(attachment, enhanced_message));
		}

		return Promise.all(promises).then(resolved => resolved.length?resolved[0]:null);
	};

	ws.sendEnhancedBlob = async (enhanced_blob, options = {}) => {
		ws.ensure_req_id(enhanced_blob, options);

		const header = {
			id: enhanced_blob.id,
			type: enhanced_blob.type,
		};

		if(options.req_id) {
			header.req_id = options.req_id;
		}

		if(enhanced_blob.is_stream_end) {
			header.is_stream_end = true;
		}

		const headerString = JSON.stringify(header);
		const encoder = new TextEncoder();
		const headerBytes = encoder.encode(headerString);
		const headerLength = new Uint8Array(4);
		new DataView(headerLength.buffer).setUint32(0, headerBytes.length);

		const blob = new Blob([headerLength, headerBytes, enhanced_blob.data], { type: header.type });
		return ws.sendEnhancedImpl(blob, options);
	};

	ws.sendEnhancedImpl = async (message, options = {}) => {
		if(ws.readyState != ws.OPEN) {
			debug('Not sent', ws.readyState, message);
			return;
		}

		const {
			req_id,
			emitter,
			is_stream,
			timeout = 30000,
		} = options;

		return new Promise((resolve, reject) => {
			debug('Send', message);
			ws.send(message);
			if(req_id) {
				// Don't overwrite existing request entry (for streams with multiple sends)
				if(!ws.requests[req_id]) {
					ws.requests[req_id] = {
						created: new Date(),
						ttl: timeout,
						resolve,
						reject,
						emitter,
						is_stream,
						timeout: setTimeout(() => {
							debug('Response timeout', message);
							clearTimeout(ws.requests[req_id]?.timeout);
							delete ws.requests[req_id];
							reject(new Error('Timeout waiting for '+req_id+' response'));
						}, timeout)
					};
				}
			}
		});
	};

	return ws;
}

