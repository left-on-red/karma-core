
import EventEmitter from 'events';
import { readdir, stat, watch } from 'fs/promises';
import path from 'path';

interface AssetManagerEvents<T> {
	'loadAsset': [asset: T],
	'reloadAsset': [newAsset: T, oldAsset: T],
	'unloadAsset': [asset: T],
	'observeChanges': [filePath: string],
};

export class AssetManager<T> extends EventEmitter<AssetManagerEvents<T>> {
	assets: Map<string, T>;
	watcherAbortController: AbortController;
	type: Constructor<T>;
	nameResolver: (x: T) => string;

	constructor(type: Constructor<T>, nameResolver: (x: T) => string) {
		super();
		this.assets = new Map<string, T>();
		this.watcherAbortController = new AbortController();
		this.type = type;
		this.nameResolver = nameResolver;
	}

	get(assetName: string): Nullable<T> {
		return this.assets.get(assetName) ?? null;
	}

	getAll(): T[] {
		return [...this.assets.values()];
	}

	// type guarded for when has() is called before get()
	has<K extends string>(assetName: K): this is { get(p: K): T } & this {
		return this.assets.has(assetName);
	}

	async loadFile(filePath: string) {
		let count = 0;
		const stats = await stat(filePath);
		if (stats.isFile()) {
			try {
				// dynamic imports ignore query strings if it's using the file:// protocol (it has to if I want to resolve modules using absolute paths)
				// luckily, tsx makes require and import function basically identically
				// thank god...
				const resolvedPath = require.resolve(filePath);
				const result = require(`${resolvedPath}?v=${Date.now()}`);
				const namespace = Object.keys(result);
				for (const key of namespace) {
					const proto = result[key];
					if (proto.prototype instanceof this.type) {
						const obj: T = new proto();
						const name = this.nameResolver(obj);
						const old = this.assets.get(name) ?? null;
						this.assets.set(name, obj);
						if (old === null) {
							this.emit('loadAsset', obj);
						} else {
							this.emit('reloadAsset', obj, old);
						}
						count++;
					}
				}
			} catch(e) { console.log(e) }
		}
		return count;
	}

	async loadDirectory(directoryPath: string, addWatcher: boolean = false) {
		let count = 0;
		const stats = await stat(directoryPath);
		if (stats.isDirectory()) {
			const children = await readdir(directoryPath);
			for (const child of children) {
				const childPath = directoryPath + path.sep + child;
				const childStats = await stat(childPath);
				if (childStats.isDirectory()) {
					count += await this.loadDirectory(childPath);
				} else if (childStats.isFile()) {
					count += await this.loadFile(childPath);
				}
			}
		}
		if (addWatcher) {
			this.addWatcher(directoryPath);
		}
		return count;
	}

	addWatcher(directoryPath: string) {
		let timeout: Nullable<NodeJS.Timeout> = null;
		const watcher = watch(directoryPath, { signal: this.watcherAbortController.signal, recursive: true, });
		(async () => {
			for await (const { filename } of watcher) {
				if (timeout === null && filename !== null) {
					timeout = setTimeout(() => timeout = null, 500);
					const filePath = path.join(directoryPath, filename);
					if (await this.loadFile(filePath) > 0) {
						this.emit('observeChanges', path.join(path.basename(directoryPath), filename));
						//this.logger.info(`reloaded file: ` + path.basename(directoryPath) + path.sep + filename);
					}
				}
			}
		})();
	}

	clearWatchers() {
		this.watcherAbortController.abort();
	}
}

// export default class Assets {
	

//     static slashes = new Map<string, Slash>();
//     static items = new Map<string, Item>();
//     static souls = new Map<string, Soul>();

//     static watcherAbortController = new AbortController();
//     static logger = LoggingManager.system;

//     static async load(asset: string) {
//         let success = false;
//         try {
//             const absolute = path.join(process.cwd(), 'src', asset);
//             const stats = await stat(absolute);
//             if (stats.isDirectory()) {
//                 const children = await readdir(absolute);
//                 for (const child of children) {
//                     await this.load(path.join(asset, child).split('\\').join('/'));
//                 }
//             } else if (stats.isFile()) {
//                 try {
//                     const result = await import(`./../${asset.split('.').slice(0, -1).join('.')}`);
//                     if (result.default.prototype instanceof Slash) {
//                         const slash: Slash = new result.default();
//                         const previous: Nullable<Slash> = this.slashes.get(slash.name) ?? null;
//                         this.slashes.set(slash.name, slash);

//                         if (previous !== null && JSON.stringify(previous.raw()) !== JSON.stringify(slash.raw())) {
//                             for (const [,guild] of (await context.client.guilds.fetch()).entries()) {
//                                 const detailed = await guild.fetch();
//                                 for (const [,command] of (await detailed.commands.fetch()).entries()) {
//                                     if (command.name === slash.name) {
//                                         await command.edit(slash.raw());
//                                         break;
//                                     }
//                                 }
//                             }

//                             const commands = ((await context.client.application?.commands.fetch())?.entries()) ?? [];
//                             for (const [,command] of commands) {
//                                 if (command.name === slash.name) {
//                                     await command.edit(slash.raw());
//                                 }
//                             }
//                         }
//                         success = true;
//                     } else if (result.default.prototype instanceof Item) {
//                         const item: Item = new result.default();
//                         this.items.set(item.id, item);
//                         success = true;
//                     } else if (result.default.prototype instanceof Soul) {
//                         const soul: Soul = new result.default();
//                         this.souls.set(soul.name, soul);
//                         success = true;
//                     }
//                 } catch {}
//             }
//         } catch {}
//         return success;
//     }

//     static async addWatcher(src: string) {
//         const absolute = path.join(process.cwd(), 'src', src);
//         let timeout: Nullable<NodeJS.Timeout> = null;
//         watch(absolute, { signal: this.watcherAbortController.signal, }, async (_, fileName) => {
//             if (fileName !== null && timeout === null) {
//                 timeout = setTimeout(() => timeout = null, 500);
//                 const affected = path.join(absolute, fileName);
//                 await this.load(affected);
//                 this.logger.info(`reloaded file: ${path.join('src', src, fileName)}`);
//             }
//         });
//     }

//     static clearWatchers() {
//         this.watcherAbortController.abort();
//     }
// }