/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import { StoredSchemaRepository } from "@fluid-internal/tree";
import { registerSchemas } from "@fluid-experimental/schemas";
import { PropertyFactory } from "@fluid-experimental/property-properties";

import { convertPSetSchema } from "../src/schemaConverter";

describe("Schema Conversion", () => {
    it("Should convert a simple schema", () => {
        const repository = new StoredSchemaRepository();
        registerSchemas(PropertyFactory);

        convertPSetSchema("Test:Person-1.0.0", repository);

        // TODO: How do I best check whether the generated schema is correct?
    });
});
