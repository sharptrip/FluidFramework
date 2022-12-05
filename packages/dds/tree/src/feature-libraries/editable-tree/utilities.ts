/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { assert } from "@fluidframework/common-utils";
import { brand, fail } from "../../util";
import {
    EmptyKey,
    FieldKey,
    isGlobalFieldKey,
    keyFromSymbol,
    Value,
    TreeSchema,
    ValueSchema,
    FieldSchema,
    LocalFieldKey,
    SchemaDataAndPolicy,
    lookupGlobalFieldSchema,
    TreeSchemaIdentifier,
    lookupTreeSchema,
    MapTree,
    ITreeCursor,
    TreeValue,
} from "../../core";
// TODO:
// This module currently is assuming use of defaultFieldKinds.
// The field kinds should instead come from a view schema registry thats provided somewhere.
import { fieldKinds } from "../defaultFieldKinds";
import { FieldKind, Multiplicity } from "../modular-schema";
import { singleMapTreeCursor } from "../mapTreeCursor";
import { ProxyContext } from "./editableTreeContext";

/**
 * @returns true iff `schema` trees should default to being viewed as just their value when possible.
 *
 * Note that this may return true for some types which can not be unwrapped to just their value,
 * since EditableTree avoids ever unwrapping primitives that are objects
 * so users checking for primitives by type won't be broken.
 * Checking for this object case is done elsewhere.
 */
export function isPrimitive(schema: TreeSchema): boolean {
    // TODO: use a separate `TreeViewSchema` type, with metadata that determines if the type is primitive.
    // Since the above is not done yet, use use a heuristic:
    return (
        schema.value !== ValueSchema.Nothing &&
        schema.localFields.size === 0 &&
        schema.globalFields.size === 0
    );
}

export type PrimitiveValue = string | boolean | number;

export function isPrimitiveValue(nodeValue: Value): nodeValue is PrimitiveValue {
    return nodeValue !== undefined && typeof nodeValue !== "object";
}

export function assertPrimitiveValueType(nodeValue: Value, schema: TreeSchema): void {
    assert(isPrimitiveValue(nodeValue), 0x45b /* The value is not primitive */);
    switch (schema.value) {
        case ValueSchema.String:
            assert(typeof nodeValue === "string", 0x45c /* Expected string */);
            break;
        case ValueSchema.Number:
            assert(typeof nodeValue === "number", 0x45d /* Expected number */);
            break;
        case ValueSchema.Boolean:
            assert(typeof nodeValue === "boolean", 0x45e /* Expected boolean */);
            break;
        default:
            fail("wrong value schema");
    }
}

export function getPrimaryField(
    schema: TreeSchema,
): { key: LocalFieldKey; schema: FieldSchema } | undefined {
    // TODO: have a better mechanism for this. See note on EmptyKey.
    const field = schema.localFields.get(EmptyKey);
    if (field === undefined) {
        return field;
    }
    return { key: EmptyKey, schema: field };
}

// TODO: this (and most things in this file) should use ViewSchema, and already have the full kind information.
export function getFieldSchema(
    field: FieldKey,
    schemaData: SchemaDataAndPolicy,
    schema?: TreeSchema,
): FieldSchema {
    if (isGlobalFieldKey(field)) {
        return lookupGlobalFieldSchema(schemaData, keyFromSymbol(field));
    }
    assert(
        schema !== undefined,
        0x423 /* The field is a local field, a parent schema is required. */,
    );
    return schema.localFields.get(field) ?? schema.extraLocalFields;
}

export function getFieldKind(fieldSchema: FieldSchema): FieldKind {
    // TODO:
    // This module currently is assuming use of defaultFieldKinds.
    // The field kinds should instead come from a view schema registry thats provided somewhere.
    return fieldKinds.get(fieldSchema.kind) ?? fail("missing field kind");
}

/**
 * Returns the type of the child node according to its parent field's schema,
 * iff the field is not polymorphic i.e. mono-typed.
 */
export function tryGetNodeType(fieldSchema: FieldSchema): TreeSchemaIdentifier {
    const types = fieldSchema.types ?? fail("missing field types");
    assert(types.size === 1, "Cannot resolve the type");
    const type = [...types][0];
    return type;
}

/**
 * Variant of ProxyHandler covering when the type of the target and implemented interface are different.
 * Only the parts needed so far are included.
 */
export interface AdaptingProxyHandler<T extends object, TImplements extends object> {
    // apply?(target: T, thisArg: any, argArray: any[]): any;
    // construct?(target: T, argArray: any[], newTarget: Function): object;
    // defineProperty?(target: T, p: string | symbol, attributes: PropertyDescriptor): boolean;
    deleteProperty?(target: T, p: string | symbol): boolean;
    get?(target: T, p: string | symbol, receiver: unknown): unknown;
    getOwnPropertyDescriptor?(target: T, p: string | symbol): PropertyDescriptor | undefined;
    // getPrototypeOf?(target: T): object | null;
    has?(target: T, p: string | symbol): boolean;
    // isExtensible?(target: T): boolean;
    ownKeys?(target: T): ArrayLike<keyof TImplements>;
    // preventExtensions?(target: T): boolean;
    set?(target: T, p: string | symbol, value: unknown, receiver: unknown): boolean;
    // setPrototypeOf?(target: T, v: object | null): boolean;
}

export function adaptWithProxy<From extends object, To extends object>(
    target: From,
    proxyHandler: AdaptingProxyHandler<From, To>,
): To {
    // Proxy constructor assumes handler emulates target's interface.
    // Ours does not, so this cast is required.
    return new Proxy<From>(target, proxyHandler as ProxyHandler<From>) as unknown as To;
}

export function getOwnArrayKeys(length: number): string[] {
    return Object.getOwnPropertyNames(Array.from(Array(length)));
}

export function keyIsValidIndex(key: string | number, length: number): boolean {
    const index = Number(key);
    if (typeof key === "string" && String(index) !== key) return false;
    return Number.isInteger(index) && 0 <= index && index < length;
}

export function cursorFromData(
    context: ProxyContext,
    fieldSchema: FieldSchema,
    data: unknown,
): ITreeCursor {
    const node = createDetachedNode(context.forest.schema, fieldSchema, data);
    if (fieldSchema.types !== undefined) {
        assert(fieldSchema.types.has(node.type), "The type does not match the field schema");
    }
    return singleMapTreeCursor(node);
}

function createDetachedNode(
    schema: SchemaDataAndPolicy,
    fieldSchema: FieldSchema,
    data: unknown,
): DetachedNode {
    return data instanceof DetachedNode
        ? data
        : new DetachedNode(schema, tryGetNodeType(fieldSchema), data);
}

export class DetachedNode implements MapTree {
    public readonly fields: Map<FieldKey, MapTree[]> = new Map();
    public readonly value?: TreeValue;

    constructor(
        public readonly schema: SchemaDataAndPolicy,
        public readonly type: TreeSchemaIdentifier,
        value: unknown,
    ) {
        if (isPrimitiveValue(value)) {
            assertPrimitiveValueType(value, lookupTreeSchema(this.schema, this.type));
            this.value = value;
        } else {
            this.setFields(value);
        }
    }

    private setFields(value: unknown): void {
        if (value === undefined) return;
        assert(typeof value === "object" && value !== null, "TODO");
        const nodeSchema = lookupTreeSchema(this.schema, this.type);
        const primary = getPrimaryField(nodeSchema);
        if (Array.isArray(value) || primary !== undefined) {
            assert(Array.isArray(value), "expected array");
            assert(primary !== undefined, "expected primary field");
            this.fields.set(
                primary.key,
                value.map((v) => createDetachedNode(this.schema, primary.schema, v)),
            );
        } else {
            for (const propertyKey of Reflect.ownKeys(value)) {
                const childFieldKey: FieldKey = brand(propertyKey);
                const childValue = Reflect.get(value, propertyKey);
                const fieldSchema = getFieldSchema(childFieldKey, this.schema, nodeSchema);
                const fieldKind = getFieldKind(fieldSchema);
                if (fieldKind.multiplicity === Multiplicity.Sequence) {
                    assert(Array.isArray(childValue), "expected array");
                    this.fields.set(
                        childFieldKey,
                        childValue.map((v) => createDetachedNode(this.schema, fieldSchema, v)),
                    );
                } else {
                    this.fields.set(childFieldKey, [
                        createDetachedNode(this.schema, fieldSchema, childValue),
                    ]);
                }
            }
        }
    }
}
