import { assert } from "@fluidframework/common-utils";
import { TransactionResult } from "../../checkout";
import { IEditableForest } from "../../forest";
import { FieldSchema, GlobalFieldKey } from "../../schema-stored";
import { ISharedTree } from "../../shared-tree";
import { JsonableTree } from "../../tree";
import { NodePath, SequenceEditBuilder } from "../sequence-change-family";
import { singleTextCursor } from "../treeTextCursorLegacy";
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

	getGlobalFieldSchema(key: GlobalFieldKey): FieldSchema | undefined;
}

export class ProxyContext implements EditableTreeContext {
    public readonly withCursors: Set<ProxyTarget> = new Set();
    public readonly withAnchors: Set<ProxyTarget> = new Set();
    constructor(public readonly forest: IEditableForest, public readonly tree?: ISharedTree | undefined) {}

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
