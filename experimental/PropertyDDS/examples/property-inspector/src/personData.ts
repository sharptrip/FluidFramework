/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import { StoredSchemaRepository, initializeForest, JsonableTree, buildForest, proxifyForest,
	EmptyKey,
	brand, defaultSchemaPolicy, TreeSchemaIdentifier,
	// JsonCursor, jsonableTreeFromCursor, ITreeCursor, SchemaData,
} from "@fluid-internal/tree";
import { convertPSetSchema } from "@fluid-experimental/schemas";

export const person: JsonableTree = {
	type: brand("Test:Person-1.0.0"),
	fields: {
		name: [{ value: "Adam", type: brand("String") }],
		age: [{ value: 35, type: brand("Int32") }],
		salary: [{ value: 10420.2, type: brand("Float32") }],
		friends: [{
			// value: {
			// 	Mat: "Mat",
			// },
			type: brand("Map<String>"),
		}],
		address: [{
			fields: {
				street: [{ value: "treeStreet", type: brand("String") }],
				zip: [{ type: brand("String") }],
				phones: [{
					type: brand("Test:Phones-1.0.0"),
					fields: {
						[EmptyKey as string]: [
							{ type: brand("String"), value: "+49123456778" },
							{ type: brand("Int32"), value: 123456879 },
						],
					},
				}],
			},
			type: brand("Test:Address-1.0.0"),
		}],
	},
};

export function buildProxy(data: JsonableTree, useSchema?: boolean): any {
	const rootType: TreeSchemaIdentifier = brand("Test:Person-1.0.0");
	const schema = new StoredSchemaRepository(defaultSchemaPolicy);
	if (useSchema) {
		convertPSetSchema(rootType, schema);
	}
	const forest = buildForest(schema);

	// const json = { address: { street: "new" }, name: "John" };
	// const schemaCursor = new SchemaCursor(json, schema, rootType);
	// const treeData = jsonableTreeFromCursor(schemaCursor);
	// initializeForest(forest, [treeData]);
	initializeForest(forest, [data]);

	// const jsonCursor = new JsonCursor({ address: { street: "new" } });
	// const _data = jsonableTreeFromCursor(jsonCursor);
	// initializeForest(forest, [_data]);

	const proxy = proxifyForest(forest);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return proxy;
}
