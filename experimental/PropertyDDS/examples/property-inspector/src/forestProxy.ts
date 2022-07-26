import { FieldKey, ITreeCursor as TextCursor, ObjectForest, TreeNavigationResult } from "@fluid-internal/tree";

export const proxySymbol = Symbol("forest-proxy");

class NodeTarget {
	public get cursor(): TextCursor {
		return this._cursor;
	}

	public reset() {
		// Clear cursor before allocating a new one.
		this._cursor = this._forest.allocateCursor();
	}

	public getType() {
		return this.cursor.type;
	}
	constructor(
		private _cursor: TextCursor,
		private readonly _forest: ObjectForest,
	) {

	}
}

export const getForestProxy = (cursor: TextCursor, forest: ObjectForest) => {
	const handler: ProxyHandler<NodeTarget> = {
		get: (target: NodeTarget, key: string): any => {
			const result = target.cursor.down(key as FieldKey, 0);
			if (result === TreeNavigationResult.NotFound) {
				return Reflect.get(target, key);
			}
			const val = target.cursor.value;
			if (!val) {
				const currentCursor = target.cursor;
				target.reset();
				return getForestProxy(currentCursor, forest);
			} else {
				target.reset();
				return val;
			}
		},
		ownKeys(target: NodeTarget) {
			return target.cursor.keys as string[];
		},
		/**
		 * Trap for Object.getOwnPropertyDescriptor().
		 * Returns a writeable and enumerable descriptor. Required for the ownKeys trap.
		 * @param target - The Object that references a non-collection type
		 * @param key - The name of the property.
		 * @returns The Descriptor
		 */
		getOwnPropertyDescriptor(target: NodeTarget, key: string | symbol) {
			// TODO: replace this condition with getFields(), currently it's not available on the interface
			if ([...target.cursor.keys].indexOf(key as FieldKey) !== -1) {
				return {
					configurable: true,
					enumerable: true,
					value: target.cursor.value,
					writable: true,
				};
			} else if (key === proxySymbol) {
				return { configurable: true, enumerable: true, value: key, writable: false };
			} else {
				return undefined;
			}
		}
	};

	const currentTarget = new NodeTarget(cursor, forest);

	const proxy = new Proxy(currentTarget, handler);
	Object.defineProperty(proxy, proxySymbol, {
		enumerable: false,
		configurable: true,
		writable: false,
		value: proxySymbol,
	});

	return proxy;
};
