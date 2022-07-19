/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import React, { useState } from "react";
import ReactDOM from "react-dom";

import _ from "lodash";
import {
    ModalManager,
    ModalRoot,
} from "@fluid-experimental/property-inspector-table";

import { makeStyles } from "@material-ui/styles";
import { MuiThemeProvider } from "@material-ui/core/styles";

import { PropertyProxy } from "@fluid-experimental/property-proxy";

import { DataBinder } from "@fluid-experimental/property-binder";
import { SharedPropertyTree } from "@fluid-experimental/property-dds";
import AutoSizer from "react-virtualized-auto-sizer";

import { Box } from "@material-ui/core";
import ReactJson from "react-json-view";
import { theme } from "./theme";
import { JsonTable } from "./jsonInspector/jsonTable";
import { PropertyTable } from "./propertyInspector/propertyTable";

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

const customData: any = {
    test1: "dodo",
    test2: 12,
    test3: true,
    ttt: false,
    newProp: 100,
    test4: {
        test5: "hello booboo",
    },
    test6: [1, 2, "daba dee", ["a", "b", 3, 4, { foo: { bar: "buz" } }]],
    // Maps are not supported
    mapTest: new Map([["a", "b"], ["valA", "valB"]]),
    // Sets are not supported
    setTest: new Set([1, 2, 3]),
    nested: {
        test9: {
            strThing: "lolo",
        },
    },
};

export const InspectorApp = (props: any) => {
    const classes = useStyles();
    const [data, setData] = useState(customData);
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
                                        <Box sx={{ display: "flex" }}>
                                            <Box sx={{ display: "flex", width: width / 2 }}>
                                                <ReactJson src={data} onEdit={
                                                    ({ updated_src }) => setData(updated_src)
                                                }/>
                                                <JsonTable
                                                    // readOnly={true}
                                                    width={width / 4}
                                                    height={height}
                                                    {...props}
                                                    data={data}
                                                />
                                            </Box>
                                            <PropertyTable
                                                // readOnly={true}
                                                width={width / 2}
                                                height={height}
                                                {...props}
                                            />
                                        </Box>
                                }
                         </AutoSizer>
                    </div>
                </div>
            </div>
        </ModalManager>
        </MuiThemeProvider >);
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
