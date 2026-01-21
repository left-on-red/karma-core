import { ChatInputCommandInteraction, Client, Guild, type ClientOptions } from 'discord.js';
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

	constructor(options: ClientOptions) {
		super(options);
		this.logger = new LoggingManager(null);
	}

	setLogDirectory(logDirectory: string) {
		this.logger = new LoggingManager(logDirectory);
	}

	async useCommandUpdater(commands: AssetManager<C>, guild: Guild) {
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

	useCommands(constructor: Constructor<C>, commands: AssetManager<C>, createContext: (interaction: ChatInputCommandInteraction<'cached'>) => B) {
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
							autocompleter(interaction, this as any as A);
						}
					}
				}
			}
		});

		const command = new constructor({
			name: 'slash',
			description: 'manage slash commands',
		});
		
		command.command('list', 'list all of the slash commands').interact(async context => {
			const slashes = commands.getAll();
			let globals = Array.from(await context.bot.application?.commands.fetch() ?? [], ([,value]) => value).map(v => v.name);
			let locals = Array.from(await context.guild.commands.fetch(), ([,value]) => value).map(v => v.name);

			let globalLines = slashes.filter(v => globals.includes(v.name)).map(v => `- ${v.name}`);
			let localLines = slashes.filter(v => locals.includes(v.name)).map(v => `- ${v.name}`);
			let unregisteredLines = slashes.filter(v => !globals.includes(v.name) && !locals.includes(v.name)).map(v => `- ${v.name}`);

			if (globalLines.length == 0) { globalLines.push('`<none>`'); }
			if (localLines.length == 0) { localLines.push('`<none>`'); }
			if (unregisteredLines.length == 0) { unregisteredLines.push('`<none>`'); }

			let lines = [
				'__**globals**__',
				...globalLines,
				'',
				'__**locals**__',
				...localLines,
				'',
				'__**unregistered**__',
				...unregisteredLines
			];

			context.reply(lines.join('\n'));
		});

		command.group('register', 'register a slash command')
			.command('local', 'register a local slash command. immediate propogation')
				.string('name', 'the name of the slash command').required()
				.interact(async context => {
					const name = context.getOption<string>('name', true).toLowerCase();
					const slash = commands.get(name);
					if (slash === null) { 
						context.reply(`slash command \`${name}\` does not exist`, true);
					} else {
						context.guild.commands.create(slash.raw());
						context.reply(`registered \`${name}\` locally`, true);
					}
				}).predict(async (interaction, bot) => {
					const slashes = commands.getAll().map(x => x.name).filter(x => x !== 'slash');
					const locals = Array.from(await interaction.guild.commands.fetch(), ([,value]) => value).map(v => v.name);
					const focused = interaction.options.getFocused().toLowerCase();
					const suggests = slashes.filter(v => v.startsWith(focused) && !locals.includes(v));
					interaction.respond(suggests.map(v => ({ name: v, value: v })));
				}).commit()
			.command('global', 'registers a global slash command. propogation may take time')
				.string('name', 'the name of the slash command').required()
				.interact(async context => {
					const name = context.getOption<string>('name', true).toLowerCase();
					
					if (!commands.has(name)) {
						context.reply(`slash command \`${name}\` does not exist`, true);
					} else {
						const slash = commands.get(name);
						context.bot.application?.commands.create(slash.raw());
						context.reply(`registered \`${name}\` globally`, true);
					}
				}).predict(async interaction => {
					const slashes = commands.getAll().map(x => x.name).filter(x => x !== 'slash');
					const globals = Array.from(await interaction.client.application.commands.fetch(), ([,value]) => value).map(v => v.name);
					const focused = interaction.options.getFocused().toLowerCase();
					const suggests = slashes.filter(v => v.startsWith(focused) && !globals.includes(v));
					interaction.respond(suggests.map(v => ({ name: v, value: v })));
				}).commit()

		command.group('unregister', 'unregister a slash command')
			.command('local', 'unregisters a local slash command')
				.string('name', 'the name of the slash command').required()
				.interact(async context => {
					const name = context.getOption<string>('name', true).toLowerCase();
					const command = (await context.guild.commands.fetch()).filter(v => v.name == name).first();
					if (command) {
						await context.guild.commands.delete(command.id);
						context.reply(`unregistered \`${name}\` locally`, true);
					} else {
						context.reply(`slash command \`${name}\` is not registered globally`, true);
					}
				}).predict(async interaction => {
					const locals = Array.from(await interaction.guild.commands.fetch(), ([,value]) => value).map(v => v.name);
					const focused = interaction.options.getFocused().toLowerCase();
					const suggests = locals.filter(x => x.startsWith(focused));
					interaction.respond(suggests.map(v => ({ name: v, value: v })));
				}).commit()
			.command('global', 'unregisters a global slash command')
				.string('name', 'the name of the slash command').required()
				.interact(async context => {
					const name = context.getOption<string>('name', true).toLowerCase();
					const command = (await context.bot.application?.commands.fetch())?.filter(v => v.name == name).first() ?? null;
					if (command !== null) {
						await context.bot.application?.commands.delete(command.id);
						context.reply(`unregistered \`${name}\` globally`, true);
					} else {
						context.reply(`slash command \`${name}\` is not registered globally`, true);
					}
				}).predict(async interaction => {
					const globals = Array.from(await interaction.client.application.commands.fetch(), ([,value]) => value).map(v => v.name);
					const focused = interaction.options.getFocused().toLowerCase();
					const suggests = globals.filter(v => v.startsWith(focused));
					interaction.respond(suggests.map(v => ({ name: v, value: v })));
				}).commit();

		commands.add(command);
	}
}