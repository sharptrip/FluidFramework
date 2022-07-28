/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
export default {
	geodesicLocation: {
		typeid: "Test:GeodesicLocation-1.0.0",
		properties: [
			{ id: "lat", typeid: "Float64" },
			{ id: "lon", typeid: "Float64" },
		],
	},
	cartesianLocation: {
		typeid: "Test:CartesianLocation-1.0.0",
		properties: [
			{ id: "coords", typeid: "Float64", context: "array" },
		],
	},
	address: {
		typeid: "Test:Address-1.0.0",
		inherits: ["Test:GeodesicLocation-1.0.0", "Test:CartesianLocation-1.0.0"],
		properties: [
			{ id: "street", typeid: "String" },
			{ id: "city", typeid: "String" },
			{ id: "zip", typeid: "String" },
			{ id: "country", typeid: "String" },
		],
	},
	person: {
		typeid: "Test:Person-1.0.0",
		inherits: ["NodeProperty"],
		properties: [
			{ id: "name", typeid: "String" },
			{ id: "age", typeid: "Int32" },
			{ id: "salary", typeid: "Float64" },
			{ id: "address", typeid: "Test:Address-1.0.0" },
			{ id: "friends", typeid: "String", context: "map" },
			{ id: "data", typeid: "String" },
		],
	},
};
