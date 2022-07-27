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

import { Box, Tabs, Tab } from "@material-ui/core";
import ReactJson from "react-json-view";
import { theme } from "./theme";
import { PropertyTable } from "./propertyInspector/propertyTable";
import { getForest, JsonTable } from "./jsonInspector/jsonTable";

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
    editor: {
        container: {
            width: "100%",
        },
        body: {
            width: undefined,
            display: "flex",
        },
        outerBox: {
            width: "100%",
        },
        contentBox: {
            width: undefined,
            flex: 1,
        },
        warningBox: {
            width: "100%",
        },
    },
}, { name: "InspectorApp" });

const customData: any = {
    test1: "John Doe",
    test2: 12,
    test3: true,
    test4: false,
    newProp: 100,
    test5: {
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

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`simple-tabpanel-${index}`}
        aria-labelledby={`simple-tab-${index}`}
        {...other}
      >
        {value === index && (children)}
      </div>
    );
}

export const InspectorApp = (props: any) => {
    const classes = useStyles();
    const [data, setData] = useState(getForest());
    const [value, setValue] = useState(1);

    // const chipClasses = useChipStyles();

    const onJsonEdit = ({ updated_src }) => setData(updated_src);

    return (
        <MuiThemeProvider theme={theme}>
            <ModalManager>
                <ModalRoot />
                <div className={classes.root}>
                    <div className={classes.horizontalContainer}>
                        <div className={classes.tableContainer}>
                        <Box sx={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
                            <Tabs value={value} onChange={(event, newValue) => setValue(newValue)}>
                                <Tab label="PropertyDDS" id="tab-propertyDDS"/>
                                <Tab label="JSON" id="tab-jsonCursor"/>
                                <Tab label="Forest" id="tab-forestCursor"/>
                            </Tabs>
                            <AutoSizer>
                            {
                                ({ width, height }) =>
                                    <Box sx={{ display: "flex" }}>
                                        <TabPanel value={value} index={0}>
                                            <PropertyTable
                                                // readOnly={true}
                                                width={width}
                                                height={height}
                                                {...props}
                                            />
                                        </TabPanel>
                                        <TabPanel value={value} index={1}>
                                            <Box sx={{ display: "flex", flexDirection: "row" }}>
                                                <Box width={width / 3} className={classes.editor}>
                                                    <ReactJson
                                                        src={data}
                                                        onEdit={onJsonEdit}
                                                        onAdd={onJsonEdit}
                                                        onDelete={onJsonEdit}
                                                        />
                                                </Box>
                                                <JsonTable
                                                    readOnly={false}
                                                    width={2 * width / 3}
                                                    height={height}
                                                    {...props}
                                                    data={data}
                                                />
                                            </Box>
                                        </TabPanel>
                                    </Box>
                            }
                            </AutoSizer>
                        </Box>
                    </div>
                </div>
            </div>
        </ModalManager>
        </MuiThemeProvider >);
};

export function renderApp(propertyTree: SharedPropertyTree, element: HTMLElement) {
    const dataBinder = new DataBinder();

    dataBinder.attachTo(propertyTree);

    // Create an ES6 proxy for the DDS, this enables JS object interface for interacting with the DDS.
    const proxifiedDDS = PropertyProxy.proxify(propertyTree.root);

    // Listening to any change the root path of the PropertyDDS, and rendering the latest state of the
    // inspector tree-table.
    dataBinder.registerOnPath("/", ["insert", "remove", "modify"], _.debounce(() => {
        // Note: This is what currently inspector table expect for "data" prop.
        ReactDOM.render(<InspectorApp data={proxifiedDDS} />, element);
    }, 20));
}
