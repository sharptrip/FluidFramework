/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import { FieldKey, ITreeCursor, TextCursor, ObjectForest, IEditableForest,
	TreeNavigationResult, JsonableTree, jsonableTreeFromCursor, brand,
	LocalFieldKey, TreeSchemaIdentifier, StoredSchemaRepository } from "@fluid-internal/tree";
import { assert } from "@fluidframework/common-utils";

export const proxySymbol = Symbol("forest-proxy");

class NodeTarget {
	public get cursor(): ITreeCursor {
		return this._cursor;
	}

	public get forest(): IEditableForest {
		return this._forest;
	}

	public reset() {
		this._forest.currentCursors.delete(this._cursor);
		this._cursor = new TextCursor(this._data);
		this._forest.currentCursors.add(this._cursor);
	}

	public get type() {
		return this.cursor.type;
	}

	public get data(): JsonableTree {
		return jsonableTreeFromCursor(this._cursor);
	}

	public set data(d: JsonableTree) {
		this._data = d;
	}

	private _cursor: ITreeCursor;

	constructor(
		private _data: JsonableTree | TextCursor,
		private readonly _forest: ObjectForest,
		public readonly render: any,
	) {
		if (_data instanceof TextCursor) {
			this._cursor = _data;
		} else {
			this._cursor = new TextCursor(this._data);
			const newRange = this._forest.add([this._cursor]);
			this._forest.attachRangeOfChildren({ index: 0, range: this._forest.rootField }, newRange);
		}
	}
}

const getFieldType = (schema: StoredSchemaRepository, type: TreeSchemaIdentifier, fieldKey: LocalFieldKey) => {
	const field = schema?.treeSchema.get(type)?.localFields.get(fieldKey);
	for (const fieldType of (field?.types || [])) {
		return fieldType;
	}
};

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
			return proxifyForest(currentCursor, target.forest, target.render);
		} else {
			const node = (target.cursor as TextCursor).getNode();
			target.cursor.up();
			return node;
		}
	},
	set: (target: NodeTarget, key: string | symbol, value: any): boolean => {
		const data = (target.cursor as TextCursor).getNode();
		const type = target.cursor.type;
		const fieldType = getFieldType(target.forest.schema, type, key as LocalFieldKey);
		if (!data.fields) {
			return false;
		}
		assert(!!fieldType, `Field <${key as string}> does not exist in type <${type}>`);
		const result = target.cursor.down(key as FieldKey, 0);
		if (result === TreeNavigationResult.NotFound) {
			data.fields[key as any] = [
				{ value, type: brand(fieldType as string) },
			];
			target.data = data;
		} else {
			(target.cursor as TextCursor).getNode().value = value;
		}
		target.reset();
		target.render?.(target.data);
		return true;
	},
	has: (target: NodeTarget, key: string | symbol): boolean => {
		if (key === proxySymbol) {
			return true;
		}
		const result = target.cursor.down(key as FieldKey, 0);
		if (result === TreeNavigationResult.Ok) {
			target.cursor.up();
			return true;
		}
		return false;
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
		if (key === proxySymbol) {
			return { configurable: true, enumerable: true, value: key, writable: false };
		}
		const result = target.cursor.down(key as FieldKey, 0);
		if (result === TreeNavigationResult.Ok) {
			target.cursor.up();
			return {
				configurable: true,
				enumerable: true,
				value: target.cursor.value,
				writable: true,
			};
		}
		return undefined;
	},
};

export const proxifyForest = (data: JsonableTree | ITreeCursor, forest: IEditableForest, render?: any) => {
	const proxy = new Proxy(new NodeTarget(data, forest as ObjectForest, render), handler);
	Object.defineProperty(proxy, proxySymbol, {
		enumerable: false,
		configurable: true,
		writable: false,
		value: proxySymbol,
	});

	return proxy;
};
