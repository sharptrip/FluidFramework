/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import { fail } from "assert";
import {
    EmptyKey, JsonableTree,
	brand, TreeSchemaIdentifier, FieldSchema, FieldKindIdentifier,
	ValueSchema, emptyField, FieldKinds, NamedTreeSchema, SchemaData, rootFieldKey,
    ISharedTree, singleTextCursor, TransactionResult,
} from "@fluid-internal/tree";
import { detachedFieldAsKey } from "@fluid-internal/tree/dist/tree";
// import { convertPSetSchema } from "@fluid-experimental/schemas";

const stringSchema: NamedTreeSchema = {
    name: brand("String"),
    localFields: new Map(),
    extraLocalFields: emptyField,
    globalFields: new Set(),
    extraGlobalFields: false,
    value: ValueSchema.String,
};
const int32Schema: NamedTreeSchema = {
    name: brand("Int32"),
    localFields: new Map(),
    extraLocalFields: emptyField,
    globalFields: new Set(),
    extraGlobalFields: false,
    value: ValueSchema.Number,
};

const float32Schema: NamedTreeSchema = {
    name: brand("Float32"),
    localFields: new Map(),
    extraLocalFields: emptyField,
    globalFields: new Set(),
    extraGlobalFields: false,
    value: ValueSchema.Number,
};

export function fieldSchema(
    kind: { identifier: FieldKindIdentifier; },
    types?: Iterable<TreeSchemaIdentifier>,
): FieldSchema {
    return {
        kind: kind.identifier,
        types: types === undefined ? undefined : new Set(types),
    };
}

const complexPhoneSchema: NamedTreeSchema = {
    name: brand("Test:Phone-1.0.0"),
    localFields: new Map([
        [brand("number"), fieldSchema(FieldKinds.value, [stringSchema.name])],
        [brand("prefix"), fieldSchema(FieldKinds.value, [stringSchema.name])],
    ]),
    extraLocalFields: emptyField,
    globalFields: new Set(),
    extraGlobalFields: false,
    value: ValueSchema.Nothing,
};

// This schema is really unnecessary: it could just use a sequence field instead.
// Array nodes are only needed when you want polymorphism over array vs not-array.
// Using this tests handling of array nodes (though it makes this example not cover other use of sequence fields).
const phonesSchema: NamedTreeSchema = {
    name: brand("Test:Phones-1.0.0"),
    localFields: new Map([
        [EmptyKey, fieldSchema(FieldKinds.sequence, [stringSchema.name, int32Schema.name, complexPhoneSchema.name])],
    ]),
    extraLocalFields: emptyField,
    globalFields: new Set(),
    extraGlobalFields: false,
    value: ValueSchema.Nothing,
};

const addressSchema: NamedTreeSchema = {
    name: brand("Test:Address-1.0.0"),
    localFields: new Map([
        [brand("street"), fieldSchema(FieldKinds.value, [stringSchema.name])],
        [brand("zip"), fieldSchema(FieldKinds.optional, [stringSchema.name])],
        [brand("phones"), fieldSchema(FieldKinds.value, [phonesSchema.name])],
    ]),
    extraLocalFields: emptyField,
    globalFields: new Set(),
    extraGlobalFields: false,
    value: ValueSchema.Nothing,
};

const mapStringSchema: NamedTreeSchema = {
    name: brand("Map<String>"),
    localFields: new Map(),
    extraLocalFields: fieldSchema(FieldKinds.value, [stringSchema.name]),
    globalFields: new Set(),
    extraGlobalFields: false,
    value: ValueSchema.Nothing,
};

const personSchema: NamedTreeSchema = {
    name: brand("Test:Person-1.0.0"),
    localFields: new Map([
        [brand("name"), fieldSchema(FieldKinds.value, [stringSchema.name])],
        [brand("age"), fieldSchema(FieldKinds.value, [int32Schema.name])],
        [brand("salary"), fieldSchema(FieldKinds.value, [float32Schema.name])],
        [brand("friends"), fieldSchema(FieldKinds.value, [mapStringSchema.name])],
        [brand("address"), fieldSchema(FieldKinds.value, [addressSchema.name])],
    ]),
    extraLocalFields: emptyField,
    globalFields: new Set(),
    extraGlobalFields: false,
    value: ValueSchema.Nothing,
};

const schemaTypes: Set<NamedTreeSchema> = new Set([
    stringSchema,
    float32Schema,
    int32Schema,
    complexPhoneSchema,
    phonesSchema,
    addressSchema,
    mapStringSchema,
    personSchema,
]);

const schemaMap: Map<TreeSchemaIdentifier, NamedTreeSchema> = new Map();
for (const named of schemaTypes) {
    schemaMap.set(named.name, named);
}

const rootPersonSchema = fieldSchema(FieldKinds.value, [personSchema.name]);

const fullSchemaData: SchemaData = {
    treeSchema: schemaMap,
    globalFieldSchema: new Map([[rootFieldKey, rootPersonSchema]]),
};

const personData: JsonableTree = {
    type: personSchema.name,
    fields: {
        name: [{ value: "Adam", type: stringSchema.name }],
        age: [{ value: 35, type: int32Schema.name }],
        salary: [{ value: 10420.2, type: float32Schema.name }],
        friends: [{ fields: {
            Mat: [{ type: stringSchema.name, value: "Mat" }],
        }, type: mapStringSchema.name }],
        address: [{
            fields: {
                street: [{ value: "treeStreet", type: stringSchema.name }],
                phones: [{
                    type: phonesSchema.name,
                    fields: {
                        [EmptyKey]: [
                            { type: stringSchema.name, value: "+49123456778" },
                            { type: int32Schema.name, value: 123456879 },
                            { type: complexPhoneSchema.name, fields: {
                                number: [{ value: "012345", type: stringSchema.name }],
                                prefix: [{ value: "0123", type: stringSchema.name }],
                            } },
                        ],
                    },
                }],
            },
            type: addressSchema.name,
        }],
    },
};

async function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function buildProxy(tree: ISharedTree, initiate: boolean = false) {
	// const rootType: TreeSchemaIdentifier = brand("Test:Person-1.0.0");
	// const schema = new StoredSchemaRepository(defaultSchemaPolicy, fullSchemaData);
	// if (useSchema) {
	// 	// convertPSetSchema(rootType, schema);
	// }
	// const forest = buildForest(schema);

	// const json = { address: { street: "new" }, name: "John" };
	// const schemaCursor = new SchemaCursor(json, schema, rootType);
	// const treeData = jsonableTreeFromCursor(schemaCursor);
	// initializeForest(forest, [treeData]);
	// initializeForest(forest, [personData]);

	// const jsonCursor = new JsonCursor({ address: { street: "new" } });
	// const _data = jsonableTreeFromCursor(jsonCursor);
	// initializeForest(forest, [_data]);

    const schema = fullSchemaData.globalFieldSchema.get(rootFieldKey) ?? fail("oops");
    const forest = tree.forest;
    forest.schema.updateFieldSchema(rootFieldKey, schema);
    for (const [key, value] of fullSchemaData.treeSchema) {
        forest.schema.updateTreeSchema(key, value);
    }

    await delay(2000);

    if (initiate) {
        tree.runTransaction((_forest, editor) => {
            const writeCursor = singleTextCursor(personData);
            editor.insert({
                parent: undefined,
                parentField: detachedFieldAsKey(_forest.rootField),
                parentIndex: 0,
            }, writeCursor);

            return TransactionResult.Apply;
        });
    }
}
