/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { assert } from "@fluidframework/core-utils";
import {
	IEditableForest,
	moveToDetachedField,
	ForestEvents,
	TreeFieldStoredSchema,
	FieldKey,
} from "../../core";
import { ISubscribable } from "../../events";
import { DefaultEditBuilder } from "../default-field-kinds";
import { NodeKeyIndex, NodeKeyManager } from "../node-key";
import { FieldGenerator } from "../contextuallyTyped";
import { TreeSchema } from "../typed-schema";
import { disposeSymbol, IDisposable } from "../../util";
import { TreeField } from "./editableTreeTypes";
import { makeField } from "./lazyField";
import { LazyEntity, prepareForEditSymbol } from "./lazyEntity";
import { NodeKeys, SimpleNodeKeys } from "./nodeKeys";

/**
 * A common context of a "forest" of EditableTrees.
 * It handles group operations like transforming cursors into anchors for edits.
 * @alpha
 */
export interface TreeContext extends ISubscribable<ForestEvents> {
	/**
	 * Gets the root field of the tree.
	 */
	get root(): TreeField;

	/**
	 * Schema used within this context.
	 * All data must conform to these schema.
	 */
	readonly schema: TreeSchema;

	// TODO: Add more members:
	// - transaction APIs
	// - branching APIs

	readonly nodeKeys: NodeKeys;
}

/**
 * Implementation of `EditableTreeContext`.
 *
 * @remarks An editor is required to edit the EditableTrees.
 */
export class Context implements TreeContext, IDisposable {
	public readonly withCursors: Set<LazyEntity> = new Set();
	public readonly withAnchors: Set<LazyEntity> = new Set();

	private readonly eventUnregister: (() => void)[];

	/**
	 * @param forest - the Forest
	 * @param editor - an editor that makes changes to the forest.
	 * @param nodeKeys - an object which handles node key generation and conversion
	 * @param nodeKeyFieldKey - an optional field key under which node keys are stored in this tree.
	 * If present, clients may query the {@link LocalNodeKey} of a node directly via the {@link localNodeKeySymbol}.
	 */
	public constructor(
		public readonly schema: TreeSchema,
		public readonly forest: IEditableForest,
		public readonly editor: DefaultEditBuilder,
		public readonly nodeKeys: NodeKeys,
		public readonly nodeKeyFieldKey: FieldKey,
	) {
		this.eventUnregister = [
			this.forest.on("beforeChange", () => {
				this.prepareForEdit();
			}),
		];
	}

	/**
	 * Called before editing.
	 * Clears all cursors so editing can proceed.
	 */
	private prepareForEdit(): void {
		for (const target of this.withCursors) {
			target[prepareForEditSymbol]();
		}
		assert(this.withCursors.size === 0, 0x773 /* prepareForEdit should remove all cursors */);
	}

	public [disposeSymbol](): void {
		this.clear();
		for (const unregister of this.eventUnregister) {
			unregister();
		}
		this.eventUnregister.length = 0;
	}

	/**
	 * Release any cursors and anchors held by EditableTrees created in this context.
	 * The EditableTrees are invalid to use after this, but the context may still be used
	 * to create new trees starting from the root.
	 */
	public clear(): void {
		for (const target of this.withAnchors) {
			target[disposeSymbol]();
		}
		assert(this.withCursors.size === 0, 0x774 /* free should remove all cursors */);
		assert(this.withAnchors.size === 0, 0x775 /* free should remove all anchors */);
	}

	public get root(): TreeField {
		const cursor = this.forest.allocateCursor();
		moveToDetachedField(this.forest, cursor);
		const field = makeField(this, this.schema.rootFieldSchema, cursor);
		cursor.free();
		return field;
	}

	public on<K extends keyof ForestEvents>(eventName: K, listener: ForestEvents[K]): () => void {
		return this.forest.on(eventName, listener);
	}

	/**
	 * FieldSource used to get a FieldGenerator to populate required fields during procedural contextual data generation.
	 */
	// TODO: Use this to automatically provide node keys where required.
	public fieldSource?(key: FieldKey, schema: TreeFieldStoredSchema): undefined | FieldGenerator;
}

/**
 * A simple API for a Forest to interact with the tree.
 *
 * @param forest - the Forest
 * @param editor - an editor that makes changes to the forest.
 * @param nodeKeyManager - an object which handles node key generation and conversion.
 * @param nodeKeyFieldKey - an optional field key under which node keys are stored in this tree.
 * If present, clients may query the {@link LocalNodeKey} of a node directly via the {@link localNodeKeySymbol}.
 * @returns {@link EditableTreeContext} which is used to manage the cursors and anchors within the EditableTrees:
 * This is necessary for supporting using this tree across edits to the forest, and not leaking memory.
 */
export function getTreeContext(
	schema: TreeSchema,
	forest: IEditableForest,
	editor: DefaultEditBuilder,
	nodeKeyManager: NodeKeyManager,
	nodeKeyFieldKey: FieldKey,
): Context {
	const nodeKeys = new SimpleNodeKeys(new NodeKeyIndex(nodeKeyFieldKey), nodeKeyManager);
	const context = new Context(schema, forest, editor, nodeKeys, nodeKeyFieldKey);
	nodeKeys.map.scanKeys(context);
	context.on("afterChange", () => {
		nodeKeys.map.scanKeys(context);
	});
	return context;
}
