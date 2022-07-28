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
    IToTableRowsProps,
    typeidToIconMap,
} from "@fluid-experimental/property-inspector-table";
import AutoSizer from "react-virtualized-auto-sizer";

import { jsonArray, jsonString, jsonBoolean, jsonNumber, JsonCursor } from "@fluid-internal/tree";

import { IInspectorRowData, getDataFromCursor } from "../cursorData";

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

const toTableRows = ({ data }: Partial<IInspectorRowData>, props: IToTableRowsProps,
    _options?: Partial<IToTableRowsOptions>, _pathPrefix?: string,
): IInspectorRowData[] => {
    const jsonCursor = new JsonCursor(data);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return getDataFromCursor(jsonCursor, [], props.readOnly);
};

export type IJsonTableProps = IInspectorTableProps;

const jsonTableProps: Partial<IJsonTableProps> = {
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
    addDataForm: ({ styleClass }) => {
        return (
            <AutoSizer defaultHeight={200} defaultWidth={200}>
                {({ width, height }) => (
                    <div style={{
                        height: `${height - 20}px`,
                        width: `${width - 20}px`,
                    }}>
                        <Box
                            className={styleClass}
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                            }}>
                            <Box sx={{ display: "flex", height: "75px" }}>
                                <TextField label="name"></TextField>
                                <TextField label="value"></TextField>
                            </Box>
                            <Box sx={{ display: "flex", height: "75px" }}>
                                <Button>Cancel</Button>
                                <Button>Create</Button>
                            </Box>
                        </Box>
                    </div>)
                }
            </AutoSizer >);
    },
    generateForm: () => {
        return true;
    },
    // TODO: // Fix types
    rowIconRenderer: (rowData: any) => {
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

export const JsonTable = (props: IJsonTableProps) => {
    const classes = useStyles();
    return <InspectorTable
        {...jsonTableProps}
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
