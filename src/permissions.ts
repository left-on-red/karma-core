import { KarmaClient } from './client';
import { type KarmaCommand } from './commands';
import { type KarmaContext } from './context';

export type PermissionResolvable<A extends KarmaClient<A, B, C>, B extends KarmaContext<A, B, C>, C extends KarmaCommand<A, B, C>> = bigint | ((context: KarmaContext<A, B, C>) => Promise<boolean> | boolean);