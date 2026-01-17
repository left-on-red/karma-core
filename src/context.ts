import {
	MessageFlags,
	type Attachment,
	type Channel,
	type ChatInputCommandInteraction,
	type Guild,
	type GuildMember,
	type GuildTextBasedChannel,
	type InteractionEditReplyOptions,
	type InteractionReplyOptions,
	type InteractionResponse,
	type Message,
	type MessageResolvable,
	type Role,
	type User
} from 'discord.js';
import { KarmaClient } from './client';
import { KarmaCommand } from './commands';
import type { LoggingStream } from './logging';
import { type PermissionResolvable } from './permissions';

type OptionType = string | number | boolean | User | GuildMember | Channel | Role | Attachment;

export class KarmaContext<A extends KarmaContext<A, B, C>, B extends KarmaCommand<A, B, C>, C extends KarmaClient<A, B, C>> {
	client: KarmaClient<A, B, C>;
	loggingChannel: LoggingStream;

	interaction: ChatInputCommandInteraction<'cached'>;
	user: User;
	member: GuildMember;
	channel: GuildTextBasedChannel;
	guild: Guild;

	info(message: string) { return this.loggingChannel.info(message); }
	ok(message: string) { return this.loggingChannel.ok(message); }
	warn(message: string) { return this.loggingChannel.warn(message); }
	error(message: string | Error) { return this.loggingChannel.error(message); }
	debug(message: string | Object) { return this.loggingChannel.debug(message); }

	constructor(client: KarmaClient<A, B, C>, interaction: ChatInputCommandInteraction<'cached'>) {
		this.client = client;
		this.loggingChannel = this.client.logger.channel(interaction.channel!.id.toString());

		this.interaction = interaction;
		this.user = interaction.user;
		this.member = interaction.member;
		this.channel = interaction.channel!;
		this.guild = interaction.guild;
	}

	async reply(message: string | Omit<InteractionReplyOptions, 'fetchReply'>, fetch: true): Promise<Message<true>>;
	async reply(message: string | Omit<InteractionReplyOptions, 'fetchReply'>, fetch?: false): Promise<InteractionResponse<true>>;
	async reply(message: string | Omit<InteractionReplyOptions, 'fetchReply'>, fetch?: boolean) {
		if (typeof message === 'string') {
			if (fetch) {
				return (await this.interaction.reply({ content: message, withResponse: true, })).resource!.message;
			} else {
				return await this.interaction.reply({ content: message, });
			}
		} else {
			if (fetch) {
				return (await this.interaction.reply({ ...message, withResponse: true, })).resource!.message;
			} else {
				return await this.interaction.reply({ ...message, });
			}
		}
	}

	async ephemeralReply(message: string | Omit<InteractionReplyOptions, 'ephemeral'>) {
		if (typeof message === 'string') {
			return await this.reply({ content: message, flags: MessageFlags.Ephemeral, });
		} else {
			return await this.reply({ ...message, flags: MessageFlags.Ephemeral, });
		}
	}

	async followUp(message: string | Omit<InteractionReplyOptions, 'fetchReply'>, fetch?: boolean) {
		if (typeof message === 'string') {
			return await this.interaction.followUp({ content: message, withResponse: fetch, });
		} else {
			return await this.interaction.followUp({ ...message, withResponse: fetch, });
		}
	}

	async editReply(message: string | InteractionEditReplyOptions) {
		return await this.interaction.editReply(message);
	}

	async deferReply(ephemeral?: boolean) {
		return await this.interaction.deferReply({ flags: ephemeral ? MessageFlags.Ephemeral : undefined });
	}

	async deleteReply(message?: MessageResolvable | '@original') {
		return await this.interaction.deleteReply(message);
	}

	async permissed(permissions: PermissionResolvable<A, B, C> | PermissionResolvable<A, B, C>[]) {
		let passed = true;
		if (!(permissions instanceof Array)) { permissions = [permissions]; }
		for (const perm of permissions) {
			if (typeof perm === 'bigint') {
				passed = passed && this.member.permissionsIn(this.channel).has(perm);
			} else if (typeof perm === 'function') {
				passed = passed && await perm(this);
			}

			if (!passed) { break; }
		}

		return passed;
	}


	getOption<T extends OptionType>(name: string, required: true): T;
	getOption<T extends OptionType>(name: string, required?: undefined | false): Nullable<T>;
	getOption(name: string, required?: boolean) {
		const option = this.interaction.options.get(name, required);
		if (option === null) {
			return null;
		} else if (option.value !== undefined) {
			return option.value;
		} else if (option.user !== undefined) {
			return option.user;
		} else if (option.member !== undefined) {
			return option.member;
		} else if (option.channel !== undefined) {
			return option.channel;
		} else if (option.role !== undefined) {
			return option.role;
		} else if (option.attachment) {
			return option.attachment;
		}
	}
}