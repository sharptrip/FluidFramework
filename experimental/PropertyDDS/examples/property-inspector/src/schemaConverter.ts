import { PropertyFactory, PropertyTemplate } from "@fluid-experimental/property-properties";
import { TypeIdHelper } from "@fluid-experimental/property-changeset";
import { emptyField, emptyMap, emptySet, FieldKind, FieldSchema, LocalFieldKey,
         neverTree, StoredSchemaRepository, TreeSchema,
         TreeSchemaIdentifier, ValueSchema } from "@fluid-internal/tree";

const booleanTypes = new Set(["Bool"]);
const numberTypes = new Set([
    "Int8",
    "Uint8",
    "Int16",
    "Uint16",
    "Int32",
    "Int64",
    "Uint64",
    "Uint32",
    "Float32",
    "Float64"]);

export function convertPSetSchema(typeid: string, repository: StoredSchemaRepository) {
    // Extract all referenced typeids for the schema
    const unprocessedTypeIds = [typeid];
    const referencedTypeIDs = new Set<TreeSchemaIdentifier>();

    while (unprocessedTypeIds.length !== 0) {
        const unprocessedTypeID = unprocessedTypeIds.pop();

        if (!unprocessedTypeID) {
            return;
        }

        referencedTypeIDs.add(unprocessedTypeID as TreeSchemaIdentifier);

        const schemaTemplate = PropertyFactory.getTemplate(unprocessedTypeID);
        if (schemaTemplate === undefined) {
            throw new Error(`Unknown typeid: ${ typeid}`);
        }
        const dependencies = PropertyTemplate.extractDependencies(schemaTemplate) as TreeSchemaIdentifier[];
        for (const dependencyTypeId of dependencies) {
            if (!referencedTypeIDs.has(dependencyTypeId)) {
                unprocessedTypeIds.push(dependencyTypeId);
            }
        }

        // Extract context information (i.e. array, map and set types)
        const extractContexts = (properties: any[]) => {
            for (const property of (properties || [])) {
                if (property.properties) {
                    // We have a nested set of properties
                    // TODO: We have to create a corresponding nested type
                    extractContexts(property.properties);
                }
                if (property.context && property.context !== "single") {
                    referencedTypeIDs.add((`${property.context }<${ property.typeid }>`) as TreeSchemaIdentifier);
                }
                if (TypeIdHelper.isPrimitiveType(property.typeid)) {
                    referencedTypeIDs.add(property.typeid);
                }
            }
        };
        extractContexts(schemaTemplate.properties);
    }

    // Now we create the actual schemas, since we are now able to reference the dependent types
    for (const referencedTypeId of referencedTypeIDs.values()) {
        if (repository.lookupTreeSchema(referencedTypeId) !== neverTree) {
            continue;
        }

        const splitTypeId = TypeIdHelper.extractContext(referencedTypeId);
        let typeSchema : (TreeSchema | undefined);

        if (splitTypeId.context === "single") {
            if (TypeIdHelper.isPrimitiveType(splitTypeId.typeid)) {
                if (splitTypeId.typeid === "String") {
                    // String is a special case, we actually have to represent it as a sequence
                    typeSchema = {
                            localFields: new Map<LocalFieldKey, FieldSchema>([
                                // TODO: What should be the key we use for the entries? Should this be standardized?
                                ["entries" as LocalFieldKey, {
                                    kind: FieldKind.Sequence,
                                    types: new Set([
                                        // TODO: Which type do we use for characters?
                                    ]),
                                }],
                            ]),
                            globalFields: emptySet,
                            extraLocalFields: emptyField,
                            extraGlobalFields: false,
                            value: ValueSchema.Nothing,
                        };
                } else {
                    let valueType: ValueSchema;
                    if (splitTypeId.isEnum) {
                        valueType = ValueSchema.Number;
                    } else if (splitTypeId.typeid.startsWith("Reference<")) {
                        valueType = ValueSchema.String;
                    } else if (booleanTypes.has(splitTypeId.typeid)) {
                        valueType = ValueSchema.Boolean;
                    } else if (numberTypes.has(splitTypeId.typeid)) {
                        valueType = ValueSchema.Number;
                    } else {
                        throw new Error(`Unknown primitive typeid: ${ splitTypeId.typeid}`);
                    }

                    typeSchema = {
                            localFields: emptyMap,
                            globalFields: emptySet,
                            extraLocalFields: emptyField,
                            extraGlobalFields: false,
                            value: valueType,
                        };
                }
            } else {
                if (splitTypeId.typeid === "NodeProperty") {
                    typeSchema = {
                            localFields: emptyMap,
                            globalFields: emptySet,
                            extraLocalFields: {
                                kind: FieldKind.Optional,
                            },
                            extraGlobalFields: false,
                            value: ValueSchema.Nothing,
                        };
                } else {
                    const localFields = new Map<LocalFieldKey, FieldSchema>();
                    const inheritanceChain = PropertyFactory.getAllParentsForTemplate(splitTypeId.typeid);
                    inheritanceChain.push(splitTypeId.typeid);

                    for (const typeIdInInheritanceChain of inheritanceChain) {
                        if (typeIdInInheritanceChain === "NodeProperty") { continue; }

                        const schema = PropertyFactory.getTemplate(typeIdInInheritanceChain);
                        if (schema === undefined) {
                            throw new Error(`Unknown typeid referenced: ${ typeIdInInheritanceChain}`);
                        }
                        for (const property of schema.properties) {
                            if (property.properties) {
                                // TODO: Handle nested properties
                            } else {
                                let currentTypeid = property.typeid;
                                if (property.context && property.context !== "single") {
                                    currentTypeid = (`${property.context }<${ property.currentTypeid || "" }>`);
                                }

                                localFields.set(
                                    property.id as LocalFieldKey, {
                                        kind: (property.optional ? FieldKind.Optional : FieldKind.Value),
                                        types: new Set([
                                            currentTypeid,
                                        ]),
                                    },
                                );
                            }
                        }
                    }

                    typeSchema = {
                        localFields,
                        globalFields: emptySet,
                        extraLocalFields: PropertyFactory.inheritsFrom(splitTypeId.typeid, "NodeProperty") ?
                            emptyField :
                            {
                                kind: FieldKind.Optional,
                            },
                        extraGlobalFields: false,
                        value: ValueSchema.Nothing,
                    };
                }
            }
        } else {
            const kind = splitTypeId.context === "array" ? FieldKind.Sequence : FieldKind.Optional;

            const fieldType = (splitTypeId.typeid !== "" &&
                            splitTypeId.typeid !== "BaseProperty") ? {
                kind,
                types: new Set([
                // TODO: How do we handle inheritance here?
                splitTypeId.typeid as TreeSchemaIdentifier,
                ]),
            } : {
                kind,
            };
            switch (splitTypeId.context) {
                case "map":
                case "set":
                    typeSchema = {
                        localFields: emptyMap,
                        globalFields: emptySet,
                        extraLocalFields: fieldType,
                        extraGlobalFields: false,
                        value: ValueSchema.Nothing,
                    };

                break;
                case "array":
                    typeSchema = {
                        localFields: new Map<LocalFieldKey, FieldSchema>([
                            // TODO: What should be the key we use for the entries?
                            // Should this be standardized?
                            ["entries" as LocalFieldKey, fieldType],
                        ]),
                        globalFields: emptySet,
                        extraLocalFields: emptyField,
                        extraGlobalFields: false,
                        value: ValueSchema.Nothing,
                    };
                break;
                default:
                    throw new Error(`Unknown context in typeid: ${ splitTypeId.context}`);
            }
        }

        repository.tryUpdateTreeSchema(referencedTypeId, typeSchema);
    }
}

// Concepts currently not mapped / represented in the compiled schema:
//
// * Annotations
// * Length constraints for arrays / strings
// * Constants
// * Values for enums
// * Default values
