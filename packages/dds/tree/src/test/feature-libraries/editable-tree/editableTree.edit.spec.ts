/*!
* Copyright (c) Microsoft Corporation and contributors. All rights reserved.
* Licensed under the MIT License.
*/
import { fail, strict as assert } from "assert";
import {
    NamedTreeSchema, namedTreeSchema, ValueSchema, fieldSchema, SchemaData, TreeSchemaIdentifier,
} from "../../../schema-stored";
import { JsonableTree, EmptyKey, detachedFieldAsKey, rootFieldKey } from "../../../tree";
import { ISharedTree } from "../../../shared-tree";
import { TransactionResult } from "../../../checkout";
import { brand, Brand } from "../../../util";
import {
    emptyField, FieldKinds, singleTextCursor,
    getEditableTree, EditableTree, getTypeSymbol, UnwrappedEditableField, EditableTreeContext,
} from "../../../feature-libraries";
import { ITestTreeProvider, TestTreeProvider } from "../../utils";

// TODO: Use typed schema (ex: typedTreeSchema), here, and derive the types below from them programmatically.

const stringSchema = namedTreeSchema({
    name: brand("String"),
    extraLocalFields: emptyField,
    value: ValueSchema.String,
});
const int32Schema = namedTreeSchema({
    name: brand("Int32"),
    extraLocalFields: emptyField,
    value: ValueSchema.Number,
});
const float32Schema = namedTreeSchema({
    name: brand("Float32"),
    extraLocalFields: emptyField,
    value: ValueSchema.Number,
});

const complexPhoneSchema = namedTreeSchema({
    name: brand("Test:Phone-1.0.0"),
    localFields: {
        number: fieldSchema(FieldKinds.value, [stringSchema.name]),
        prefix: fieldSchema(FieldKinds.value, [stringSchema.name]),
    },
    extraLocalFields: emptyField,
});

// This schema is really unnecessary: it could just use a sequence field instead.
// Array nodes are only needed when you want polymorphism over array vs not-array.
// Using this tests handling of array nodes (though it makes this example not cover other use of sequence fields).
const phonesSchema = namedTreeSchema({
    name: brand("Test:Phones-1.0.0"),
    localFields: {
        [EmptyKey]: fieldSchema(FieldKinds.sequence, [stringSchema.name, int32Schema.name, complexPhoneSchema.name]),
    },
    extraLocalFields: emptyField,
});

const addressSchema = namedTreeSchema({
    name: brand("Test:Address-1.0.0"),
    localFields: {
        street: fieldSchema(FieldKinds.value, [stringSchema.name]),
        zip: fieldSchema(FieldKinds.optional, [stringSchema.name]),
        phones: fieldSchema(FieldKinds.value, [phonesSchema.name]),
    },
    extraLocalFields: emptyField,
});

const mapStringSchema = namedTreeSchema({
    name: brand("Map<String>"),
    extraLocalFields: fieldSchema(FieldKinds.value, [stringSchema.name]),
});

const personSchema = namedTreeSchema({
    name: brand("Test:Person-1.0.0"),
    localFields: {
        name: fieldSchema(FieldKinds.value, [stringSchema.name]),
        age: fieldSchema(FieldKinds.value, [int32Schema.name]),
        salary: fieldSchema(FieldKinds.value, [float32Schema.name]),
        friends: fieldSchema(FieldKinds.value, [mapStringSchema.name]),
        address: fieldSchema(FieldKinds.value, [addressSchema.name]),
    },
    extraLocalFields: emptyField,
});

const optionalChildSchema = namedTreeSchema({
    name: brand("Test:OptionalChild-1.0.0"),
    localFields: {
        child: fieldSchema(FieldKinds.optional),
    },
    value: ValueSchema.Serializable,
    extraLocalFields: emptyField,
});

const emptyNode: JsonableTree = { type: optionalChildSchema.name };

const schemaTypes: Set<NamedTreeSchema> = new Set([
    optionalChildSchema,
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

// TODO: derive types like these from those schema, which subset EditableTree

type Int32 = Brand<number, "Int32">;
const newAge: Int32 = brand(55);

type ComplexPhoneType = EditableTree & {
    number: string;
    prefix: string;
};

type AddressType = EditableTree & {
    street: string;
    zip?: string;
    phones?: (number | string | ComplexPhoneType)[];
};

type PersonType = EditableTree & {
    name: string;
    age: Int32;
    salary: number;
    friends: Record<string, string>;
    address: AddressType;
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

let _provider: ITestTreeProvider;

async function setupForest(schema: SchemaData, data: JsonableTree): Promise<readonly ISharedTree[]> {
    const provider = await TestTreeProvider.create(3);
    _provider = provider;
    for (const tree of provider.trees) {
        assert(tree.isAttached());
        const forest = tree.forest;
        forest.schema.updateFieldSchema(rootFieldKey, schema.globalFieldSchema.get(rootFieldKey) ?? fail("oops"));
        for (const [key, value] of schema.treeSchema) {
            forest.schema.updateTreeSchema(key, value);
        }
    }
    provider.trees[0].runTransaction((forest, editor) => {
        const writeCursor = singleTextCursor(data);
        editor.insert({
            parent: undefined,
            parentField: detachedFieldAsKey(forest.rootField),
            parentIndex: 0,
        }, writeCursor);

        return TransactionResult.Apply;
    });
    await provider.ensureSynchronized();
    return provider.trees.slice(1);
}

async function buildTestProxy(data: JsonableTree): Promise<[EditableTreeContext, UnwrappedEditableField]> {
    const trees = await setupForest(fullSchemaData, data);
    return getEditableTree(trees[0]);
}

async function buildTestPerson(): Promise<[EditableTreeContext, PersonType]> {
    const [context, proxy] = await buildTestProxy(personData);
    return [context, proxy as PersonType];
}

describe.only("editing with editable-tree", () => {
    it("update property", async () => {
        const trees = await setupForest(fullSchemaData, personData);
        const [context, person] = getEditableTree(trees[0]);
        const person1 = person as PersonType;
        const [context2, person20] = getEditableTree(trees[1]);
        const person2 = person20 as PersonType;
        person1.address.street = "bla";
        assert.equal(person1.address.street, "bla");
        person1.age = newAge;
        assert.strictEqual(person1.age, newAge);
        const phones = person1.address.phones;
        assert(phones);
        phones[1] = 123;
        assert.equal(person1.address.phones?.[1], 123);
        assert.throws(() => {
            phones[2] = { number: "123", prefix: "456" } as any;
        });
        context2.prepareForEdit();
        await _provider.ensureSynchronized();
        assert.deepEqual(person1, person2);
        context.free();
    });

    it("add property", async () => {
        const [context, person] = await buildTestPerson();
        assert.equal("zip" in person.address, false);
        assert.equal(person.address.zip, undefined);
        const addressType = person.address[getTypeSymbol]();
        assert(addressType !== undefined);
        const zipTypes = addressSchema.localFields.get(brand("zip"))?.types;
        assert(zipTypes !== undefined);
        assert(zipTypes.has(stringSchema.name));
        person.address.zip = "99038";
        assert.equal(person.address.zip, "99038");
        assert.equal("zip" in person.address, true);
        // delete person.address.phones;
        // person.address.phones = [1, 2, 3];
        assert(person.address.phones);
        person.address.phones[3] = 999;
        assert.equal(person.address.phones[3], 999);
        person.address.phones.push("new entry");
        assert.equal(person.address.phones[4], "new entry");
        const morePhones = [1, 2, 3];
        person.address.phones.push(...morePhones);
        assert.throws(() => person.address.phones?.slice(5));
        context.free();
    });

    it("delete property", async () => {
        const [context, person] = await buildTestPerson();
        person.address.zip = "99038";
        delete person.address.zip;
        assert.equal(person.address.zip, undefined);
        assert.equal("zip" in person.address, false);
        context.free();
    });
});
