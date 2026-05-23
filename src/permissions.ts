import { KarmaClient } from './client';
import { type KarmaCommand } from './commands';
import { type KarmaContext } from './context';

export type PermissionResolvable<A extends KarmaClient<A, B, C> = KarmaClient<any, any, any>, B extends KarmaContext<A, B, C> = KarmaContext<any, any, any>, C extends KarmaCommand<A, B, C> = KarmaCommand<any, any, any>> = bigint | ((context: KarmaContext<A, B, C>) => Promise<boolean> | boolean);