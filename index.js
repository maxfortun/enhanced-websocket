import Debug from 'debug';
import { WebSocket } from 'partysocket';
const debug = Debug('EnhancedWebSocket');

export function EnhancedWebSocket(args) {
	const WebSocketImpl = props.WebSocket  || WebSocket;
	debug('WebSocketImpl:', WebSocketImpl);

	this = new WebSocketImpl(...args);

	this.requests = {};
	
	this.parseEnhancedMessage = async message => {
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

	this.addEventListener('message', async event => {
		try {
			const enhanced_message = await this.parseEnhancedMessage(event.data); 
			
			const req_id = enhanced_message.req_id;
			if(!req_id) {
				debug('Event(no req_id):', enhanced_message);
				this.emit('enhanced_message', enhanced_message);
				return;
			}

			const promise = this.requests[req_id];
			if(!promise) {
				debug('Event(no promise):', enhanced_message);
				this.emit('enhanced_message', enhanced_message);
				return;
			}

			const emitter = promise.emitter || this;
			if(enhanced_message.is_stream) {
				if(!promise.is_stream) {
					promise.is_stream = enhanced_message.is_stream;
					enhanced_message.is_stream_start = true;
					debug('Stream(start):', enhanced_message);
					emitter.emit('stream_message', enhanced_message);
					return;
				}

				if(enhanced_message.is_stream_end) {
					enhanced_message.is_stream_end = true;
					debug('Stream(end):', enhanced_message);
					emitter.emit('stream_message', enhanced_message);
					promise.resolve();
					return;
				}

				debug('Stream(chunk):', enhanced_message);
				emitter.emit('stream_message', enhanced_message);
				return;
			}

			debug('Response:', data);
			clearTimeout(promise?.timeout);
			delete this.requests[req_id];
			emitter.emit('enhanced_message', enhanced_message);
			promise.resolve(enhanced_message);
		} catch(e) {
			debug('Message Error', event, e);
		}
	});

	this.fileSha256 = async file => {
		const buffer = await file.arrayBuffer();

		const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);

		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		
		return hashHex;
	};

	this.fileSha256IdGen = async file => {
		const hashHex = await this.fileSha256(file);
		return '${sha256:' + hashHex + '}';
	};

	this.extractAttachments = async (obj, attachments = [], idGenerator = this.fileSha256IdGen) => {
		if (obj instanceof Blob || obj instanceof File) {
			const id = await idGenerator(obj);
			attachments.push({ id, data: obj });
			return id; // replace with string reference
		} else if (Array.isArray(obj)) {
			return Promise.all(obj.map(item => extractAttachments(item, attachments, idGenerator)));
		} else if (obj && typeof obj === 'object') {
			const result = {};
			for (const key in obj) {
				if (Object.hasOwn(obj, key)) {
					result[key] = await extractAttachments(obj[key], attachments, idGenerator);
				}
			}
			return result;
		}
		return obj; // primitives remain unchanged
	};

	this.sendEnhanced = async (enhanced_message, options = {}) => {
		if (typeof enhanced_message === 'string') {
			return this.sendEnhancedImpl(enhanced_message, options);
		}

		return this.sendEnhancedImpl(JSON.stringify(enhanced_message), options));
	};

	this.sendEnhancedData = async (enhanced_message, options) => {
		if(!enhanced_message.data) {
			return this.sendEnhanced(enhanced_message);
		}

		const attachments = [];
		enhanced_message.data = await this.extractAttachments(enhanced_message.data, attachments);
		if(attachments.length) {
			enhanced_message.is_stream = true;
		}

		const promises = [
			this.sendEnhancedImpl(JSON.stringify(enhanced_message.data), options)
		];

		const {
			attachment_exists
		} = options;

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
		for(let i = attachments.length - 1; i > 0; i--) {
			const attachment = attachments[i];
			if(!attachment.exists) {
				attachment.is_stream_end = true;
				break;
			}
		}

		const encoder = new TextEncoder();
		for(let i = 0; i < attachments.length; i++) {
			if(attachment.exists) {
				debug('Not sent. Attachment exists.', attachment.id);
				continue;
			}

			promises.push(this.sendEnhancedBlob(attachment, enhanced_message));
		});

		return Promise.all(promises);
	};

	this.sendEnhancedBlob = async (enhanced_blob, options = {}) => {
		const header = {
			id: enhanced_blob.id,
			type: enhanced_blob.type,
		};

		if(options.req_id) {
			header.req_id = options.req_id;
		}

		const headerString = JSON.stringify(header);
		const headerBytes = encoder.encode(headerString);
		const headerLength = new ArrayBuffer(4);
		new DataView(headerLength).setUint32(0, headerBytes.length);

		const blob = new Blob([headerLength, headerBytes, enhanced_blob.data], { type: header.type });
		return this.sendEnhancedImpl(blob, options);
	};

	this.sendEnhancedImpl = async (message, options = {}) => {
		if(this.readyState != this.OPEN) {
			debug('Not sent', this.readyState, enhanced_message);
			return;
		}

		const {
			req_id,
			emitter,
			timeout = 30000,
		} = options;

		return new Promise((resolve, reject) => {
			debug('Send', message);
			this.send(message);
			if(req_id) {
				this.requests[req_id] = {
					created: new Date(),
					ttl: timeout,
					resolve,
					reject,
					emitter,
					timeout: setTimeout(() => {
						debug('Response timeout', message);
						clearTimeout(this.requests[req_id]?.timeout);
						delete this.requests[req_id];
						reject(new Error('Timeout waiting for '+req_id+' response'));
					}, timeout)
				};
			}
		});
	};
}

