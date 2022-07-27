import { StoredSchemaRepository } from "@fluid-internal/tree";

import { convertPSetSchema } from "../src/schemaConverter";
import { registerSchemas } from "./registerSchemas";

describe("Schema Conversion", () => {
    it("Should convert a simple schema", () => {
        const repository = new StoredSchemaRepository();
        registerSchemas();

        convertPSetSchema("Test:Person-1.0.0", repository);

        // TODO: How do I best check whether the generated schema is correct?
    });
});
