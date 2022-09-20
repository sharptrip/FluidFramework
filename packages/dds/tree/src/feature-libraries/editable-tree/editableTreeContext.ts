/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { assert } from "@fluidframework/common-utils";
import { TransactionResult } from "../../checkout";
import { Dependent, SimpleObservingDependent, InvalidationToken } from "../../dependency-tracking";
import { IEditableForest, ITreeSubscriptionCursor } from "../../forest";
import { FieldSchema, GlobalFieldKey } from "../../schema-stored";
import { ISharedTree } from "../../shared-tree";
import { Delta, JsonableTree, keyFromSymbol, UpPath } from "../../tree";
import { NodePath, SequenceEditBuilder } from "../sequence-change-family";
import { RootedTextCursor, singleTextCursor } from "../treeTextCursorLegacy";
import { ProxyTarget } from "./editableTree";

/**
 * A common context of a "forest" of EditableTrees.
 * It handles group operations like transforming cursors into anchors for edits.
 * TODO: add test coverage.
 */
 export interface EditableTreeContext {
    /**
     * Call before editing.
     *
     * Note that after performing edits, EditableTrees for nodes that no longer exist are invalid to use.
     * TODO: maybe add an API to check if a specific EditableTree still exists,
     * and only make use other than that invalid.
     */
    prepareForEdit(): void;

    /**
     * Call to free resources.
     * EditableTrees created in this context are invalid to use after this.
     */
    free(): void;

    /**
     * Register a handler function to be called after changes applied to the forest.
     */
    registerAfterHandler(afterHandler: EditableTreeContextHandler): void;

	getGlobalFieldSchema(key: GlobalFieldKey): FieldSchema | undefined;
}

export type EditableTreeContextHandler = (this: EditableTreeContext) => void;

function stringifyPath(path: UpPath): string {
    const fieldName = typeof path.parentField === "string" ? path.parentField : keyFromSymbol(path.parentField);
    return `${fieldName}[${path.parentIndex}]`;
}

export class ProxyContext implements EditableTreeContext {
    public readonly withCursors: Set<ProxyTarget> = new Set();
    public readonly withAnchors: Set<ProxyTarget> = new Set();
    private readonly observers: Dependent[] = [];
    private readonly afterHandlers: Set<EditableTreeContextHandler> = new Set();
    private readonly nodes: Map<string, ProxyTarget> = new Map();

    constructor(
        public readonly forest: IEditableForest,
        public readonly tree?: ISharedTree,
    ) {
        const observer = new SimpleObservingDependent((token?: InvalidationToken, delta?: Delta.Root): void => {
            if (token) {
                if (token.isSecondaryInvalidation) {
                    this.handleAfterChange();
                } else {
                    this.prepareForEdit();
                }
            }
        });
        this.observers.push(observer);
        forest.registerDependent(observer);
    }

    public createNode(cursor: ITreeSubscriptionCursor): ProxyTarget {
        const rootedCursor = cursor as unknown as RootedTextCursor;
        let current = rootedCursor.getPath();
        const upPath: string[] = [stringifyPath(current)];
        while (current.parent !== undefined) {
            current = current.parent;
            upPath.unshift(stringifyPath(current));
        }
        const nodePath = upPath.join("/");
        if (!this.nodes.has(nodePath)) {
            this.nodes.set(nodePath, new ProxyTarget(this, cursor));
        }
        return this.nodes.get(nodePath)!;
    }

    private handleAfterChange(): void {
        for (const [nodePath, target] of this.nodes) {
            if (target.anchor) {
                const path = this.forest.anchors.locate(target.anchor);
                if (path === undefined) {
                    target.free();
                    this.nodes.delete(nodePath);
                }
            }
        }
        for (const afterHandler of this.afterHandlers) {
            afterHandler.call(this);
        }
    }

    public registerAfterHandler(afterHandler: EditableTreeContextHandler): void {
        this.afterHandlers.add(afterHandler);
    }

	public getGlobalFieldSchema(key: GlobalFieldKey): FieldSchema | undefined {
		return this.forest.schema.lookupGlobalFieldSchema(key);
	}

    public prepareForEdit(): void {
        for (const target of this.withCursors) {
            target.prepareForEdit();
        }
        assert(this.withCursors.size === 0, 0x3c0 /* prepareForEdit should remove all cursors */);
    }

    public free(): void {
        for (const target of this.withCursors) {
            target.free();
        }
        for (const target of this.withAnchors) {
            target.free();
        }
        for (const observer of this.observers) {
            this.forest.removeDependent(observer);
        }
        assert(this.withCursors.size === 0, 0x3c1 /* free should remove all cursors */);
        assert(this.withAnchors.size === 0, 0x3c2 /* free should remove all anchors */);
    }

    public setNodeValue(path: NodePath, value: unknown): boolean {
        return this.runTransaction((editor) => editor.setValue(path, value));
    }

    public insertNode(path: NodePath, node: JsonableTree): boolean {
        return this.runTransaction((editor) => editor.insert(path, singleTextCursor(node)));
    }

    public deleteNode(path: NodePath, count: number): boolean {
        return this.runTransaction((editor) => editor.delete(path, count));
    }

    private runTransaction(f: (editor: SequenceEditBuilder) => void): boolean {
        assert(this.tree !== undefined, "Transaction-based editing requires `SharedTree` instance");
        const result = this.tree?.runTransaction((forest, editor) => {
            f(editor);
            return TransactionResult.Apply;
        });
        return result === TransactionResult.Apply;
    }
}
