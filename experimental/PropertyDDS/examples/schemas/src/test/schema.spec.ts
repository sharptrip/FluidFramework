// /*!
//  * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
//  * Licensed under the MIT License.
//  */
// import { PropertyFactory } from "@fluid-experimental/property-properties";
// import { StoredSchemaRepository, initializeForest, JsonableTree, buildForest, proxifyForest,
// 	EmptyKey, brand, defaultSchemaPolicy,
// 	JsonCursor, jsonableTreeFromCursor, ITreeCursor, SchemaData, TreeSchemaIdentifier,
// } from "@fluid-internal/tree";

// // import { registerSchemas } from "src/schemasRegisterer";
// import { convertPSetSchema } from "../schemaConverter";
// import PERSON_SCHEMAS from "../person_demo";

// const person: JsonableTree = {
// 	type: brand("Test:Person-1.0.0"),
// 	fields: {
// 		name: [{ value: "Adam", type: brand("String") }],
// 		age: [{ value: 35, type: brand("Int32") }],
// 		salary: [{ value: 10420.2, type: brand("Float32") }],
// 		friends: [{ value: {
// 			Mat: "Mat",
// 		}, type: brand("Map<String>") }],
// 		address: [{
// 			fields: {
// 				street: [{ value: "treeStreet", type: brand("String") }],
// 				zip: [{ type: brand("String") }],
// 				phones: [{
// 					type: brand("Test:Phones-1.0.0"),
// 					fields: {
// 						[EmptyKey as string]: [
// 							{ type: brand("String"), value: "+49123456778" },
// 							{ type: brand("Int32"), value: 123456879 },
// 						],
// 					},
// 				}],
// 			},
// 			type: brand("Test:Address-1.0.0"),
// 		}],
// 	},
// };

// // const emptyPerson: JsonableTree = {
// // 	type: brand("Test:Person-1.0.0"),
// // 	fields: {
// // 		name: [{ type: brand("String") }],
// // 		age: [{ type: brand("Int32") }],
// // 		salary: [{ type: brand("Float32") }],
// // 		friends: [{ type: brand("Map<String>") }],
// // 		address: [{
// // 			fields: {
// // 				street: [{ type: brand("String") }],
// // 				zip: [{ type: brand("String") }],
// // 				phones: [{
// // 					type: brand("Test:Phones-1.0.0"),
// // 					fields: {
// // 						[EmptyKey as string]: [
// // 							{ type: brand("String") },
// // 							{ type: brand("Int32") },
// // 						],
// // 					},
// // 				}],
// // 			},
// // 			type: brand("Test:Address-1.0.0"),
// // 		}],
// // 	},
// // };

// class SchemaCursor extends JsonCursor<unknown> implements ITreeCursor {
// 	private readonly schema: SchemaData;
// 	public constructor(
// 		root: any, schema: SchemaData, public readonly rootType: TreeSchemaIdentifier,
// 	) {
// 		super(root);
// 		this.schema = schema;
// 	}

// 	public get keys() {
// 		const rootType = this.schema.treeSchema.get(this.rootType);
// 		if (!rootType) {
// 			return [];
// 		}
// 		const _keys = [...rootType.localFields.keys()];
// 		return _keys;
// 	}

// 	public get type() {
// 		// const node = this.currentNode;
// 		return "" as TreeSchemaIdentifier;
// 	}

// 	public get value() {
// 		return undefined;
// 	}
// }

// const buildTestProxy = (data: JsonableTree, useSchema?: boolean): any => {
// 	const rootType: TreeSchemaIdentifier = brand("Test:Person-1.0.0");
// 	const schema = new StoredSchemaRepository(defaultSchemaPolicy);
// 	if (useSchema) {
// 		convertPSetSchema(rootType, schema);
// 	}
// 	const forest = buildForest(schema);

// 	const json = { address: { street: "new" }, name: "John" };
// 	const schemaCursor = new SchemaCursor(json, schema, rootType);
// 	const treeData = jsonableTreeFromCursor(schemaCursor);
// 	initializeForest(forest, [treeData]);
// 	// initializeForest(forest, [person]);

// 	// const jsonCursor = new JsonCursor({ address: { street: "new" } });
// 	// const _data = jsonableTreeFromCursor(jsonCursor);
// 	// initializeForest(forest, [_data]);

// 	const proxy = proxifyForest(forest);
// 	return proxy;
// };

// describe("forest-proxy", () => {
// 	beforeAll(() => {
// 		// registerSchemas(PropertyFactory);
// 		PropertyFactory.register(Object.values(PERSON_SCHEMAS));
// 	});

// 	test("schema", () => {
// 		// const proxy1 = buildTestProxy(person);
// 		const proxy2 = buildTestProxy(person, true);
// 		expect(proxy2.address.type).toBe("Test:Address-1.0.0");
// 	});
// });
