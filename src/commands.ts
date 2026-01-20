import { KarmaClient } from './client';
import { KarmaContext } from './context';
import { type PermissionResolvable } from './permissions';
import Discord from 'discord.js';

type CommandInteractionOptions = Omit<
	Discord.CommandInteractionOptionResolver<'cached'>,
	| 'getMessage'
	| 'getFocused'
	| 'getMentionable'
	| 'getRole'
	| 'getAttachment'
	| 'getNumber'
	| 'getInteger'
	| 'getString'
	| 'getChannel'
	| 'getBoolean'
	| 'getSubcommandGroup'
	| 'getSubcommand'
>

type InteractionFunction<A extends KarmaClient<A, B, C>, B extends KarmaContext<A, B, C>, C extends KarmaCommand<A, B, C>> = (context: KarmaContext<A, B, C>, options: CommandInteractionOptions) => void;
type PredictionFunction<A extends KarmaClient<A, B, C>, B extends KarmaContext<A, B, C>, C extends KarmaCommand<A, B, C>> = (interaction: Discord.AutocompleteInteraction<'cached'>, client: C) => void;

class CommandOption<A extends KarmaClient<A, B, C>, B extends KarmaContext<A, B, C>, C extends KarmaCommand<A, B, C>> {
	name: string;
	description: string;
	onInteract: Nullable<InteractionFunction<A, B, C>> = null;

	constructor(name: string, description: string) {
		this.name = name;
		this.description = description;
	}
}

class CommandBase<A extends KarmaClient<A, B, C>, B extends KarmaContext<A, B, C>, C extends KarmaCommand<A, B, C>> extends CommandOption<A, B, C> {
	options: CommandOption<A, B, C>[] = [];

	constructor(name: string, description: string) {
		super(name, description);
	}

	private buildOption(constructor: Constructor<CommandPrimitive<A, B, C>>, name: string, description: string) {
		const option = new constructor(name, description);
		this.options.push(option);
		return this;
	}

	string(name: string, description: string) { return this.buildOption(CommandString, name, description); }
	integer(name: string, description: string) { return this.buildOption(CommandInteger, name, description); }
	number(name: string, description: string) { return this.buildOption(CommandNumber, name, description); }
	boolean(name: string, description: string) { return this.buildOption(CommandBoolean, name, description); }
	user(name: string, description: string) { return this.buildOption(CommandUser, name, description); }
	role(name: string, description: string) { return this.buildOption(CommandRole, name, description); }
	channel(name: string, description: string) { return this.buildOption(CommandChannel, name, description); }
	mentionable(name: string, description: string) { return this.buildOption(CommandMentionable, name, description); }
	attachment(name: string, description: string) { return this.buildOption(CommandAttachment, name, description); }

	required() {
		const option = this.options[this.options.length - 1];
		if (option !== undefined && option instanceof CommandPrimitive) { option.required = true; }
		return this;
	}

	choices(value: Discord.ApplicationCommandOptionChoiceData[]) {
		const option = this.options[this.options.length - 1];
		if (option === undefined) { return this; }
		else if (option instanceof CommandInteger || option instanceof CommandNumber) { option.choices = value as any as Discord.ApplicationCommandOptionChoiceData<number>[]; }
		else if (option instanceof CommandString) { option.choices = value as any as Discord.ApplicationCommandOptionChoiceData<string>[]; }
		return this;
	}

	maxValue(value: number) {
		const option = this.options[this.options.length - 1];
		if (option === undefined) { return this; }
		if (option instanceof CommandInteger || option instanceof CommandNumber) { option.maxValue = value; }
		return this;
	}

	minValue(value: number) {
		const option = this.options[this.options.length - 1];
		if (option === undefined) { return this; }
		if (option instanceof CommandInteger || option instanceof CommandNumber) { option.minValue = value; }
		return this;
	}

	maxLength(value: number) {
		const option = this.options[this.options.length - 1];
		if (option !== undefined && option instanceof CommandString) { option.maxLength = value; }
		return this;
	}

	minLength(value: number) {
		const option = this.options[this.options.length - 1];
		if (option !== undefined && option instanceof CommandString) { option.minLength = value; }
		return this;
	}

	channelTypes(value: Discord.ChannelType[]) {
		const option = this.options[this.options.length - 1];
		if (option !== undefined && option instanceof CommandChannel) { option.channelTypes = value; }
		return this;
	}

	interact(fn: InteractionFunction<A, B, C>) {
		const option = this.options[this.options.length - 1];
		if (option === undefined || !(option instanceof CommandPrimitive)) { this.onInteract = fn; }
		else { option.onInteract = fn; }
		return this;
	}

	predict(fn: PredictionFunction<A, B, C>) {
		const option = this.options[this.options.length - 1];
		if (option !== undefined  && (option instanceof CommandString || option instanceof CommandInteger || option instanceof CommandNumber)) {
			option.onPredict = fn;
			option.autocomplete = true;
		}
		return this;
	}
}

class CommandPrimitive<A extends KarmaClient<A, B, C>, B extends KarmaContext<A, B, C>, C extends KarmaCommand<A, B, C>> extends CommandOption<A, B, C> {
	required: boolean = false;

	constructor(name: string, description: string) {
		super(name, description);
	}

	rawPrimitive(type: Discord.ApplicationCommandOptionType) {
		return {
			type,
			name: this.name,
			description: this.description,
			required: this.required
		}
	}
}

class SubcommandGroup<A extends KarmaClient<A, B, C>, B extends KarmaContext<A, B, C>, C extends KarmaCommand<A, B, C>> extends CommandOption<A, B, C> {
	parent: KarmaCommand<A, B, C>;
	options: Subcommand<A, B, C>[] = [];

	constructor(parent: KarmaCommand<A, B, C>, name: string, description: string) {
		super(name, description);
		this.parent = parent;
	}

	command(name: string, description: string) {
		const option = new Subcommand<A, B, C>(this, name, description);
		this.options.push(option);
		return option;
	}

	commit() { return this.parent; }

	raw() {
		return {
			name: this.name,
			description: this.description,
			type: Discord.ApplicationCommandOptionType.SubcommandGroup,
			options: this.options.map(x => x.raw())
		} as Discord.ApplicationCommandSubGroupData
	}
}

class Subcommand<A extends KarmaClient<A, B, C>, B extends KarmaContext<A, B, C>, C extends KarmaCommand<A, B, C>> extends CommandBase<A, B, C> {
	parent: KarmaCommand<A, B, C> | SubcommandGroup<A, B, C>;
	declare options: CommandPrimitive<A, B, C>[];
	constructor(parent: KarmaCommand<A, B, C> | SubcommandGroup<A, B, C>, name: string, description: string) {
		super(name, description);
		this.parent = parent;
	}

	commit() { return this.parent; }

	raw() {
		const options = this.options.map(x => {
			if (x instanceof CommandString
			|| x instanceof CommandInteger
			|| x instanceof CommandNumber
			|| x instanceof CommandBoolean
			|| x instanceof CommandUser
			|| x instanceof CommandRole
			|| x instanceof CommandChannel
			|| x instanceof CommandMentionable
			|| x instanceof CommandAttachment) { return x.raw(); }
			else { return null; }
		}).filter(x => x !== null);

		return {
			name: this.name,
			description: this.description,
			type: Discord.ApplicationCommandOptionType.Subcommand,
			options
		} as Discord.ApplicationCommandSubCommandData;
	}
}

class CommandString<A extends KarmaClient<A, B, C>, B extends KarmaContext<A, B, C>, C extends KarmaCommand<A, B, C>> extends CommandPrimitive<A, B, C> {
	autocomplete: boolean = false;
	minLength: Nullable<number> = null;
	maxLength: Nullable<number> = null;
	choices: Nullable<Discord.ApplicationCommandOptionChoiceData<string>[]> = null;
	onPredict: Nullable<PredictionFunction<A, B, C>> = null;

	constructor(name: string, description: string) {
		super(name, description);
	}

	raw() {
		return {
			...this.rawPrimitive(Discord.ApplicationCommandOptionType.String),
			autocomplete: this.autocomplete,
			choices: this.choices ?? undefined,
			minLength: this.minLength ?? undefined,
			maxLength: this.maxLength ?? undefined,
		} as Discord.ApplicationCommandStringOptionData;
	}
}

class CommandInteger<A extends KarmaClient<A, B, C>, B extends KarmaContext<A, B, C>, C extends KarmaCommand<A, B, C>> extends CommandPrimitive<A, B, C> {
	autocomplete: boolean = false;
	minValue: Nullable<number> = null;
	maxValue: Nullable<number> = null;
	choices: Nullable<Discord.ApplicationCommandOptionChoiceData<number>[]> = null;
	onPredict: Nullable<PredictionFunction<A, B, C>> = null;

	constructor(name: string, description: string) {
		super(name, description);
	}

	raw() {
		return {
			...this.rawPrimitive(Discord.ApplicationCommandOptionType.Integer),
			autocomplete: this.autocomplete,
			choices: this.choices ?? undefined,
			minValue: this.minValue ?? undefined,
			maxValue: this.maxValue ?? undefined,
		} as Discord.ApplicationCommandNumericOptionData;
	}
}

class CommandNumber<A extends KarmaClient<A, B, C>, B extends KarmaContext<A, B, C>, C extends KarmaCommand<A, B, C>> extends CommandInteger<A, B, C> {
	constructor(name: string, description: string) {
		super(name, description);
	}

	raw() {
		return {
			...this.rawPrimitive(Discord.ApplicationCommandOptionType.Number),
			autocomplete: this.autocomplete,
			choices: this.choices ?? undefined,
			minValue: this.minValue ?? undefined,
			maxValue: this.maxValue ?? undefined,
		} as Discord.ApplicationCommandNumericOptionData;
	}
}

class CommandBoolean<A extends KarmaClient<A, B, C>, B extends KarmaContext<A, B, C>, C extends KarmaCommand<A, B, C>> extends CommandPrimitive<A, B, C> {
	constructor(name: string, description: string) {
		super(name, description);
	}

	raw() { return this.rawPrimitive(Discord.ApplicationCommandOptionType.Boolean) as Discord.ApplicationCommandBooleanOptionData; }
}

class CommandUser<A extends KarmaClient<A, B, C>, B extends KarmaContext<A, B, C>, C extends KarmaCommand<A, B, C>> extends CommandPrimitive<A, B, C> {
	constructor(name: string, description: string) {
		super(name, description);
	}

	raw() { return this.rawPrimitive(Discord.ApplicationCommandOptionType.User) as Discord.ApplicationCommandUserOptionData; }
}

class CommandRole<A extends KarmaClient<A, B, C>, B extends KarmaContext<A, B, C>, C extends KarmaCommand<A, B, C>> extends CommandPrimitive<A, B, C> {
	constructor(name: string, description: string) {
		super(name, description);
	}

	raw() { return this.rawPrimitive(Discord.ApplicationCommandOptionType.Role) as Discord.BaseApplicationCommandOptionsData; }
}

class CommandChannel<A extends KarmaClient<A, B, C>, B extends KarmaContext<A, B, C>, C extends KarmaCommand<A, B, C>> extends CommandPrimitive<A, B, C> {
	channelTypes: Nullable<Discord.ChannelType[]> = null;

	constructor(name: string, description: string) {
		super(name, description);
	}

	raw() {
		return {
			...this.rawPrimitive(Discord.ApplicationCommandOptionType.Channel),
			channelTypes: this.channelTypes ?? undefined,
		} as Discord.ApplicationCommandChannelOptionData;
	}
}

class CommandMentionable<A extends KarmaClient<A, B, C>, B extends KarmaContext<A, B, C>, C extends KarmaCommand<A, B, C>> extends CommandPrimitive<A, B, C> {
	constructor(name: string, description: string) {
		super(name, description);
	}

	raw() { return this.rawPrimitive(Discord.ApplicationCommandOptionType.Mentionable) as Discord.BaseApplicationCommandOptionsData; }
}

class CommandAttachment<A extends KarmaClient<A, B, C>, B extends KarmaContext<A, B, C>, C extends KarmaCommand<A, B, C>> extends CommandPrimitive<A, B, C> {
	constructor(name: string, description: string) {
		super(name, description);
	}

	raw() { return this.rawPrimitive(Discord.ApplicationCommandOptionType.Attachment) as Discord.BaseApplicationCommandOptionsData; }
}

type CommandArgs<A extends KarmaClient<A, B, C>, B extends KarmaContext<A, B, C>, C extends KarmaCommand<A, B, C>> = {
	name: string,
	description: string,
	category?: string,
	nsfw?: boolean,
	permissions?: PermissionResolvable<A, B, C>[]
}

export class KarmaCommand<A extends KarmaClient<A, B, C> = KarmaClient<any, any, any>, B extends KarmaContext<A, B, C> = KarmaContext<any, any, any>, C extends KarmaCommand<A, B, C> = KarmaCommand<any, any, any>> extends CommandBase<A, B, C> {
	category: string = 'uncategorized';
	nsfw: boolean = false;
	permissions: PermissionResolvable<A, B, C>[] = [];

	constructor({ name, description, category, nsfw, permissions }: CommandArgs<A, B, C>) {
		super(name, description);
		if (category !== undefined) { this.category = category; }
		if (nsfw !== undefined) { this.nsfw = nsfw; }
		if (permissions !== undefined) { this.permissions = permissions; }
	}

	command(name: string, description: string) {
		const option = new Subcommand<A, B, C>(this, name, description);
		this.options.push(option);
		return option;
	}

	group(name: string, description: string) {
		const option = new SubcommandGroup<A, B, C>(this, name, description);
		this.options.push(option);
		return option;
	}

	getExecutor(interaction: Discord.ChatInputCommandInteraction<'cached'>) {
		const complex = [Discord.ApplicationCommandOptionType.SubcommandGroup, Discord.ApplicationCommandOptionType.Subcommand];
		const functions: InteractionFunction<A, B, C>[] = this.onInteract === null ? [] : [this.onInteract];
		function traverse(options: readonly Discord.CommandInteractionOption<'cached'>[], slashes: CommandOption<A, B, C>[]) {
			for (const option of options) {
				for (const slash of slashes) {
					if (option.name === slash.name) {
						if (slash.onInteract !== null) { functions.unshift(slash.onInteract); }
						if (complex.includes(option.type) && option.options && (slash instanceof SubcommandGroup || slash instanceof Subcommand)) {
							traverse(option.options, slash.options);
						}
					}
				} 
			}
		}

		traverse(interaction.options.data, this.options);
		if (functions.length > 0) {
			return functions;
		} else {
			return null;
		}
	}

	getAutocompleter(interaction: Discord.AutocompleteInteraction<'cached'>) {
		const complex = [Discord.ApplicationCommandOptionType.SubcommandGroup, Discord.ApplicationCommandOptionType.Subcommand];
		const functions: PredictionFunction<A, B, C>[] = [];
		function traverse(options: readonly Discord.CommandInteractionOption<'cached'>[], slashes: CommandOption<A, B, C>[]) {
			for (const option of options) {
				for (const slash of slashes) {
					if (option.name === slash.name) {
						if (slash instanceof CommandString || slash instanceof CommandInteger || slash instanceof CommandNumber) {
							if (slash.onPredict !== null) { functions.unshift(slash.onPredict); }
						} else if (complex.includes(option.type) && option.options && (slash instanceof SubcommandGroup || slash instanceof Subcommand)) {
							traverse(option.options, slash.options);
						}
					}
				} 
			}
		}

		traverse(interaction.options.data, this.options);
		if (functions.length > 0) {
			return functions[0];
		} else {
			return null;
		}
	}

	raw() {
		return {
			name: this.name,
			description: this.description,
			nsfw: this.nsfw,
			defaultMemberPermissions: this.permissions.filter(x => typeof x === 'bigint'),
			type: Discord.ApplicationCommandType.ChatInput,
			options: this.options.map(x => (x as any).raw())
		} as Discord.ApplicationCommandData
	}
}