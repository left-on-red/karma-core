export {}

declare global {
	type Nullable<T> = T | null;
	interface Map<K, V> {
		has<P extends K>(k: P): this is { get(p: P): V } & this;
	}

	type Constructor<T> = new(...args: any) => T;
}