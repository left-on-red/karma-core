import { ChatInputCommandInteraction, Client, Guild, Interaction, type ClientOptions } from 'discord.js';
import { AssetManager } from './assets';
import { KarmaCommand } from './commands';
import { KarmaContext } from './context';
import { LoggingManager } from './logging';

export type KarmaOptions = Partial<{
	logDirectory: string;
	commandDirectory: string;
	masterGuildId: string;
}>;

export class KarmaClient<A extends KarmaClient<A, B, C> = KarmaClient<any, any, any>, B extends KarmaContext<A, B, C> = KarmaContext<any, any, any>, C extends KarmaCommand<A, B, C> = KarmaCommand<any, any, any>> extends Client {
	logger: LoggingManager;
	//commands: AssetManager<C>;

	constructor(options: ClientOptions) {
		super(options);
		this.logger = new LoggingManager(null);
		//this.commands = new AssetManager(commandConstructor, x => x.name);

		// const system = this.logger.channel('system');

		// this.on('clientReady', async () => {
		// 	if (this.isReady()) {
		// 		system.ok(`loaded ${!karmaOptions.commandDirectory ? 0 : await this.commands.loadDirectory(karmaOptions.commandDirectory, true)} slash commands`);
		// 		system.ok(`logged in as ${this.user.tag} (${this.user.id})`);

		// 		const masterGuild = !karmaOptions.masterGuildId ? null : await this.guilds.fetch(karmaOptions.masterGuildId);
			
		// 		if (masterGuild !== null) {
		// 			if (this.commands.has('slash')) {
		// 				const slash = this.commands.get('slash');
		// 				for (const [,command] of (await masterGuild.commands.fetch()).entries()) {
		// 					if (command.name === 'slash') {
		// 						await masterGuild.commands.delete(command);
		// 						break;
		// 					}
		// 				}
		// 				await masterGuild.commands.create(slash.raw());
		// 			}

		// 			// hooking into the asset hot reloading to resend new command data to discord (only commands locally defined on the dev guild)
		// 			this.commands.on('reloadAsset', async (newCommand, oldCommand) => {
		// 				const replacer = (_: any, v: any) => typeof v === 'bigint' ? v.toString() : v;
		// 				if (oldCommand !== null && JSON.stringify(oldCommand.raw(), replacer) !== JSON.stringify(newCommand.raw(), replacer)) {
		// 					for (const [,command] of (await masterGuild.commands.fetch()).entries()) {
		// 						if (command.name === newCommand.name) {
		// 							await command.edit(newCommand.raw());
		// 							break;
		// 						}
		// 					}
		// 				}
		// 			});
		// 		}
		// 	}
		// });
	}

	setLogDirectory(logDirectory: string) {
		this.logger = new LoggingManager(logDirectory);
	}

	async addCommandUpdateHandler(commands: AssetManager<C>, guild: Guild) {
		if (commands.has('slash')) {
			const slash = commands.get('slash');
			for (const [,command] of (await guild.commands.fetch()).entries()) {
				if (command.name === 'slash') {
					await guild.commands.delete(command);
					break;
				}
			}
			await guild.commands.create(slash.raw());
		}

		// hooking into the asset hot reloading to resend new command data to discord (only commands locally defined on the dev guild)
		commands.on('reloadAsset', async (newCommand, oldCommand) => {
			const replacer = (_: any, v: any) => typeof v === 'bigint' ? v.toString() : v;
			if (oldCommand !== null && JSON.stringify(oldCommand.raw(), replacer) !== JSON.stringify(newCommand.raw(), replacer)) {
				for (const [,command] of (await guild.commands.fetch()).entries()) {
					if (command.name === newCommand.name) {
						await command.edit(newCommand.raw());
						break;
					}
				}
			}
		});
	}

	addCommandHandler(commands: AssetManager<C>, createContext: (interaction: ChatInputCommandInteraction<'cached'>) => B) {
		this.on('interactionCreate', (interaction) => {
			if (interaction.inCachedGuild()) {
				if (interaction.isChatInputCommand()) {
					if (commands.has(interaction.commandName)) {
						const command = commands.get(interaction.commandName);
						const executor = command.getExecutor(interaction);
						if (executor !== null) {
							for (const fn of executor) {
								fn(createContext(interaction), interaction.options);
							}
						}
					}
				} else if (interaction.isAutocomplete()) {
					if (commands.has(interaction.commandName)) {
						const command = commands.get(interaction.commandName);
						const autocompleter = command.getAutocompleter(interaction);
						if (autocompleter !== null) {
							// TOOD: find a way to fix? might be hard...
							autocompleter(interaction, this as any as C);
						}
					}
				}
			}
		});
	}
}