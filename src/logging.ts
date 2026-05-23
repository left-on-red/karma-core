import { Writable } from 'stream';
import moment from 'moment';
import { createWriteStream } from 'fs';
import { mkdir, stat } from 'fs/promises';
import colors from 'ansi-colors';
import util from 'util';
import path from 'path';

function trace() {
	const error = new Error();
	const location = error.stack?.split('\n')[3].split('\\')[error.stack.split('\n')[3].split('\\').length - 1] ?? '';
	return location.endsWith(')') ? location.slice(0, -1) : location;
}

function buildLogString(token: string, string: string) {
	const timestamp = `[${moment().format(`HH:mm:ss`)}]`;
	const padding = ''.padEnd(timestamp.length + token.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').length + 1, ' ');
	const lines = string.split('\n');
	for (let l = 0; l < lines.length; l++) {
		const starter = l == 0 ? `${timestamp} ${token}` : padding;
		lines[l] = `${starter} ${lines[l]}`;
	}
	return lines.join('\n');
}

export interface ILogger {
	info: (message: string) => void;
	ok: (message: string) => void;
	warn: (message: string) => void;
	error: (message: string | Error) => void;
	debug: (message: string | Object) => void;
}

export class LoggingStream extends Writable {
	name: string;
	directoryPath: Nullable<string>;
	fileName: Nullable<string> = null;
	mirrors: Writable[] = [];
	stream: Nullable<Writable> = null;
	constructor(name: string, directoryPath: Nullable<string>) {
		super();
		this.name = name;
		this.directoryPath = directoryPath;
	}

	_write(chunk: any, encoding: BufferEncoding, next: (error?: Error | null) => void): void {
		if (this.directoryPath !== null) {
			const newFileName = `${moment().format('MM-DD-YY')}.log`;
			if (this.fileName !== newFileName) {
				this.fileName = newFileName;
				this.stream?.destroy();
			}
			stat(this.directoryPath).catch(() => mkdir(this.directoryPath!, { recursive: true }))
			.finally(() => {
				if (this.stream === null) {
					this.stream = createWriteStream(path.join(this.directoryPath!, this.fileName!));
				}
				this.stream.write(chunk.toString().replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, ''), next);
				for (const mirror of this.mirrors) {
					mirror.write(chunk);
				}
			});
		}
	}

	mirror(stream: Writable) {
		if (!this.mirrors.includes(stream)) {
			this.mirrors.push(stream);
		}
	}

	unmirror(stream: Writable) {
		if (this.mirrors.includes(stream)) {
			const index = this.mirrors.indexOf(stream);
			this.mirrors.splice(index, 1);
		}
	}

	private log(message: string) {
		this.write(`${message}\n`);
	}

	info(message: string) {
		const token = colors.cyan(`[${this.name}/INFO]`);
		this.log(buildLogString(token, message));
	}

	ok(message: string) {
		const token = colors.green(`[${this.name}/OK]`);
		this.log(buildLogString(token, message));
	}

	warn(message: string) {
		const token = colors.yellow(`[${this.name}/WARN]`);
		this.log(buildLogString(token, message));
	}

	error(message: string | Error) {
		const token = colors.bgRed.black(`[${this.name}/ERR]`);
		if (message instanceof Error) { message = message.stack ?? message.message; }
		this.log(buildLogString(token, message));
	}

	debug(message: string | object) {
		const token = colors.blue(`[${this.name}/DEBUG:${trace()}]`);
		if (typeof message == 'object') {
			const obj = util.inspect(message, {
				depth: Infinity,
				colors: true,
				compact: false,
			});
			const arr = obj.split('\n');
			for (let a = 0; a < arr.length; a++) {
				arr[a] = arr[a].padStart(arr[a].length - 2 + (arr[a].search(/\S/) + 2), ' ');
			}
			this.log(buildLogString(token, arr.join('\n')));
		} else {
			this.log(buildLogString(token, message));
		}
	}
}

export class LoggingManager {
	private streams: Map<string, LoggingStream>;
	private directoryPath: Nullable<string> = null;

	constructor() {
		this.streams = new Map<string, LoggingStream>();
	}

	setDirectory(directoryPath: string) {
		this.directoryPath = directoryPath;
		for (const stream of this.streams.values()) {
			stream.directoryPath = path.join(directoryPath, stream.name);
		}
	}

	channel(channelName: string) {
		if (this.streams.has(channelName)) {
			return this.streams.get(channelName);
		} else {
			const stream = new LoggingStream(channelName, this.directoryPath ? path.join(this.directoryPath, channelName) : null);
			this.streams.set(channelName, stream);
			return stream;
		}
	}
}