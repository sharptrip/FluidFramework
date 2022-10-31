/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { validateAssertionError } from "@fluidframework/test-runtime-utils";
import { FieldKey, JsonableTree, LocalFieldKey, SchemaData } from "../../../core";
import { ISharedTree } from "../../../shared-tree";
import { brand } from "../../../util";
import {
    singleTextCursor,
    isUnwrappedNode,
    newFieldSymbol,
    getWithoutUnwrappingSymbol,
    isEditableField,
    typeNameSymbol,
} from "../../../feature-libraries";
import { ITestTreeProvider, TestTreeProvider } from "../../utils";
// eslint-disable-next-line import/no-internal-modules
import { getPrimaryField } from "../../../feature-libraries/editable-tree/utilities";
import {
    complexPhoneSchema,
    ComplexPhoneType,
    float32Schema,
    fullSchemaData,
    Int32,
    int32Schema,
    personData,
    PersonType,
    phonesSchema,
    PhonesType,
    stringSchema,
} from "./mockData";

async function createSharedTrees(
    schemaData: SchemaData,
    data?: JsonableTree[],
    numberOfTrees = 1,
): Promise<readonly [ITestTreeProvider, readonly ISharedTree[]]> {
    const provider = await TestTreeProvider.create(numberOfTrees);
    for (const tree of provider.trees) {
        assert(tree.isAttached());
    }
    provider.trees[0].storedSchema.update(schemaData);
    if (data) {
        provider.trees[0].context.root.insertNodes(0, data.map(singleTextCursor));
    }
    await provider.ensureSynchronized();
    return [provider, provider.trees];
}

describe("editing with editable-tree", () => {
    it("create field via EditableField", async () => {
        const zip: LocalFieldKey = brand("zip");
        const [provider, trees] = await createSharedTrees(fullSchemaData, [personData], 2);
        const person = trees[0].root as PersonType;
        assert.equal("zip" in person.address, false);
        assert.equal(person.address.zip, undefined);
        const cursor = singleTextCursor({ value: "99038", type: stringSchema.name });
        assert(isUnwrappedNode(person.address));
        const zipField = person.address[getWithoutUnwrappingSymbol](zip);
        const person2 = trees[1].root as PersonType;
        const zipField2 = person2.address[getWithoutUnwrappingSymbol](zip);
        assert.deepEqual(zipField, zipField2);
        zipField.insertNodes(0, [cursor]);
        assert.equal(zipField[0], "99038");
        await provider.ensureSynchronized();
        assert.equal(zipField2[0], "99038");
        assert.equal(person.address.zip, "99038");
        assert.equal(zip in person.address, true);
        assert.deepEqual(person, trees[1].root);
        trees[0].context.free();
        trees[1].context.free();
    });

    it("create field via EditableTree", async () => {
        const zip: LocalFieldKey = brand("zip");
        const [provider, trees] = await createSharedTrees(fullSchemaData, [personData], 2);
        const person = trees[0].root as PersonType;
        assert.equal(zip in person.address, false);
        assert.equal(person.address.zip, undefined);
        const cursor = singleTextCursor({ value: "123.456", type: float32Schema.name });
        assert(isUnwrappedNode(person.address));
        person.address[newFieldSymbol](zip, cursor);
        assert.equal(zip in person.address, true);
        assert.equal(person.address.zip, "123.456");
        assert.throws(
            () => person.address[newFieldSymbol](zip, cursor),
            (e) => validateAssertionError(e, "The field already exists."),
            "Expected exception was not thrown",
        );
        await provider.ensureSynchronized();
        assert.deepEqual(person, trees[1].root);
        trees[0].context.free();
        trees[1].context.free();
    });

    it("update property", async () => {
        const newAge: Int32 = brand(55);
        const [provider, trees] = await createSharedTrees(fullSchemaData, [personData], 2);
        const person1 = trees[0].root as PersonType;
        const person2 = trees[1].root as PersonType;
        person1.address[newFieldSymbol](
            brand("zip"),
            singleTextCursor({ type: stringSchema.name }),
        );
        person1.address.zip = "99";
        assert.equal(person1.address.zip, "99");
        person1.age = newAge;
        assert.equal(person1.age, newAge);
        assert(isEditableField(person1.address.phones));
        person1.address.phones[0] = "abc";
        assert.equal(person1.address.phones[0], "abc");
        assert.throws(
            () => {
                assert(isEditableField(person1.address.phones));
                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                person1.address.phones[2] = {} as ComplexPhoneType;
            },
            (e) => validateAssertionError(e, "Cannot set a value of a non-primitive field"),
            "Expected exception was not thrown",
        );
        await provider.ensureSynchronized();
        assert.equal(person1.age, person2.age);
        assert.equal(person1.address.zip, person2.address.zip);
        assert(isEditableField(person2.address.phones));
        assert.equal(person1.address.phones[0], person2.address.phones[0]);
        trees[0].context.free();
        trees[1].context.free();
    });

    it("delete property", async () => {
        const [provider, trees] = await createSharedTrees(fullSchemaData, [personData], 2);
        const person = trees[0].root as PersonType;
        assert(isUnwrappedNode(person.address));
        const complexPhone = person.address.phones?.[2] as ComplexPhoneType;
        // reify all children
        [...complexPhone].map((f) => f);
        delete person.address.phones;
        assert.throws(() => complexPhone[typeNameSymbol]);
        assert.equal(person.address.phones, undefined);
        assert.equal("phones" in person.address, false);
        // make sure new data does not overlap with deleted nodes
        const primary = getPrimaryField(phonesSchema);
        assert(primary !== undefined);
        const phonesCursor = singleTextCursor({
            type: phonesSchema.name,
            fields: {
                [primary.key]: [],
            },
        });
        person.address[newFieldSymbol]("phones" as FieldKey, phonesCursor);
        assert(isEditableField(person.address.phones));
        const phones = person.address.phones as PhonesType;
        assert(phones.length === 0);
        [
            {
                type: complexPhoneSchema.name,
                fields: {
                    number: [{ value: "12345", type: stringSchema.name }],
                    prefix: [{ value: "987", type: stringSchema.name }],
                },
            },
            { type: stringSchema.name, value: "112" },
            { type: int32Schema.name, value: 1 },
        ].forEach((phone) => {
            phones.insertNodes(0, [singleTextCursor(phone)]);
        });
        assert.equal(phones[0], 1);
        assert.equal(phones[1], "112");
        phones.deleteNodes(1, 1);
        assert.throws(
            () => phones.deleteNodes(2),
            (e) => validateAssertionError(e, "Index must be in a range of existing node indices."),
            "Expected exception was not thrown",
        );
        const newComplexPhone = phones[1] as ComplexPhoneType;
        assert(isUnwrappedNode(newComplexPhone));
        assert.equal(newComplexPhone.number, "12345");
        assert.equal(newComplexPhone.prefix, "987");
        assert.equal(phones.length, 2);
        phones.deleteNodes(0, 5);
        assert.equal(phones.length, 0);
        await provider.ensureSynchronized();
        assert.deepEqual(person, trees[1].root);
        trees[0].context.free();
        trees[1].context.free();
    });
});
