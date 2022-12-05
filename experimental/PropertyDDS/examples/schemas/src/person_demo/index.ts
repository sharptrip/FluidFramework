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
        properties: [{ id: "coords", typeid: "Float64", context: "array" }],
    },
    simplePhones: {
        typeid: "Test:SimplePhones-1.0.0",
        properties: [{ id: "phone", typeid: "String", context: "array" }],
    },
    complexPhone: {
        typeid: "Test:Phone-1.0.0",
        properties: [
            { id: "number", typeid: "String" },
            { id: "prefix", typeid: "String" },
            {
                id: "extraPhones",
                typeid: "Test:SimplePhones-1.0.0",
                optional: true,
            },
        ],
    },
    phones: {
        typeid: "Test:Phones-1.0.0",
        properties: [
            { id: "phoneAsString", typeid: "String", context: "array" },
            { id: "phoneAsInt32", typeid: "Int32", context: "array" },
            {
                id: "phoneAsComplexObject",
                typeid: "Test:Phone-1.0.0",
                context: "array",
            },
            {
                id: "phoneAsArray",
                typeid: "Test:SimplePhones-1.0.0",
                context: "array",
            },
        ],
    },
    address: {
        typeid: "Test:Address-1.0.0",
        inherits: [
            "NodeProperty",
            "Test:GeodesicLocation-1.0.0",
            "Test:CartesianLocation-1.0.0",
        ],
        properties: [
            { id: "zip", typeid: "String" },
            { id: "zip", typeid: "Int32" },
            { id: "street", typeid: "String", optional: true },
            { id: "city", typeid: "String", optional: true },
            { id: "country", typeid: "String", optional: true },
            { id: "phones", typeid: "Test:Phones-1.0.0", optional: true },
        ],
    },
    person: {
        typeid: "Test:Person-1.0.0",
        inherits: ["NodeProperty"],
        properties: [
            { id: "name", typeid: "String" },
            { id: "age", typeid: "Int32", optional: true },
            { id: "adult", typeid: "Bool", optional: true },
            { id: "salary", typeid: "Float64", optional: true },
            { id: "salary", typeid: "Int32", optional: true },
            { id: "address", typeid: "Test:Address-1.0.0", optional: true },
            { id: "friends", typeid: "String", context: "map", optional: true },
        ],
    },
};
