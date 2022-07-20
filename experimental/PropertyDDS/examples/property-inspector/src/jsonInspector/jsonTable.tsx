import * as React from "react";

import {
    IInspectorTableProps,
    InspectorTable,
    IToTableRowsOptions,
    IToTableRowsProps,
    typeidToIconMap,
    IRowData,
} from "@fluid-experimental/property-inspector-table";
import { Box, Chip, Switch, TextField, FormLabel, Button } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import { TreeNavigationResult, JsonCursor, TreeType, EmptyKey, ITreeCursor, FieldKey,
    jsonArray, jsonString, jsonBoolean, jsonNumber, jsonObject } from "@fluid-internal/tree";

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

interface IJsonRowData extends IRowData<any> {
    name?: string;
    value?: number | string | [] | boolean | Record<string, unknown>;
    type?: TreeType;
}

const cursorToRowData = (
    cursor: ITreeCursor, parentKey: FieldKey, key: FieldKey, idx: number, isReadOnly: boolean,
): IJsonRowData => {
    const type = cursor.type;
    const value = type === jsonArray.name ? `[${cursor.length(EmptyKey)}]` : cursor.value;
    const name = key as string || String(idx);
    const id = `${parentKey}/${name}`;
    const children: IJsonRowData[] = getDataFromCursor(cursor, [], isReadOnly, id as FieldKey);
    const rowData: IJsonRowData = { id, name, value, type, children };
    return rowData;
};

const getDataFromCursor = (
    cursor: ITreeCursor, rows: IJsonRowData[], isReadOnly: boolean = true, parentKey: FieldKey = EmptyKey,
): IJsonRowData[] => {
    if (cursor.type === jsonArray.name) {
        const len = cursor.length(EmptyKey);
        for (let idx = 0; idx < len; idx++) {
            const result = cursor.down(EmptyKey, idx);
            if (result === TreeNavigationResult.Ok) {
                rows.push(cursorToRowData(cursor, parentKey, EmptyKey, idx, isReadOnly));
            }
            cursor.up();
        }
    } else {
        for (const key of cursor.keys) {
            const result = cursor.down(key, 0);
            if (result === TreeNavigationResult.Ok) {
                rows.push(cursorToRowData(cursor, parentKey, key, 0, isReadOnly));
            }
            cursor.up();
        }
    }
    if (!isReadOnly && (cursor.type === jsonArray.name || cursor.type === jsonObject.name)) {
        const newRow: IJsonRowData = {
            id: `${parentKey}/Add`,
            isNewDataRow: true,
        };
        rows.push(newRow);
    }
    return rows;
};

const toTableRows = ({ data, id = "root" }: Partial<IJsonRowData>, props: IToTableRowsProps,
    _options?: Partial<IToTableRowsOptions>, _pathPrefix?: string,
): IJsonRowData[] => {
    const jsonCursor = new JsonCursor(data);
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
