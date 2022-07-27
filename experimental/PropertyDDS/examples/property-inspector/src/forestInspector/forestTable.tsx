/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import * as React from "react";

import { Box, Chip, Switch, TextField, FormLabel, Button } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import {
    IInspectorTableProps,
    InspectorTable,
    IToTableRowsOptions,
    typeidToIconMap,
} from "@fluid-experimental/property-inspector-table";

import { TreeNavigationResult,
    JsonCursor,
    FieldKey,
    jsonArray, jsonString, jsonBoolean, jsonNumber, jsonObject,
    Cursor, ObjectForest,
	brand, TextCursor,
} from "@fluid-internal/tree";

import { IInspectorRowData, getDataFromCursor } from "../cursorData";

import { convertPSetSchema } from "../schemaConverter";
import { getForestProxy } from "../forestProxy";

const useStyles = makeStyles({
    boolColor: {
        color: "#9FC966",
    },
    constAndContextColor: {
        color: "#6784A6",
        flex: "none",
    },
    defaultColor: {
        color: "#808080",
    },
    typesCell: {
        color: "#EC4A41",
        height: "25px",
    },
    enumColor: {
        color: "#EC4A41",
        flex: "none",
    },
    numberColor: {
        color: "#32BCAD",
    },
    stringColor: {
        color: "#0696D7",
    },
    tooltip: {
        backgroundColor: "black",
        maxWidth: "100vw",
        overflow: "hidden",
        padding: "4px 8px",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    typesBox: {
        display: "flex",
        width: "100%",
    },
}, { name: "JsonTable" });

export type IForestTableProps = IInspectorTableProps;

const toTableRows = ({ data: forest }: Partial<IInspectorRowData>, props: any,
    _options?: Partial<IToTableRowsOptions>, _pathPrefix?: string,
): IInspectorRowData[] => {
    const rootId = props.documentId;
    if (!forest) {
        return [];
    }
    const reader: Cursor = forest.allocateCursor();
    const result = forest.tryGet(forest.root(forest.rootField), reader);
    const trees = forest.getRoot(forest.rootField);
    if (result === TreeNavigationResult.Ok && trees?.length) {
        const root: IInspectorRowData = {
            id: rootId,
            name: "/",
            type: jsonObject.name,
            children: [],
        };
        for (let idx = 0; idx < trees?.length; idx++) {
            const treeId = `${rootId}/${String(idx)}`;
            reader.set(forest.rootField, idx);
            const tree: IInspectorRowData = {
                id: treeId,
                type: jsonObject.name,
                name: `/${String(idx).padStart(3, "0")}`,
                children: getDataFromCursor(reader, [], props.readOnly, treeId as FieldKey),
            };
            root.children?.push(tree);
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return [root];
    }
    return [];
};

export const getForest = (data) => {
    const forest: ObjectForest = new ObjectForest();
    convertPSetSchema("Test:Person-1.0.0", forest.schema);
    if (data) {
        const cursor = new JsonCursor(data);
        const cursor2 = new JsonCursor({ foo: " bar ", buz: { fiz: 1 } });
        // Not sure how best to create data from Schema
        const textCursor = new TextCursor({
            type: brand("Test:Person-1.0.0"),
            fields: {
                name: [{ value: "Adam", type: brand("String") }],
                address: [{
                    fields: {
                        street: [{ value: "treeStreet", type: brand("String") }],
                    },
                    type: brand("Test:Address-1.0.0"),
                 }],
            },
        });
        const proxy = getForestProxy(textCursor, forest, 2);
        // eslint-disable-next-line @typescript-eslint/dot-notation
        window["__proxy"] = proxy;
        const newRange = forest.add([cursor, cursor2, textCursor]);
        // const newRange = forest.add([textCursor]);
        forest.attachRangeOfChildren({ index: 0, range: forest.rootField }, newRange);
    }
    return forest;
};

const forestTableProps: Partial<IForestTableProps> = {
    columns: ["name", "value", "type"],
    expandColumnKey: "name",
    toTableRows,
    dataCreationOptionGenerationHandler: () => ({
        name: "property",
        templates: {
            primitives: ["Json.Number"],
        },
    }),
    dataCreationHandler: async () => { },
    addDataForm: () => {
        return (<Box sx={{ display: "flex", flexDirection: "column", height: "160px" }}>
            <Box sx={{ display: "flex", height: "75px" }}>
                <TextField label="name"></TextField>
                <TextField label="value"></TextField>
            </Box>
            <Box sx={{ display: "flex", height: "75px" }}>
                <Button>Cancel</Button>
                <Button>Create</Button>
            </Box>
        </Box>);
    },
    generateForm: () => {
        return true;
    },
    // TODO: // Fix types
    rowIconRenderer: (rowData: any) => {
        console.log(rowData.type);
        switch (rowData.type) {
            case "String":
            case "Array":
                return typeidToIconMap[rowData.type] as React.ReactNode;
            default:
                break;
        }
    },
    width: 1000,
    height: 600,
};

export const ForestTable = (props: IForestTableProps) => {
    const classes = useStyles();

    return <InspectorTable
        {...forestTableProps}
        columnsRenderers={
            {
                name: ({ rowData, cellData, renderCreationRow, tableProps: { readOnly } }) => {
                    return (
                        rowData.isNewDataRow && !readOnly
                            ? renderCreationRow(rowData)
                            : cellData
                    ) as React.ReactNode;
                },
                type: ({ rowData }) => {
                    if (rowData.isNewDataRow) {
                        return <div></div>;
                    }
                    return <Box className={classes.typesBox}>
                        <Chip
                            label={rowData.type}
                            className={classes.typesCell} />
                    </Box>;
                },
                value: ({ rowData, tableProps: { readOnly = false } }) => {
                    const { type, value } = rowData;
                    switch (type) {
                        case jsonBoolean.name:
                            return <Switch
                                size="small"
                                color="primary"
                                checked={value as boolean}
                                value={rowData.name}
                                disabled={!!readOnly}
                            />;

                        case jsonString.name:
                            return <TextField value={value}
                                disabled={!!readOnly} type="string" />;
                        case jsonNumber.name:
                            return <TextField value={value}
                                disabled={!!readOnly} type="number" />;
                        case jsonArray.name:
                            return <FormLabel> {value}</FormLabel>;
                        default:
                            return <div></div>;
                    }
                },
            }
        }
        {...props}
    />;
};
