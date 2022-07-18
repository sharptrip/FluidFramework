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

import {
    TreeNavigationResult, JsonCursor, jsonObject,
    jsonArray, jsonString, jsonBoolean, jsonNumber, TreeType,
} from "@fluid-internal/tree";

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
    isAddProperty?: boolean;
    name?: string;
    value?: number | string | [] | boolean | Record<string, unknown>;
    type?: TreeType;
}

// const mapJsonTypesToStrings = (type: TreeType) => {
//     switch (type) {
//         case jsonArray.name:
//             return "Array";
//         case jsonString.name:
//             return "String";
//         case jsonBoolean.name:
//             return "Boolean";
//         case jsonNumber.name:
//             return "Number";
//         case jsonNull.name:
//             return "Null";
//         case jsonObject.name:
//             return "Object";
//         default:
//             return "Unknown Type";
//     }
// };

function toTableRows({ data, id = "root" }: Partial<IJsonRowData>, props: IToTableRowsProps,
    _options?: Partial<IToTableRowsOptions>, _pathPrefix?: string): IJsonRowData[] {
    const res: IJsonRowData[] = [];
    const jsonCursor = new JsonCursor(data);
    for (const key of jsonCursor.keys) {
        const len = jsonCursor.length(key);
        for (let idx = 0; idx < len; idx++) {
            const result = jsonCursor.down(key, idx);
            if (result === TreeNavigationResult.Ok) {
                const idOrKey = `${len > 1 ? idx : key as string}`;
                res.push({
                    id: idOrKey,
                    name: idOrKey,
                    value: jsonCursor.value || data[key as string],
                    type: jsonCursor.type,
                    children:
                        jsonCursor.type === jsonObject.name || jsonCursor.type === jsonArray.name
                            ? toTableRows({
                                data: data[key as string],
                                id: idOrKey,
                            }, props)
                            : [],
                });
            }
            jsonCursor.up();
        }
    }
    if (!props.readOnly) {
        res.push({
            id: `${id} / Add`,
            isAddProperty: true,
        });
    }

    return res;
}

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
    generateForm: (rowData, handleCreateData) => {
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

export const JsonTable = (props: IJsonTableProps) => {
    const classes = useStyles();

    return <InspectorTable
        {...jsonTableProps}
        columnsRenderers={
            {
                name: ({ rowData, cellData, renderCreationRow, tableProps: { readOnly } }) => {
                    return (
                        rowData.isAddProperty && !readOnly
                            ? renderCreationRow(rowData)
                            : cellData
                    ) as React.ReactNode;
                },
                type: ({ rowData }) => {
                    if (!rowData.data) {
                        return <></>;
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
                            return <FormLabel> {`[${value.length}]`}</FormLabel>;
                        default:
                            return <div> </div>;
                    }
                },
            }
        }
        {...props}
    />;
};
