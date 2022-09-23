/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { assert } from "@fluidframework/common-utils";
import { FieldKey, Value, Anchor, rootFieldKey } from "../../tree";
import {
    IEditableForest, TreeNavigationResult, mapCursorField, ITreeSubscriptionCursor, ITreeSubscriptionCursorState,
} from "../../forest";
import { brand } from "../../util";
import {
    FieldSchema, LocalFieldKey, TreeSchemaIdentifier, TreeSchema, ValueSchema, NamedTreeSchema,
} from "../../schema-stored";
import { FieldKind, Multiplicity } from "../modular-schema";
import { ISharedTree } from "../../shared-tree";
import { TypedJsonCursor } from "../../domains";
import {
    AdaptingProxyHandler,
    adaptWithProxy,
    getFieldKind, getFieldSchema, getPrimaryField, isPrimitive, isPrimitiveValue, PrimitiveValue,
} from "./utilities";
import { EditableTreeContext, ProxyContext } from "./editableTreeContext";

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
 * A symbol to get the node in contexts where string keys are already in use for fields.
 */
 export const nodeSymbol: unique symbol = Symbol("editable-tree:node");

/**
 * {@link EditableTree}, but without fields i.e. having only utility symbols.
 *
 * Usefull if one needs to provide access to supplimentary data for types derived from {@link UnwrappedEditableField}.
 */
export interface FieldlessEditableTree {
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

    get [nodeSymbol](): UnwrappedEditableField;
    set [nodeSymbol](value: UnwrappedEditableField);

    /**
     * Stores the target for the proxy which implements reading and writing for this node.
     * The details of this object are implementation details,
     * but the presence of this symbol can be used to separate EditableTrees from other types.
     */
    readonly [proxyTargetSymbol]: object;
}

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
export interface EditableTree extends FieldlessEditableTree {
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
export type UnwrappedEditableTree = EditableTreeOrPrimitive | UnwrappedEditableSequence;

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

export type UnwrappedEditableSequence = FieldlessEditableTree & readonly UnwrappedEditableTree[];

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

export class ProxyTarget {
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
        this.context.withCursors.add(this);
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

    public prepareAnchorForEdit(): Anchor {
        if (this._anchor === undefined) {
            this._anchor = this.lazyCursor.buildAnchor();
            this.context.withAnchors.add(this);
        }
        this.lazyCursor.clear();
        this.context.withCursors.delete(this);
        return this._anchor;
    }

    public get cursor(): ITreeSubscriptionCursor {
        if (this.lazyCursor.state === ITreeSubscriptionCursorState.Cleared) {
            assert(this.anchor !== undefined,
                0x3c3 /* EditableTree should have an anchor if it does not have a cursor */);
            const result = this.context.forest.tryMoveCursorTo(this.anchor, this.lazyCursor);
            assert(result === TreeNavigationResult.Ok,
                0x3c4 /* It is invalid to access an EditableTree node which no longer exists */);
            this.context.withCursors.add(this);
        }
        return this.lazyCursor;
    }

    public getType(key?: string, nameOnly?: boolean): TreeSchemaIdentifier | TreeSchema | undefined {
        let typeName = this.cursor.type;
        if (key !== undefined) {
            const primaryKey = this.primaryKey;
            if (primaryKey !== undefined) {
                const childTypes = mapCursorField(this.cursor, primaryKey, (c) => c.type);
                typeName = childTypes[Number(key)];
            } else {
                const childTypes = mapCursorField(this.cursor, brand(key), (c) => c.type);
                assert(childTypes.length <= 1, 0x3c5 /* invalid non sequence */);
                typeName = childTypes[0];
            }
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
        for (const key of this.cursor.keys) {
            // TODO: with new cursor API, field iteration will skip empty fields and this check can be removed.
            if (this.has(key as string)) {
                keys.push(key as string);
            }
        }
        return keys;
    }

    public has(key: string): boolean {
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
        // Lookup the schema:
        const fieldKind = this.lookupFieldKind(key as string);
        // Make the childTargets:
        const childTargets = mapCursorField(this.cursor, brand(key as string), (c) => this.context.createNode(c));
        return proxifyField(this.context, fieldKind, childTargets);
    }

    /**
     * Sets value of a non-sequence field.
     * This is correct only if sequence fields are unwrapped into arrays.
     */
    public setValue(key: string, _value: unknown): boolean {
        const primaryKey = this.primaryKey;
        const index = Number(key);
        const _key: FieldKey = primaryKey === undefined ? brand(key) : primaryKey;
        const childTargets = mapCursorField(this.cursor, _key, (c) => this.context.createNode(c));
        const target = primaryKey === undefined ? childTargets[0] : childTargets[index];
        const type = target.getType() as TreeSchema;
        assert(isPrimitive(type), `"Set value" is not supported for non-primitive fields`);
        const path = this.context.forest.anchors.locate(target.prepareAnchorForEdit());
        assertPreparedForEdit(target);
        assert(path !== undefined, "Can't locate a path to set a value");
        return this.context.setNodeValue(path, _value);
    }

    public insertNode(key: string, _value: unknown): boolean {
        const typeName = this.getType(undefined, true) as TreeSchemaIdentifier;
        const primaryKey = this.primaryKey;
        this.context.prepareForEdit();
        assertPreparedForEdit(this);
        const path = this.context.forest.anchors.locate(this.anchor);
        assert(path !== undefined, "Can't locate a path to insert a node");
        const type: NamedTreeSchema = { name: typeName, ...this.context.forest.schema.lookupTreeSchema(typeName) };
        const jsonValue = isPrimitiveValue(_value) ? _value : _value as object;
        const schemaCursor = new TypedJsonCursor(this.context.forest.schema, type, primaryKey ?? brand(key), jsonValue);
        if (primaryKey !== undefined) {
            return this.context.insertNode({
                parent: path,
                parentField: primaryKey,
                parentIndex: Number(key),
            }, schemaCursor);
        }
        return this.context.insertNode({
            parent: path,
            parentField: brand(key),
            parentIndex: 0,
        }, schemaCursor);
    }

    public deleteNode(key: string): boolean {
        const path = this.context.forest.anchors.locate(this.prepareAnchorForEdit());
        assertPreparedForEdit(this);
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

/**
 * A Proxy handler together with a {@link ProxyTarget} implements a basic read/write access to the Forest
 * by means of the cursors.
 */
const handler: AdaptingProxyHandler<ProxyTarget, EditableTree> = {
    get: (target: ProxyTarget, key: string | symbol, receiver: unknown): unknown => {
        if (typeof key === "string") {
            // All string keys are fields
            return target.proxifyField(key);
        }
        switch (key) {
            case getTypeSymbol: {
                return target.getType.bind(target);
            }
            case valueSymbol: {
                return target.value;
            }
            case proxyTargetSymbol: {
                return target;
            }
            default:
                return undefined;
        }
    },
    set: (target: ProxyTarget, key: string, _value: unknown, receiver: unknown): boolean => {
        return target.has(key) ? target.setValue(key, _value) : target.insertNode(key, _value);
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
            if (target.has(key)) {
                return {
                    configurable: true,
                    enumerable: true,
                    value: target.proxifyField(key),
                    writable: true,
                };
            }
        }
        return undefined;
    },
};

class SequenceProxyTarget extends Array<ProxyTarget> {
    constructor(
        public readonly context: ProxyContext,
        public readonly primaryTarget?: ProxyTarget,
        children?: ProxyTarget[],
    ) {
        super(...children ?? []);
        const privateProperties: PropertyKey[] = ["primaryTarget", "context"];
        for (const propertyKey of privateProperties) {
            Object.defineProperty(this, propertyKey,
                { enumerable: false, writable: false, configurable: false, value: Reflect.get(this, propertyKey) });
        }
    }

    public getType(key?: string, nameOnly?: boolean): TreeSchemaIdentifier | TreeSchema | undefined {
        return this.primaryTarget?.getType(key, nameOnly);
    }

    public get value() {
        return this;
    }

    public get length(): number {
        return this.primaryTarget?.getPrimaryArrayLength() ?? 0;
    }

    /**
     * This covers:
     * - []-assignment like arr[n] = "foo". Updates the node if 'n' is an existing index.
     * Inserts the node ("appends") if 'n === length'. Breaks otherwise.
     * - push(...)
     * - unshift(...)
     */
    public setValue(key: string, value: unknown): boolean {
        const primaryKey = this.primaryTarget?.primaryKey;
        assert(primaryKey !== undefined, "Not supported");
        const index = Number(key);
        const length = this.length;
        if (index >= 0 && index < length) {
            return this.primaryTarget?.setValue(key, value) ?? false;
        } else if (index === length) {
            if (this.primaryTarget?.insertNode(key, value) &&
                this.primaryTarget.cursor.down(primaryKey, length) === TreeNavigationResult.Ok) {
                this.push(this.context.createNode(this.primaryTarget.cursor));
                this.primaryTarget.cursor.up();
                return true;
            }
        }
        return false;
    }

    /**
     * {@inheritdoc}
     */
    // TODO: (?) return deleted nodes as a detached array sequence
    splice(start: number, deleteCount?: number, ...items: ProxyTarget[]): ProxyTarget[] {
        throw new Error("Not implemented");
    }

    /**
     * {@inheritdoc}
     */
    // TODO: (?) create a copy of a sequence slice as a detached array sequence
    slice(start?: number, end?: number): ProxyTarget[] {
        throw new Error("Not implemented");
    }

    /**
     * {@inheritdoc}
     */
    pop(): ProxyTarget | undefined {
        throw new Error("Not implemented");
    }

    /**
     * {@inheritdoc}
     */
    shift(): ProxyTarget | undefined {
        throw new Error("Not implemented");
    }

    /**
     * {@inheritdoc}
     */
    reverse(): ProxyTarget[] {
        throw new Error("Not implemented");
    }

    /**
     * {@inheritdoc}
     */
    // TODO: returns a detached sequence of copied existing sequence elements and new elements
    concat(): ProxyTarget[] {
        throw new Error("Not implemented");
    }

    /**
     * {@inheritdoc}
     */
    join(separator?: string): string {
        throw new Error("Not implemented");
    }

    /**
     * {@inheritdoc}
     */
    sort(compareFn?: (a: ProxyTarget, b: ProxyTarget) => number): this {
        throw new Error("Not implemented");
    }

    /**
     * {@inheritdoc}
     */
    indexOf(searchElement: ProxyTarget, index?: number): number {
        throw new Error("Not implemented");
    }

    /**
     * {@inheritdoc}
     */
    lastIndexOf(searchElement: ProxyTarget, index?: number): number {
        throw new Error("Not implemented");
    }

    /**
     * {@inheritdoc}
     */
    reduce<U>(
        callbackfn: (previousValue: U, currentValue: ProxyTarget, currentIndex: number, array: ProxyTarget[]) => U,
        initialValue?: U): U {
        throw new Error("Not implemented");
    }

    /**
     * {@inheritdoc}
     */
    reduceRight<U>(
        callbackfn: (previousValue: U, currentValue: ProxyTarget, currentIndex: number, array: ProxyTarget[]) => U,
        initialValue?: U): U {
        throw new Error("Not implemented");
    }

    /**
     * {@inheritdoc}
     */
    filter(predicate: (value: ProxyTarget, index: number, array: ProxyTarget[]) => unknown, thisArg?: any):
        ProxyTarget[] {
        throw new Error("Not implemented");
    }
}

const sequenceHandler: AdaptingProxyHandler<SequenceProxyTarget, UnwrappedEditableSequence> = {
    get: (target: SequenceProxyTarget, key: string | symbol, receiver: object): unknown => {
        if (typeof key === "string") {
            const reflected = Reflect.get(target, key);
            if (typeof reflected === "function") {
                if (key === "constructor") {
                    return [][key];
                }
                return function(...args: unknown[]): unknown {
                    return Reflect.apply(reflected, receiver, args);
                };
            }
            const index = Number(key);
            if (key === "length") {
                return target.length;
            } else if (index >= 0 && index < target.length) {
                return inProxyOrUnwrap(target.context, target[index]);
            }
        }
        switch (key) {
            case getTypeSymbol:
                return target.getType.bind(target);
            case valueSymbol:
            case proxyTargetSymbol:
                return target;
            default:
                return Reflect.get(target, key);
        }
    },
    set: (target: SequenceProxyTarget, key: string, value: unknown, receiver: unknown): boolean => {
        if (key === "length") {
            return target.length === value;
        }
        return target.setValue(key, value);
    },
    deleteProperty: (target: SequenceProxyTarget, key: string): boolean => {
        throw new Error("Not supported");
    },
    // Include documented symbols (except value when value is undefined) and all non-empty fields.
    has: (target: SequenceProxyTarget, key: string | symbol): boolean => {
        if (typeof key === "symbol") {
            switch (key) {
                case proxyTargetSymbol:
                case getTypeSymbol:
                case valueSymbol:
                    return true;
                default:
                    return Reflect.has(target, key);
            }
        }
        return Reflect.has(target, key);
    },
    getOwnPropertyDescriptor: (target: SequenceProxyTarget, key: string | symbol): PropertyDescriptor | undefined => {
        // We generally don't want to allow users of the proxy to reconfigure all the properties,
        // but it is a TypeError to return non-configurable for properties that do not exist on target,
        // so they must return true.
        if (typeof key === "symbol") {
            if (key === proxyTargetSymbol || key === valueSymbol) {
                return { configurable: true, enumerable: false, value: target, writable: false };
            } else if (key === getTypeSymbol) {
                return { configurable: true, enumerable: false, value: target.getType.bind(target), writable: false };
            }
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
    },
};

/**
 * See {@link UnwrappedEditableField} for documentation on what unwrapping this perform.
 */
function inProxyOrUnwrap(context: ProxyContext, target: ProxyTarget): UnwrappedEditableTree {
    const fieldSchema = target.getType() as TreeSchema;
    if (isPrimitive(fieldSchema)) {
        const nodeValue = target.value;
        if (isPrimitiveValue(nodeValue)) {
            return nodeValue;
        }
        assert(fieldSchema.value === ValueSchema.Serializable,
            0x3c7 /* `undefined` values not allowed for primitive fields */);
    }
    const primaryKey = target.primaryKey;
    if (primaryKey !== undefined) {
        const sequenceTarget = new SequenceProxyTarget(context, target);
        mapCursorField(target.cursor, primaryKey, (c) => sequenceTarget.push(target.context.createNode(c)));
        return adaptWithProxy(sequenceTarget, sequenceHandler);
    }
    return adaptWithProxy(target, handler);
}

/**
 * @param fieldKind - determines how return value should be typed. See {@link UnwrappedEditableField}.
 * @param childTargets - targets for the children of the field.
 */
function proxifyField(context: ProxyContext, fieldKind: FieldKind, childTargets: ProxyTarget[]):
    UnwrappedEditableField {
    if (fieldKind.multiplicity === Multiplicity.Sequence) {
        // Return array for sequence fields
        return childTargets.map((target) => inProxyOrUnwrap(context, target));
    }
    // Avoid wrapping non-sequence fields in arrays
    assert(childTargets.length <= 1, 0x3c8 /* invalid non sequence */);
    return childTargets.length === 1 ? inProxyOrUnwrap(context, childTargets[0]) : undefined;
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
export function getEditableTree(from: ISharedTree | IEditableForest):
    [EditableTreeContext, UnwrappedEditableField] {
    const tree = "forest" in from ? from : undefined;
    const forest = (tree?.forest ?? from) as IEditableForest;
    const context = new ProxyContext(forest, tree);
    const cursor = forest.allocateCursor();
    const rootAnchor = forest.root(forest.rootField);
    const cursorResult = forest.tryMoveCursorTo(rootAnchor, cursor);
    const targets: ProxyTarget[] = [];
    if (cursorResult === TreeNavigationResult.Ok) {
        do {
            targets.push(context.createNode(cursor));
        } while (cursor.seek(1) === TreeNavigationResult.Ok);
    }
    cursor.free();
    forest.anchors.forget(rootAnchor);
    const rootSchema = forest.schema.lookupGlobalFieldSchema(rootFieldKey);
    return [context, proxifyField(context, getFieldKind(rootSchema), targets)];
}
