/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import { assert } from "@fluidframework/common-utils";
import { FieldKey, Value, Anchor, rootFieldKey, JsonableTree } from "../../tree";
import {
    IEditableForest, TreeNavigationResult, mapCursorField, ITreeSubscriptionCursor, ITreeSubscriptionCursorState,
} from "../../forest";
import { brand } from "../../util";
import {
    FieldSchema, LocalFieldKey, TreeSchemaIdentifier, TreeSchema, ValueSchema,
} from "../../schema-stored";
import { FieldKind, Multiplicity } from "../modular-schema";
import { TransactionResult } from "../../checkout";
import { ISharedTree } from "../../shared-tree";
import { NodePath, SequenceEditBuilder } from "../sequence-change-family";
import { singleTextCursor } from "../treeTextCursor";
import {
    AdaptingProxyHandler,
    adaptWithProxy,
    getFieldKind, getFieldSchema, getPrimaryField, isPrimitive, isPrimitiveValue, PrimitiveValue,
} from "./utilities";

/**
 * A symbol for extracting target from editable-tree proxies.
 * Useful for debugging and testing, but not part of the public API.
 */
export const proxyTargetSymbol: unique symbol = Symbol("editable-tree:proxyTarget");

/**
 * A symbol to get a function, which returns the type of a node in contexts
 * where string keys are already in use for fields.
 */
export const getTypeSymbol: unique symbol = Symbol("editable-tree:getType()");

 /**
 * A symbol to get the value of a node in contexts where string keys are already in use for fields.
 */
export const valueSymbol: unique symbol = Symbol("editable-tree:value");

/**
 * A tree which can be traversed and edited.
 *
 * When iterating, only visits non-empty fields.
 * To discover empty fields, inspect the schema using {@link getTypeSymbol}.
 *
 * TODO: support editing.
 * TODO: `extends Iterable<EditableField>`
 * TODO: use proxies for array fields not just raw arrays (will be needed for laziness and editing).
 * TODO: provide non-schema impacted APIs for getting fields and nodes without unwrapping
 * (useful for generic code, and when references to these actual fields and nodes are required,
 * for example creating anchors and editing).
 */
export interface EditableTree {
    /**
     * A function to get the type of a node.
     * If this node is well-formed, it must follow this schema.
     * @param key - if key is supplied, returns the type of a non-sequence child node (if exists)
     * @param nameOnly - if true, returns only the type identifier
     */
    readonly [getTypeSymbol]: (key?: string, nameOnly?: boolean) => TreeSchema | TreeSchemaIdentifier | undefined;

    /**
     * Value stored on this node.
     */
    readonly [valueSymbol]: Value;

    /**
     * Stores the target for the proxy which implements reading and writing for this node.
     * The details of this object are implementation details,
     * but the presence of this symbol can be used to separate EditableTrees from other types.
     */
    readonly [proxyTargetSymbol]: object;

    /**
     * Fields of this node, indexed by their field keys (as strings).
     *
     * This API exposes content in a way depending on the {@link Multiplicity} of the {@link FieldKind}.
     * Sequences (including empty ones) are always exposed as arrays,
     * and everything else is either a single EditableTree or undefined depending on if it's empty.
     *
     * TODO:
     * This approach to field lookup can result in collisions between global and local keys,
     * particularly with "extra" fields.
     * A mechanism for disambiguating this should be added,
     * likely involving an alternative mechanism for looking up global fields via symbols.
     */
    readonly [key: string]: UnwrappedEditableField;
}

/**
 * EditableTree,
 * but with any type that `isPrimitive` unwrapped into the value if that value is a {@link PrimitiveValue}.
 */
export type EditableTreeOrPrimitive = EditableTree | PrimitiveValue;

/**
 * EditableTree, but with these cases of unwrapping:
 * - primitives are unwrapped. See {@link EditableTreeOrPrimitive}.
 * - nodes with PrimaryField are unwrapped to just the primaryField. See `getPrimaryField`.
 * - fields are unwrapped based on their schema's multiplicity. See {@link UnwrappedEditableField}.
 *
 * TODO:
 * EditableTree should provide easy access to children in a way thats guaranteed
 * not to do this unwrapping for cases which need to refer to the actual nodes.
 * This may include cases like creating anchors and/or editing.
 */
export type UnwrappedEditableTree = EditableTreeOrPrimitive | readonly UnwrappedEditableTree[];

/**
 * A field of an {@link EditableTree}.
 */
export type EditableField = readonly [FieldSchema, readonly EditableTree[]];

/**
 * Unwrapped field.
 * Non-sequence multiplicities are unwrapped to the child tree or `undefined` if there is none.
 * Sequence multiplicities are handled with arrays.
 * See {@link UnwrappedEditableTree} for how the children themselves are unwrapped.
 */
export type UnwrappedEditableField = UnwrappedEditableTree | undefined | readonly UnwrappedEditableTree[];

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
}

class ProxyContext implements EditableTreeContext {
    public readonly withCursors: Set<ProxyTarget> = new Set();
    public readonly withAnchors: Set<ProxyTarget> = new Set();
    constructor(
        public readonly forest: IEditableForest,
        public readonly tree?: ISharedTree,
    ) {}

    public prepareForEdit(): void {
        for (const target of this.withCursors) {
            target.prepareForEdit();
        }
        assert(this.withCursors.size === 0, "prepareForEdit should remove all cursors");
    }

    public free(): void {
        for (const target of this.withCursors) {
            target.free();
        }
        for (const target of this.withAnchors) {
            target.free();
        }
        assert(this.withCursors.size === 0, "free should remove all cursors");
        assert(this.withAnchors.size === 0, "free should remove all anchors");
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
        assert(this.tree !== undefined, "Transaction-based editing requires SharedTree");
        const result = this.tree?.runTransaction((forest, editor) => {
            f(editor);
            return TransactionResult.Apply;
        });
        return result === TransactionResult.Apply;
    }
}

interface PreparedForEdit extends ProxyTarget {
    anchor: Anchor;
}

function assertPreparedForEdit(target: ProxyTarget): asserts target is PreparedForEdit {
    const cursorStates = ITreeSubscriptionCursorState;
    if (target.lazyCursor.state !== cursorStates.Cleared) {
        throw new Error("EditableTree's cursor must be cleared before editing.");
    }
    assert(target.anchor !== undefined, "EditableTree should have an anchor before editing.");
}

class ProxyTarget {
    public readonly lazyCursor: ITreeSubscriptionCursor;
    private _anchor?: Anchor;
    public get anchor(): Anchor | undefined {
        return this._anchor;
    }

    constructor(
        public readonly context: ProxyContext,
        cursor: ITreeSubscriptionCursor,
        public readonly primaryParent?: ProxyTarget,
    ) {
        this.lazyCursor = cursor.fork();
        context.withCursors.add(this);
    }

    public free(): void {
        this.lazyCursor.free();
        this.context.withCursors.delete(this);
        if (this._anchor !== undefined) {
            this.context.forest.anchors.forget(this._anchor);
            this.context.withAnchors.delete(this);
            this._anchor = undefined;
        }
    }

    public prepareForEdit(): void {
        if (this._anchor === undefined) {
            this._anchor = this.lazyCursor.buildAnchor();
            this.context.withAnchors.add(this);
        }
        this.lazyCursor.clear();
        this.context.withCursors.delete(this);
    }

    public get cursor(): ITreeSubscriptionCursor {
        if (this.lazyCursor.state === ITreeSubscriptionCursorState.Cleared) {
            assert(this._anchor !== undefined, "EditableTree should have an anchor if it does not have a cursor");
            const result = this.context.forest.tryMoveCursorTo(this._anchor, this.lazyCursor);
            assert(result === TreeNavigationResult.Ok,
                "It is invalid to access an EditableTree node which no longer exists");
            this.context.withCursors.add(this);
        }
        return this.lazyCursor;
    }

    public getType(key?: string, nameOnly?: boolean): TreeSchemaIdentifier | TreeSchema | undefined {
        let typeName = this.cursor.type;
        if (key !== undefined) {
            const childTypes = mapCursorField(this.cursor, brand(key), (c) => c.type);
            assert(childTypes.length <= 1, "invalid non sequence");
            typeName = childTypes[0];
        }
        if (nameOnly) {
            return typeName;
        }
        if (typeName) {
            return this.context.forest.schema.lookupTreeSchema(typeName);
        }
        return undefined;
    }

    get value(): Value {
        return this.cursor.value;
    }

    public lookupFieldKind(key: string): FieldKind {
        return getFieldKind(getFieldSchema(this.getType() as TreeSchema, key));
    }

    public getKeys(): string[] {
        // For now this is an approximation:
        const keys: string[] = [];
        const length = this.getPrimaryArrayLength();
        if (length !== undefined) {
            return Object.getOwnPropertyNames(Array.from(Array(length)));
        }
        for (const key of this.cursor.keys) {
            // TODO: with new cursor API, field iteration will skip empty fields and this check can be removed.
            if (this.has(key as string)) {
                keys.push(key as string);
            }
        }
        return keys;
    }

    public has(key: string): boolean {
        const primaryKey = this.primaryKey;
        if (primaryKey !== undefined) {
            if (this.cursor.down(primaryKey, Number(key)) === TreeNavigationResult.Ok) {
                this.cursor.up();
                return true;
            }
            return false;
        }
        // Make fields present only if non-empty.
        return this.cursor.length(brand(key)) !== 0;
    }

    /**
     * @returns the key, if any, of the primary array field.
     */
    get primaryKey(): LocalFieldKey | undefined {
        const nodeType = this.getType() as TreeSchema;
        const primary = getPrimaryField(nodeType);
        if (primary === undefined) {
            return undefined;
        }
        const kind = getFieldKind(primary.schema);
        if (kind.multiplicity === Multiplicity.Sequence) {
            // TODO: this could have issues if there are non-primary keys
            // that can collide with the array APIs (length or integers).
            return primary.key;
        }
        return undefined;
    }

    public proxifyField(key: string | number): UnwrappedEditableField {
        // const primary = this.primaryKey;
        // if (primary !== undefined) {
        //     if (this.cursor.down(primary, key as number) === TreeNavigationResult.Ok) {
        //         const sequenceProxy = inProxyOrUnwrap(new ProxyTarget(this.context, this.cursor, this));
        //         this.cursor.up();
        //         return sequenceProxy;
        //     }
        //     // TODO assert
        //     return undefined;
        // }
        // Lookup the schema:
        const fieldKind = this.lookupFieldKind(key as string);
        // Make the childTargets:
        const childTargets = mapCursorField(this.cursor, brand(key as string), (c) => new ProxyTarget(this.context, c));
        return proxifyField(fieldKind, childTargets);
    }

    /**
     * @returns the type name of a node.
     * It shall never be possible to call this for sequence fields as they are unwrapped into arrays.
     */
    public getTypeName(key: string): TreeSchemaIdentifier {
        const childTypes = mapCursorField(this.cursor, brand(key), (c) => c.type);
        assert(childTypes.length <= 1, "invalid non sequence");
        return childTypes[0];
    }

    /**
     * Sets value of a non-sequence field.
     * This is correct only if sequence fields are unwrapped into arrays.
     */
    public setValue(key: string, _value: unknown): boolean {
        const primaryKey = this.primaryKey;
        const index = Number(key);
        const _key: FieldKey = primaryKey === undefined ? brand(key) : primaryKey;
        const childTargets = mapCursorField(this.cursor, _key, (c) => new ProxyTarget(this.context, c));
        const target = primaryKey === undefined ? childTargets[0] : childTargets[index];
        const type = target.getType() as TreeSchema;
        assert(isPrimitive(type), `"Set value" is not supported for non-primitive fields`);
        this.context.prepareForEdit();
        assertPreparedForEdit(target);
        const path = this.context.forest.anchors.locate(target.anchor);
        assert(path !== undefined, "Can't locate a path to set a value");
        return this.context.setNodeValue(path, _value);
    }

    public insertNode(key: string, _value: unknown): boolean {
        const type = this.getType() as TreeSchema;
        let nodeValue = _value;
        if (isPrimitive(type)) {
            const types = type.localFields?.get(brand(key))?.types;
            assert(types !== undefined, "Unknown primitive field type");
            const nodeTypeName = [...types][0];
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            nodeValue = { type: nodeTypeName, value: _value } as JsonableTree;
        }
        this.context.prepareForEdit();
        assertPreparedForEdit(this);
        const path = this.context.forest.anchors.locate(this.anchor);
        assert(path !== undefined, "Can't locate a path to insert a node");
        return this.context.insertNode({
            parent: path,
            parentField: brand(key),
            parentIndex: 0,
        }, nodeValue as JsonableTree);
    }

    public deleteNode(key: string): boolean {
        this.context.prepareForEdit();
        assertPreparedForEdit(this);
        const path = this.context.forest.anchors.locate(this.anchor);
        assert(path !== undefined, "Can't locate a path to delete a node");
        return this.context.deleteNode({
            parent: path,
            parentField: brand(key),
            parentIndex: 0,
        }, 1);
    }

    public getPrimaryArrayLength(): number | undefined {
        if (this.primaryKey !== undefined) {
            return this.cursor.length(this.primaryKey);
        }
        return undefined;
    }
}

const mockArray = (target: ProxyTarget): UnwrappedEditableTree[] => {
    assert(target.primaryKey !== undefined, "no");
    const arr = mapCursorField(target.cursor, brand(target.primaryKey),
        (c) => inProxyOrUnwrap(new ProxyTarget(target.context, c, target)));
    return arr;
};

/**
 * A Proxy handler together with a {@link ProxyTarget} implements a basic read/write access to the Forest
 * by means of the cursors.
 */
const handler: AdaptingProxyHandler<ProxyTarget, EditableTree> = {
    get: (target: ProxyTarget, key: string | symbol, receiver: unknown): unknown => {
        if (typeof key === "string") {
            const length = target.getPrimaryArrayLength();
            if (length !== undefined) {
                if (key === "length") {
                    return length;
                }
                const array = mockArray(target);
                if (key in Array.prototype) {
                    return Array.prototype[key as any].bind(array);
                }
                return array[Number(key)];
            }
            // All string keys are fields
            return target.proxifyField(key);
        }
        if (key === getTypeSymbol) {
            return target.getType.bind(target);
        } else if (key === valueSymbol) {
            return target.value;
        } else if (key === proxyTargetSymbol) {
            return target;
        } else if (key === Symbol.iterator) {
            const primaryKey = target.primaryKey;
            if (primaryKey !== undefined) {
                const array = mockArray(target);
                return array[Symbol.iterator]();
            }
        }
        return undefined;
    },
    set: (target: ProxyTarget, key: string, _value: unknown, receiver: unknown): boolean => {
        // update value
        if (target.has(key)) {
            return target.setValue(key, _value);
        // insert node
        } else {
            return target.insertNode(key, _value);
        }
    },
    deleteProperty: (target: ProxyTarget, key: string): boolean => {
        if (target.has(key)) {
            return target.deleteNode(key);
        }
        return false;
    },
    // Include documented symbols (except value when value is undefined) and all non-empty fields.
    has: (target: ProxyTarget, key: string | symbol): boolean => {
        if (typeof key === "symbol") {
            switch (key) {
                case proxyTargetSymbol:
                case getTypeSymbol:
                    return true;
                case valueSymbol:
                    // Could do `target.value !== ValueSchema.Nothing`
                    // instead if values which could be modified should report as existing.
                    return target.value !== undefined;
                // Currently not supporting iteration over fields.
                case Symbol.iterator:
                    return target.primaryKey !== undefined;
                default:
                    return false;
            }
        }

        return target.has(key);
    },
    // Includes all non-empty fields, which are the enumerable fields.
    ownKeys: (target: ProxyTarget): string[] => {
        return target.getKeys();
    },
    getOwnPropertyDescriptor: (target: ProxyTarget, key: string | symbol): PropertyDescriptor | undefined => {
        // We generally don't want to allow users of the proxy to reconfigure all the properties,
        // but it is an TypeError to return non-configurable for properties that do not exist on target,
        // so they must return true.

        if (typeof key === "symbol") {
            if (key === proxyTargetSymbol) {
                return { configurable: true, enumerable: false, value: target, writable: false };
            } else if (key === getTypeSymbol) {
                return { configurable: true, enumerable: false, value: target.getType.bind(target), writable: false };
            }
        } else {
            if (key === "length") {
                const length = target.getPrimaryArrayLength();
                if (length !== undefined) {
                    return {
                        configurable: true,
                        enumerable: false,
                        value: length,
                        writable: false,
                    };
                }
            }
            if (target.has(key)) {
                return {
                    configurable: true,
                    enumerable: true,
                    value: target.proxifyField(key),
                    writable: false,
                };
            }
        }
        return undefined;
    },
};

/**
 * See {@link UnwrappedEditableTree} for documentation on what unwrapping this perform.
 */
function inProxyOrUnwrap(target: ProxyTarget): UnwrappedEditableTree {
    const fieldSchema = target.getType() as TreeSchema;
    if (isPrimitive(fieldSchema)) {
        const nodeValue = target.cursor.value;
        if (isPrimitiveValue(nodeValue)) {
            // target.free();
            return nodeValue;
        }
        assert(fieldSchema.value === ValueSchema.Serializable, "`undefined` values not allowed for primitive fields");
    }
    // const primary = target.primaryKey;
    // if (primary !== undefined) {
    //     const childTargets = mapCursorField(target.cursor, primary, (c) => new ProxyTarget(target.context, c));
    //     return childTargets.map(inProxyOrUnwrap);
    // }
    return adaptWithProxy(target, handler);
}

/**
 * @param fieldKind - determines how return value should be typed. See {@link UnwrappedEditableField}.
 * @param childTargets - targets for the children of the field.
 */
function proxifyField(fieldKind: FieldKind, childTargets: ProxyTarget[]): UnwrappedEditableField {
    if (fieldKind.multiplicity === Multiplicity.Sequence) {
        // Return array for sequence fields
        return childTargets.map(inProxyOrUnwrap);
    } else {
        // Avoid wrapping non-sequence fields in arrays
        assert(childTargets.length <= 1, "invalid non sequence");
        if (childTargets.length === 1) {
            return inProxyOrUnwrap(childTargets[0]);
        } else {
            return undefined;
        }
    }
}

/**
 * A simple API for a Forest to showcase basic interaction scenarios.
 *
 * This function returns an instance of a JS Proxy typed as an EditableTree.
 * Use built-in JS functions to get more information about the data stored e.g.
 * ```
 * const [context, data] = getEditableTree(forest);
 * for (const key of Object.keys(data)) { ... }
 * // OR
 * if ("foo" in data) { ... }
 * context.free();
 * ```
 *
 * Not (yet) supported: create properties, set values and delete properties.
 *
 * @returns {@link EditableTree} for the given {@link IEditableForest} or {@link ISharedTree}.
 * Also returns an {@link EditableTreeContext} which is used manage the cursors and anchors within the EditableTrees:
 * This is necessary for supporting using this tree across edits to the forest, and not leaking memory.
 */
export function getEditableTree(tree: IEditableForest | ISharedTree):
    [EditableTreeContext, UnwrappedEditableField] {
    const forest = ("forest" in tree ? tree.forest : tree) as IEditableForest;
    const context = new ProxyContext(forest, "forest" in tree ? tree : undefined);

    const cursor = forest.allocateCursor();
    const destination = forest.root(forest.rootField);
    const cursorResult = forest.tryMoveCursorTo(destination, cursor);
    const targets: ProxyTarget[] = [];
    if (cursorResult === TreeNavigationResult.Ok) {
        do {
            targets.push(new ProxyTarget(context, cursor));
        } while (cursor.seek(1) === TreeNavigationResult.Ok);
    }
    cursor.free();
    forest.anchors.forget(destination);
    const rootSchema = forest.schema.lookupGlobalFieldSchema(rootFieldKey);
    return [context, proxifyField(getFieldKind(rootSchema), targets)];
}
