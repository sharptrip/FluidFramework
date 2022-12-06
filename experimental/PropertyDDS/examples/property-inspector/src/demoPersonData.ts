/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    brand,
    TreeSchemaIdentifier,
    FieldSchema,
    FieldKindIdentifier,
    Brand,
    EditableField,
    EditableTree,
    LocalFieldKey,
    EditableTreeContext,
} from "@fluid-internal/tree";

export const booleanSchemaName: TreeSchemaIdentifier = brand("Bool");
export const int32SchemaName: TreeSchemaIdentifier = brand("Int32");
export const stringSchemaName: TreeSchemaIdentifier = brand("String");
export const float64SchemaName: TreeSchemaIdentifier = brand("Float64");
export const phonesSchemaName: TreeSchemaIdentifier =
    brand("Test:Phones-1.0.0");
export const addressSchemaName: TreeSchemaIdentifier =
    brand("Test:Address-1.0.0");
export const mapStringSchemaName: TreeSchemaIdentifier = brand("map<string>");
export const personSchemaName: TreeSchemaIdentifier =
    brand("Test:Person-1.0.0");
export const complexPhoneSchemaName: TreeSchemaIdentifier =
    brand("Test:Phone-1.0.0");
export const simplePhonesSchemaName: TreeSchemaIdentifier =
    brand("Test:SimplePhones-1.0.0");

export function getRootFieldSchema(
    fieldKind: FieldKindIdentifier
): FieldSchema {
    return {
        kind: fieldKind,
        types: new Set([personSchemaName]),
    };
}

export type Float64 = Brand<number, "property-inspector-demo.Float64"> &
    EditableTree;
export type Int32 = Brand<number, "property-inspector-demo.Int32"> &
    EditableTree;
export type Bool = Brand<boolean, "property-inspector-demo.Bool"> &
    EditableTree;

export type ComplexPhone = EditableTree &
    Brand<
        {
            number: string;
            prefix: string;
            extraPhones?: SimplePhones;
        },
        "property-inspector-demo.Test:Phone-1.0.0"
    >;

export type SimplePhones = EditableField &
    Brand<string[], "property-inspector-demo.Test:SimplePhones-1.0.0">;

export type Phone = EditableTree &
    Brand<
        Int32 | string | ComplexPhone | SimplePhones,
        "property-inspector-demo.Test:Phone-1.0.0"
    >;

export type Phones = Brand<
    EditableField & Phone[],
    "property-inspector-demo.Test:Phones-1.0.0"
>;

export type Address = EditableTree &
    Brand<
        {
            zip: string | Int32;
            street?: string;
            city?: string;
            country?: string;
            phones?: Phones;
        },
        "property-inspector-demo.Test:Address-1.0.0"
    >;

export type Friends = EditableTree &
    Brand<Record<LocalFieldKey, string>, "property-inspector-demo.Map<string>">;

export type Person = EditableTree &
    Brand<
        {
            name: string;
            age?: Int32;
            adult?: Bool;
            salary?: Float64 | Int32;
            friends?: Friends;
            address?: Address;
        },
        "property-inspector-demo.Test:Person-1.0.0"
    >;

function getHandles(context: EditableTreeContext): {
    Person: (value: object) => Person;
    Float64: (value: number) => Float64;
    Int32: (value: number) => Int32;
    ComplexPhone: (value: object) => ComplexPhone;
    SimplePhones: (value: string[]) => SimplePhones;
} {
    return {
        Person: (value: object) =>
            context.newDetachedNode<Person>(personSchemaName, value),
        Float64: (value: number) =>
            context.newDetachedNode<Float64>(float64SchemaName, value),
        Int32: (value: number) =>
            context.newDetachedNode<Int32>(int32SchemaName, value),
        ComplexPhone: (value: object) =>
            context.newDetachedNode<ComplexPhone>(
                complexPhoneSchemaName,
                value
            ),
        SimplePhones: (value: string[]) =>
            context.newDetachedNode<SimplePhones>(
                simplePhonesSchemaName,
                value
            ),
    };
}

export function getPerson(context: EditableTreeContext): Person {
    const age: Int32 = brand(35);
    const { Person, Float64, Int32, ComplexPhone, SimplePhones } =
        getHandles(context);
    return Person({
        // typed with built-in primitive type
        name: "Adam",
        // explicitly typed
        age,
        // inline typed
        adult: brand<Bool>(true),
        // Float64 | Int32
        salary: Float64(10420.2),
        friends: {
            Mat: "Mat",
        },
        address: {
            // string | Int32
            zip: context.newDetachedNode<string>(stringSchemaName, "99999"),
            street: "treeStreet",
            // (Int32 | string | ComplexPhone | SimplePhones)[]
            phones: [
                context.newDetachedNode(stringSchemaName, "+49123456778"),
                Int32(123456879),
                ComplexPhone({
                    prefix: "0123",
                    number: "012345",
                    extraPhones: ["91919191"],
                }),
                SimplePhones(["112", "113"]),
            ],
        },
    });
}
