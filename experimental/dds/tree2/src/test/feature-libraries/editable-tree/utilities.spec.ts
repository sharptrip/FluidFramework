/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { fail, strict as assert } from "assert";
import {
	FieldKinds,
	Multiplicity,
	getPrimaryField,
	getFieldKind,
	getFieldSchema,
	TreeFieldSchema,
} from "../../../feature-libraries";
import { FieldKey, TreeFieldStoredSchema, EmptyKey } from "../../../core";
import {
	isPrimitive,
	getOwnArrayKeys,
	keyIsValidIndex,
	// eslint-disable-next-line import/no-internal-modules
} from "../../../feature-libraries/editable-tree/utilities";
import { leaf } from "../../../domains";
import { arraySchema, buildTestSchema, mapStringSchema, optionalChildSchema } from "./mockData";

describe("editable-tree utilities", () => {
	it("isPrimitive", () => {
		assert(isPrimitive(leaf.number));
		assert(isPrimitive(leaf.string));
		assert(!isPrimitive(mapStringSchema));
		assert(!isPrimitive(optionalChildSchema));
	});

	it("field utils", () => {
		const schema =
			arraySchema.objectNodeFields.get(EmptyKey) ?? fail("Expected primary array field");
		const expectedPrimary: { key: FieldKey; schema: TreeFieldStoredSchema } = {
			key: EmptyKey,
			schema,
		};

		const rootSchema = TreeFieldSchema.create(FieldKinds.required, [arraySchema]);
		const fullSchemaData = buildTestSchema(rootSchema);
		const primary = getPrimaryField(arraySchema);
		assert(primary !== undefined);
		assert.deepEqual(getFieldSchema(primary.key, arraySchema), schema);
		assert.equal(
			getFieldKind(getFieldSchema(primary.key, arraySchema)).multiplicity,
			Multiplicity.Sequence,
		);
		assert.deepEqual(primary, expectedPrimary);
		assert(getPrimaryField(optionalChildSchema) === undefined);
		assert(getPrimaryField(mapStringSchema) === undefined);
	});

	it("get array-like keys", () => {
		assert.deepEqual(getOwnArrayKeys(1), Object.getOwnPropertyNames([""]));
		assert.deepEqual(getOwnArrayKeys(0), Object.getOwnPropertyNames([]));
		assert.deepEqual(getOwnArrayKeys(1), [...Object.keys([""]), "length"]);
		assert.deepEqual(getOwnArrayKeys(0), [...Object.keys([]), "length"]);
	});

	it("key is a valid array index", () => {
		assert.equal(keyIsValidIndex(0, 1), true);
		assert.equal(keyIsValidIndex(0, 0), false);
		assert.equal(keyIsValidIndex("0", 1), true);
		assert.equal(keyIsValidIndex("0", 0), false);
		assert.equal(keyIsValidIndex("0.0", 1), false);
		assert.equal(keyIsValidIndex(-1, 2), false);
		assert.equal(keyIsValidIndex("-1", 2), false);
		assert.equal(keyIsValidIndex("-1.5", 2), false);
		assert.equal(keyIsValidIndex("1.5", 2), false);
		assert.equal(keyIsValidIndex("1.x", 2), false);
		assert.equal(keyIsValidIndex("-1.x", 2), false);
		assert.equal(keyIsValidIndex(NaN, 1), false);
		assert.equal(keyIsValidIndex(Infinity, 1), false);
		assert.equal(keyIsValidIndex("NaN", 1), false);
		assert.equal(keyIsValidIndex("Infinity", 1), false);
	});
});
