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
	valueSymbol,
	typeNameSymbol,
} from "@fluid-internal/tree";

export const defaultPrimitiveValues = {
	"Bool": false,
	"String": "",
	"Int8": 0,
	"Uint8": 0,
	"Int16": 0,
	"Uint16": 0,
	"Int32": 0,
	"Int64": 0,
	"Uint64": 0,
	"Uint32": 0,
	"Float32": 0,
	"Float64": 0,
};

export const booleanSchemaName: TreeSchemaIdentifier = brand("Bool");
export const int32SchemaName: TreeSchemaIdentifier = brand("Int32");
export const stringSchemaName: TreeSchemaIdentifier = brand("String");
export const float64SchemaName: TreeSchemaIdentifier = brand("Float64");
export const phonesSchemaName: TreeSchemaIdentifier = brand("Test:Phones-1.0.0");
export const addressSchemaName: TreeSchemaIdentifier = brand("Test:Address-1.0.0");
export const mapStringSchemaName: TreeSchemaIdentifier = brand("map<string>");
export const personSchemaName: TreeSchemaIdentifier = brand("Test:Person-1.0.0");
export const complexPhoneSchemaName: TreeSchemaIdentifier = brand("Test:Phone-1.0.0");
export const simplePhonesSchemaName: TreeSchemaIdentifier = brand("Test:SimplePhones-1.0.0");

export function getRootFieldSchema(fieldKind: FieldKindIdentifier): FieldSchema {
	return {
		kind: fieldKind,
		types: new Set([personSchemaName]),
	};
}

export type Float64 = Brand<number, "editable-tree-inspector-demo.Float64"> & EditableTree;
export type Int32 = Brand<number, "editable-tree-inspector-demo.Int32"> & EditableTree;
export type Bool = Brand<boolean, "editable-tree-inspector-demo.Bool"> & EditableTree;

export type ComplexPhone = EditableTree &
	Brand<
		{
			number: string;
			prefix: string;
			extraPhones?: SimplePhones;
		},
		"editable-tree-inspector-demo.Test:Phone-1.0.0"
	>;

export type SimplePhones = EditableField &
	Brand<string[], "editable-tree-inspector-demo.Test:SimplePhones-1.0.0">;

export type Phones = EditableField &
	Brand<
		(Int32 | string | ComplexPhone | SimplePhones)[],
		"editable-tree-inspector-demo.Test:Phones-1.0.0"
	>;

export type Address = EditableTree &
	Brand<
		{
			zip: string | Int32;
			street?: string;
			city?: string;
			country?: string;
			phones?: Phones;
			sequencePhones?: SimplePhones;
		},
		"editable-tree-inspector-demo.Test:Address-1.0.0"
	>;

export type Friends = EditableTree &
	Brand<Record<LocalFieldKey, string>, "editable-tree-inspector-demo.Map<string>">;

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
		"editable-tree-inspector-demo.Test:Person-1.0.0"
	>;

export function getPerson(): Person {
	const age: Int32 = brand(35);
	return {
		// typed with built-in primitive type
		name: "Adam",
		// explicitly typed
		age,
		// inline typed
		adult: brand<Bool>(true),
		// Float64 | Int32
		salary: {
			[valueSymbol]: 10420.2,
			[typeNameSymbol]: float64SchemaName,
		},
		friends: {
			Mat: "Mat",
		},
		address: {
			// string | Int32
			zip: "99999",
			street: "treeStreet",
			// (Int32 | string | ComplexPhone | SimplePhones)[]
			phones: [
				"+49123456778",
				123456879,
				{
					[typeNameSymbol]: complexPhoneSchemaName,
					prefix: "0123",
					number: "012345",
					extraPhones: ["91919191"],
				},
				["112", "113"],
			],
		},
	} as unknown as Person; // TODO: fix up these strong types to reflect unwrapping
}
