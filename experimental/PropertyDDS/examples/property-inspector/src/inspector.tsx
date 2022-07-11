/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import React from "react";
import ReactDOM from "react-dom";

import _ from "lodash";
import {
    IDataCreationOptions,
    IInspectorRow,
    IInspectorTableProps,
    InspectorTable,
    ModalManager,
    ModalRoot,
    fetchRegisteredTemplates,
    handlePropertyDataCreation,
    // CustomChip,
    // useChipStyles,
} from "@fluid-experimental/property-inspector-table";

import { makeStyles } from "@material-ui/styles";
import { MuiThemeProvider } from "@material-ui/core/styles";

import { PropertyProxy } from "@fluid-experimental/property-proxy";

import { DataBinder } from "@fluid-experimental/property-binder";
import { SharedPropertyTree } from "@fluid-experimental/property-dds";
import AutoSizer from "react-virtualized-auto-sizer";

import { TreeNavigationResult, TreeType } from "@fluid-internal/tree";
import { Box, Chip } from "@material-ui/core";
import { theme } from "./theme";
import { JsonCursor, JsonType } from "./jsonCursor";

const useStyles = makeStyles({
    activeGraph: {
        "flex-basis": "100%",
        "z-index": 1,
    },
    horizontalContainer: {
        display: "flex",
        flex: "1",
    },
    inspectorContainer: {
        "display": "flex",
        "flex-basis": "100%",
        "padding-left": "1px",
    },
    root: {
        "display": "flex",
        "flex-direction": "column",
        "font-family": "ArtifaktElement, Helvetica, Arial",
        "height": "100%",
        "justify-content": "flex-start",
        "overflow": "hidden",
    },
    sideNavContainer: {
        display: "flex",
    },
    verticalContainer: {
        "display": "flex",
        "flex-basis": "100%",
        "flex-direction": "column",
        "justify-content": "space-between",
    },
    tableContainer: {
        display: "flex",
        height: "100%",
        width: "100%",
    },
    defaultColor: {
        color: "#808080",
      },
      enumColor: {
        color: "#EC4A41",
        flex: "none",
      },
      numberColor: {
        color: "#32BCAD",
      },
      referenceColor: {
        color: "#6784A6",
      },
      stringColor: {
        color: "#0696D7",
        height: "25px",
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
}, { name: "InspectorApp" });

export const handleDataCreationOptionGeneration = (rowData: IInspectorRow, nameOnly: boolean): IDataCreationOptions => {
    if (nameOnly) {
        return { name: "property" };
    }
    const templates = fetchRegisteredTemplates();
    return { name: "property", options: templates };
};

const tableProps: Partial<IInspectorTableProps> = {
    columns: ["name", "value", "type"],
    dataCreationHandler: handlePropertyDataCreation,
    dataCreationOptionGenerationHandler: handleDataCreationOptionGeneration,
    expandColumnKey: "name",
    width: 1000,
    height: 600,
};

const customData = {
    test1: "dodo",
    test2: "hello world",
    test3: "ggggg",
    test4: {
        test5: "hello booboo",
    },
    test6: [1, 2, 3],
    test7: new Map([["a", "b"], ["valA", "valB"]]),
    nested: {
        test9: {
            strThing: "lolo",
        },
    },
};

// const fromTypeToContext(type: TreeType) {
//     switch (type) {
//         case JsonType.Array
//         case JsonType.Object:
//             return

//             break;

//         default:
//             break;
//     }
// }

const mapJsonTypesToStrings = (type: TreeType) => {
    switch (type) {
        case JsonType.Array:
            return "Array";
        case JsonType.String:
            return "String";
        case JsonType.Boolean:
            return "Boolean";
        case JsonType.Number:
            return "Number";
        case JsonType.Null:
            return "Null";
        case JsonType.Object:
            return "Object";
        default:
            return "Unknown Type";
    }
};

function toTableRows({ data, id }: any) {
    const res: Record<string, any>[] = [];
    const jsonCursor = new JsonCursor(data);
    for (const key of jsonCursor.keys) {
        const len = jsonCursor.length(key);
        for (let idx = 0; idx < len; idx++) {
            const result = jsonCursor.down(key, idx);
            if (result === TreeNavigationResult.Ok) {
                res.push({
                    id: key,
                    name: key,
                    value: jsonCursor.value,
                    type: mapJsonTypesToStrings(jsonCursor.type),
                    // context: "single",
                    children: jsonCursor.type === 5 || jsonCursor.type === 4 ? toTableRows({ data: data[key] }) : [],
                });
            }
        }
        jsonCursor.up();
    }

    return res;
}

export const InspectorApp = (props: any) => {
    const classes = useStyles();
    // const chipClasses = useChipStyles();

    return (
        <MuiThemeProvider theme={theme}>
            <ModalManager>
                <ModalRoot />
                <div className={classes.root}>
                    <div className={classes.horizontalContainer}>
                        <div className={classes.tableContainer}>
                            <AutoSizer>
                                {
                                    ({ width, height }) =>
                                        <InspectorTable
                                            {...tableProps}
                                            readOnly={true}
                                            width={width}
                                            height={height}
                                            {...props}
                                            data={customData}
                                            columns={["name", "value", "type"]}
                                            rowIconRenderer={() => { }}
                                            toTableRows={toTableRows}
                                            columnsRenderers={
                                                {
                                                    type: ({ rowData }) =>
                                                    (<Box className={classes.typesBox}>
                                                            <Chip
                                                                label={ rowData.type }
                                                                className={classes.stringColor}/>
                                                    </Box>),
                                                }
                                            }
                                        />
                                }
                            </AutoSizer>w
                        </div>
                    </div>
                </div>
            </ModalManager>
        </MuiThemeProvider>);
};

export function renderApp(propertyTree: SharedPropertyTree, element: HTMLElement) {
    const dataBinder = new DataBinder();

    dataBinder.attachTo(propertyTree);

    // Listening to any change the root path of the PropertyDDS, and rendering the latest state of the
    // inspector tree-table.
    dataBinder.registerOnPath("/", ["insert", "remove", "modify"], _.debounce(() => {
        // Create an ES6 proxy for the DDS, this enables JS object interface for interacting with the DDS.
        // Note: This is what currently inspector table expect for "data" prop.
        const proxifiedDDS = PropertyProxy.proxify(propertyTree.root);
        ReactDOM.render(<InspectorApp data={proxifiedDDS} />, element);
    }, 20));
}
