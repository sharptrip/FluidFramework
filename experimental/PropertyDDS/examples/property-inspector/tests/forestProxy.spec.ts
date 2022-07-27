/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import { JsonableTree, ObjectForest, TextCursor } from "@fluid-internal/tree";
import { brand } from "@fluid-internal/tree/dist/util";
import { registerSchemas } from "@fluid-experimental/schemas";
import { PropertyFactory } from "@fluid-experimental/property-properties";

import { getForestProxy } from "../src/forestProxy";
import { convertPSetSchema } from "../src/schemaConverter";

describe("Forest proxy", () => {
	let forest: ObjectForest;
	const data: JsonableTree = {
		type: brand("Test:Person-1.0.0"),
		fields: {
			name: [{ value: "Adam", type: brand("String") }],
			age: [{ value: 35, type: brand("Int32") }],
			salary: [{ value: 10420.2, type: brand("Float32") }],
			friends: [{ value: {
				Mat: "Mat",
			}, type: brand("Map<String>") }],
			address: [{
				fields: {
					street: [{ value: "treeStreet", type: brand("String") }],
				},
				type: brand("Test:Address-1.0.0"),
			}],
		},
	};

	beforeAll(() => registerSchemas(PropertyFactory));

	beforeEach(() => {
		forest = new ObjectForest();
		convertPSetSchema("Test:Person-1.0.0", forest.schema);
		// Not sure how best to create data from Schema
		const cursor = new TextCursor(data);
		const newRange = forest.add([cursor]);
		const dst = { index: 0, range: forest.rootField };
		forest.attachRangeOfChildren(dst, newRange);
	});

	it("Should be able to proxify forest", () => {
		const proxy = getForestProxy(forest.allocateCursor(), forest);
		expect(proxy).toBeDefined();
		expect(Object.keys(proxy).length).toBeGreaterThan(0);
	});
});
