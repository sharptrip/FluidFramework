/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

// import { assert } from "@fluidframework/common-utils";
import {
	EditableField,
	rootFieldKey,
	TreeSchemaIdentifier,
	FieldKinds,
	FieldStoredSchema,
	EditableTreeContext,
	FieldKey,
	MapTree,
	PrimitiveValue,
	isPrimitive,
	SchemaData,
} from "@fluid-experimental/tree2";
import { assert } from "@fluidframework/common-utils";

const { sequence, value } = FieldKinds;
export const defaultPrimitiveValues = {
	Bool: false,
	String: "",
	Int8: 0,
	Uint8: 0,
	Int16: 0,
	Uint16: 0,
	Int32: 0,
	Uint32: 0,
	Float32: 0,
	// Currently not supported by the SharedTree
	Int64: 0,
	Uint64: 0,
	Float64: 0,
	Reference: "",
};

export function isEmptyRoot(field: EditableField): boolean {
	return field.fieldKey === rootFieldKey && field.length === 0;
}

export function isSequenceField(field: EditableField): boolean {
	return field.fieldSchema.kind.identifier === sequence.identifier;
}

export function isValueFieldSchema(fieldSchema: FieldStoredSchema): boolean {
	return fieldSchema.kind.identifier === value.identifier;
}

export function getDefaultValueIfPrimitive(
	schema: SchemaData,
	type: TreeSchemaIdentifier,
): PrimitiveValue | undefined {
	const treeSchema = schema.treeSchema.get(type) ?? fail("expected tree schema");
	if (isPrimitive(treeSchema)) {
		const defaultValue: PrimitiveValue = defaultPrimitiveValues[type];
		return defaultValue;
	}
	return undefined;
}

export const getFieldSource = (context: EditableTreeContext) => {
	const getFieldGenerator = (key: FieldKey, schema: FieldStoredSchema) => {
		if (!isValueFieldSchema(schema)) return undefined;
		assert(schema.types !== undefined, "Value fields must be typed");
		assert(schema.types.size === 1, "Polymorphic fields are not supported yet");
		const type: TreeSchemaIdentifier = [...schema.types][0];
		const treeSchema = context.schema.treeSchema.get(type) ?? fail("expected tree schema");
		const fields: Map<FieldKey, MapTree[]> = new Map();
		const defaultValue = getDefaultValueIfPrimitive(context.schema, type);
		if (defaultValue !== undefined) {
			return () => [{ fields, type, value: defaultValue }];
		}
		for (const [fieldKey, fieldSchema] of treeSchema.structFields) {
			const fieldGenerator = getFieldGenerator(fieldKey, fieldSchema);
			if (fieldGenerator !== undefined) {
				fields.set(fieldKey, fieldGenerator());
			}
		}
		return () => [{ fields, type }];
	};
	return getFieldGenerator;
};
