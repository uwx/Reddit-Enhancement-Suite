/* @flow */

import { transform, once } from 'lodash-es';
import { extendDeep } from '../../utils/object';
import { batch, keyedMutex } from '../../utils/async';
import { apiToPromise } from '../utils/api';
import { sendMessage } from './messaging';

const _set = (key: string, value: unknown) => chrome.storage.local.set({ [key]: value });
const _get = async (key: string, defaultValue: number | null = null) => (await chrome.storage.local.get({ [key]: defaultValue }))[key];
const _delete = apiToPromise((keys: string | string[], callback) => chrome.storage.local.remove(keys, callback));
const _clear = apiToPromise(callback => chrome.storage.local.clear(callback));

const withLockOn = keyedMutex(<T>(key: string, fn: () => T): T => fn());

export function get(key: string): Promise<any | null> {
	return withLockOn(key, () => _get(key, null));
}

export function getAll(): Promise<{ [key: string]: any }> {
	return chrome.storage.local.get(null);
}

export function getMultiple<T extends string>(keys: T[]): Promise<{ [key in T]: any | null }> {
	const defaults = {} as Record<T, any>;
	for (const k of keys) {
		defaults[k] = null;
	}
	return chrome.storage.local.get(defaults) as Promise<{ [key in T]: any | null }>;
}

export function set(key: string, value: unknown): Promise<void> {
	return withLockOn(key, () => _set(key, value));
}

export function setMultiple(valueMap: { [key: string]: unknown }): Promise<void> {
	return chrome.storage.local.set(valueMap);
}

function compareAndSet(key: string, defaultValue: unknown, oldValue: unknown, newValue: unknown): Promise<boolean> {
	// Redirect to the background instance as it allows for a common mutex,
	// preventing race conditions when several tabs invokes this function around the same time
	return sendMessage('storage-cas', [key, defaultValue, oldValue, newValue]);
}

/*
 * Deeply patches an object in storage, like extendDeep().
 */
function patch(key: string, value: { [key: string]: unknown }): Promise<void> {
	return withLockOn(key, async () => {
		const extended = extendDeep(await _get(key) || {}, value);
		return _set(key, extended);
	});
}

/*
 * Shallowly patches an object in storage, like Object.assign().
 */
function patchShallow(key: string, value: { [key: string]: unknown }): Promise<void> {
	return withLockOn(key, async () => {
		const extended = Object.assign(await _get(key) || {}, value);
		return _set(key, extended);
	});
}

/*
 * Deletes a property on a value in storage.
 * i.e. `deletePath('userTaggerStorageKey', 'username', 'tag')`
 * will `delete userTaggerStoredValue.username.tag`
 */
function deletePaths(key: string, paths: string[][]): Promise<void> {
	return withLockOn(key, async () => {
		const stored = await _get(key);
		if (!stored) return;
		for (const path of paths) {
			path.reduce((obj, key, i, { length }) => {
				if (!obj) return;
				if (i < length - 1) return obj[key];
				delete obj[key];
			}, stored);
		}
		return _set(key, stored);
	});
}

function delete_(key: string): Promise<void> {
	return withLockOn(key, () => _delete(key));
}
export { delete_ as delete };

export function deleteMultiple(keys: string[]): Promise<void> {
	return _delete(keys);
}

export function has(key: string): Promise<boolean> {
	return withLockOn(key, async () => {
		const sentinel = Math.random();
		return (await _get(key, sentinel)) !== sentinel;
	});
}

export async function keys(): Promise<string[]> {
	return Object.keys(await chrome.storage.local.get(null));
}

export function clear(): Promise<void> {
	return _clear();
}

class Wrapper<T> {
	_key: () => string;
	_default: T;

	constructor(key: Wrapper<T>['_key'], def: T) {
		this._key = key;
		this._default = def;
	}

	get(): Promise<T> {
		return get(this._key()).then(val => (val === null ? this._default : val));
	}

	set(value: T): Promise<void> {
		return set(this._key(), value);
	}

	patch(value: T): Promise<void> {
		return patch(this._key(), (value as any));
	}

	compareAndSet(oldValue: T, newValue: T): Promise<boolean> {
		return compareAndSet(this._key(), this._default, oldValue, newValue);
	}

	deletePath(...path: string[]): Promise<void> {
		return deletePaths(this._key(), [path]);
	}

	delete(): Promise<void> {
		return delete_(this._key());
	}

	has(): Promise<boolean> {
		return has(this._key());
	}
}

export function wrap<T>(key: string | (() => string) /* pure */, defaultValue: T): Wrapper<T> {
	const keyGenerator = typeof key === 'string' ? () => key : once(key);
	// $FlowIssue
	return new Wrapper(keyGenerator, defaultValue);
}

class PrefixWrapper<T> {
	_prefix: string;
	_keyMapper: (key: string) => string;
	_default: () => T;
	_get: (key: string) => Promise<any>;

	constructor(prefix: string, def: () => T, keyMapper: (key: string) => string, batching: boolean) {
		this._prefix = prefix;
		this._default = def;
		this._keyMapper = keyMapper;

		if (batching) {
			this._get = batch(async (keys: string[]) => {
			const v = await this.getMultipleNullable(keys);
				return keys.map(key => v[this._keyMapper(key)]);
			}, { size: Infinity, delay: 0 });
		} else {
			this._get = key => get(this._keyGen(key));
		}
	}

	_keyGen(key: string): string {
		return this._prefix + this._keyMapper(key);
	}

	get(key: string): Promise<T> {
		return this._get(key).then((val: any) => (val === null ? this._default() : val));
	}

	getNullable(key: string): Promise<T | null> {
		return this._get(key);
	}

	async getAll(): Promise<{ [key: string]: T }> {
		const everything = await getAll();
		return transform(everything, (acc, v, k) => {
			if (k.startsWith(this._prefix)) {
				acc[k.slice(this._prefix.length)] = v;
			}
		}, {} as Record<string, any>);
	}

	async getMultiple(keys: string[]): Promise<{ [key: string]: T }> {
		const rawValues = await getMultiple(keys.map(k => this._keyGen(k)));
		return transform(rawValues, (acc, v, k) => {
			acc[k.slice(this._prefix.length)] = (v === null ? this._default() : v);
		}, {} as Record<string, any>);
	}

	async getMultipleNullable(keys: string[]): Promise<{ [key: string]: T | null }> {
		const rawValues = await getMultiple(keys.map(k => this._keyGen(k)));
		return transform(rawValues, (acc, v, k) => {
			acc[k.slice(this._prefix.length)] = v;
		}, {} as Record<string, any>);
	}

	set(key: string, value: T): Promise<void> {
		return set(this._keyGen(key), value);
	}

	patch(key: string, value: T): Promise<void> {
		return patch(this._keyGen(key), (value as any));
	}

	deletePath(key: string, ...path: string[]): Promise<void> {
		return deletePaths(this._keyGen(key), [path]);
	}

	delete(key: string): Promise<void> {
		return delete_(this._keyGen(key));
	}

	deleteMultiple(keys: string[]): Promise<void> {
		return deleteMultiple(keys.map(k => this._keyGen(k)));
	}

	has(key: string): Promise<boolean> {
		return has(this._keyGen(key));
	}
}

export function wrapPrefix<T>(prefix: string, defaultValue: () => T, destructiveKeyMapper: (key: string) => string = x => x, batching: boolean = false): PrefixWrapper<T> {
	return new PrefixWrapper(prefix, defaultValue, destructiveKeyMapper, batching);
}

class BlobWrapper<T> {
	_rootKey: string;
	_default: () => T;

	constructor(rootKey: string, def: () => T) {
		this._rootKey = rootKey;
		this._default = def;
	}

	get(key: string): Promise<T> {
		return get(this._rootKey).then(val => (
			(val === null || val[key] === undefined) ? this._default() : val[key]
		));
	}

	getNullable(key: string): Promise<T | null> {
		return get(this._rootKey).then(val => (
			(val === null || val[key] === undefined) ? null : val[key]
		));
	}

	getAll(): Promise<{ [key: string]: T }> {
		return get(this._rootKey).then(val => (val === null ? {} : val));
	}

	async getMultiple(keys: string[]): Promise<{ [key: string]: T }> {
		const rawValues = (await get(this._rootKey)) || {};
		return transform(keys, (acc, key) => {
			acc[key] = rawValues[key] === undefined ? this._default() : rawValues[key];
		}, {} as Record<string, any>);
	}

	async getMultipleNullable(keys: string[]): Promise<{ [key: string]: T | null }> {
		const rawValues = (await get(this._rootKey)) || {};
		return transform(keys, (acc, key) => {
			acc[key] = rawValues[key] === undefined ? null : rawValues[key];
		}, {} as Record<string, any>);
	}

	set(key: string, value: T): Promise<void> {
		return patchShallow(this._rootKey, { [key]: value });
	}

	patch(key: string, value: T): Promise<void> {
		return patch(this._rootKey, { [key]: value });
	}

	deletePath(key: string, ...path: string[]): Promise<void> {
		return deletePaths(this._rootKey, [[key, ...path]]);
	}

	delete(key: string): Promise<void> {
		return deletePaths(this._rootKey, [[key]]);
	}

	deleteMultiple(keys: string[]): Promise<void> {
		return deletePaths(this._rootKey, keys.map(k => [k]));
	}

	has(key: string): Promise<boolean> {
		return get(this._rootKey).then(val => (val !== null && val[key] !== undefined));
	}

	clear(): Promise<void> {
		return delete_(this._rootKey);
	}
}

export function wrapBlob<T>(rootKey: string, defaultValue: () => T): BlobWrapper<T> {
	return new BlobWrapper(rootKey, defaultValue);
}
