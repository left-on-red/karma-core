import { Client, type ClientOptions } from 'discord.js';
import { AssetManager } from './assets';
import { KarmaCommand } from './commands';
import { KarmaContext } from './context';
import { LoggingManager } from './logging';

export type KarmaOptions = Partial<{
	logDirectory: string;
	commandDirectory: string;
	masterGuildId: string;
}>;

export class KarmaClient<A extends KarmaContext<A, B, C>, B extends KarmaCommand<A, B, C>, C extends KarmaClient<A, B, C>> extends Client {
	logger: LoggingManager;
	commands: AssetManager<B>;

	constructor(discordOptions: ClientOptions, karmaOptions: KarmaOptions, commandConstructor: Constructor<B>) {
		super(discordOptions);
		this.logger = new LoggingManager(karmaOptions.logDirectory ?? null);
		this.commands = new AssetManager(commandConstructor, x => x.name);

		const system = this.logger.channel('system');

		this.on('clientReady', async () => {
			if (this.isReady()) {
				system.ok(`loaded ${!karmaOptions.commandDirectory ? 0 : await this.commands.loadDirectory(karmaOptions.commandDirectory, true)} slash commands`);
				system.ok(`logged in as ${this.user.tag} (${this.user.id})`);

				const masterGuild = !karmaOptions.masterGuildId ? null : await this.guilds.fetch(karmaOptions.masterGuildId);
			
				if (masterGuild !== null) {
					if (this.commands.has('slash')) {
						const slash = this.commands.get('slash');
						for (const [,command] of (await masterGuild.commands.fetch()).entries()) {
							if (command.name === 'slash') {
								await masterGuild.commands.delete(command);
								break;
							}
						}
						await masterGuild.commands.create(slash.raw());
					}

					// hooking into the asset hot reloading to resend new command data to discord (only commands locally defined on the dev guild)
					this.commands.on('reloadAsset', async (newCommand, oldCommand) => {
						const replacer = (_: any, v: any) => typeof v === 'bigint' ? v.toString() : v;
						if (oldCommand !== null && JSON.stringify(oldCommand.raw(), replacer) !== JSON.stringify(newCommand.raw(), replacer)) {
							for (const [,command] of (await masterGuild.commands.fetch()).entries()) {
								if (command.name === newCommand.name) {
									await command.edit(newCommand.raw());
									break;
								}
							}
						}
					});
				}
			}
		});
	}
}