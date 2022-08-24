/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import React, { useState } from "react";
import ReactDOM from "react-dom";

import _ from "lodash";
import { editableTreeProxySymbol } from "@fluid-internal/tree";
import {
     IDataCreationOptions,
     IInspectorRow,
     IInspectorTableProps,
     InspectorTable,
     ModalManager,
     ModalRoot,
     fetchRegisteredTemplates,
     handlePropertyDataCreation,
     IToTableRowsProps,
     IToTableRowsOptions,
} from "@fluid-experimental/property-inspector-table";

import { Tabs, Tab } from "@material-ui/core";
import { makeStyles } from "@material-ui/styles";
import { MuiThemeProvider } from "@material-ui/core/styles";

import ReactJson from "react-json-view";

import { PropertyProxy } from "@fluid-experimental/property-proxy";

import { DataBinder } from "@fluid-experimental/property-binder";
import { SharedPropertyTree } from "@fluid-experimental/property-dds";
import AutoSizer from "react-virtualized-auto-sizer";

import { person, buildProxy } from "./personData";

import { theme } from "./theme";

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

export const handleDataCreationOptionGeneration = (rowData: IInspectorRow, nameOnly: boolean):
    IDataCreationOptions => {
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

const getChildren = (data, pathPrefix?: string): IInspectorRow[] => {
    const rows: IInspectorRow[] = [];
    if (data === undefined) {
        return rows;
    }
    for (const key of Object.keys(data)) {
        const { value, type } = data[key];
        if (value !== undefined) {
            const row: IInspectorRow = {
                id: `${pathPrefix}/${key}`,
                name: key,
                context: "single",
                children: [],
                isReference: false,
                value,
                typeid: type || "",
                parent: data,
            };
            rows.push(row);
        } else if (editableTreeProxySymbol in data[key] && Object.keys(data[key]).length) {
            const row: IInspectorRow = {
                id: `${pathPrefix}/${key}`,
                name: key,
                context: "single",
                children: getChildren(data[key], `${pathPrefix}/${key}`),
                isReference: false,
                typeid: type || "",
                parent: data,
            };
            rows.push(row);
        }
    }
    return rows;
};

const jsonTableProps: Partial<IInspectorTableProps> = {
    ...tableProps,
    toTableRows: (
        {
            data, id = "",
        }: IInspectorRow,
        props: IToTableRowsProps,
        options: Partial<IToTableRowsOptions> = {},
        pathPrefix: string = "",
    ): IInspectorRow[] => {
        const rows: IInspectorRow[] = [];
        if (data === undefined) {
            return rows;
        }
        const root: IInspectorRow = {
            name: "root",
            id: "root",
            context: "single",
            typeid: data.type || "",
        };
        root.children = getChildren(data, root.id);
        rows.push(root);
        return rows;
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
        {...other}
      >
        {value === index && (children)}
      </div>
    );
}

export const InspectorApp = (props: any) => {
    const classes = useStyles();

    const customData = buildProxy(person);

    const [json, setJson] = useState(customData);
    const [tabIndex, setTabIndex] = useState(0);

    const onJsonEdit = ({ updated_src }) => {
        setJson(updated_src);
    };

    return (
        <MuiThemeProvider theme={theme}>
            <ModalManager>
                <ModalRoot />
                <div className={classes.root}>
                    <div className={classes.horizontalContainer}>
                        <div className={classes.editor}>
                            <ReactJson src={json} onEdit={onJsonEdit}/>
                        </div>
                        <div className={classes.verticalContainer}>
                            <Tabs value={tabIndex} onChange={(event, newTabIndex) => setTabIndex(newTabIndex)}>
                                <Tab label="PropertyDDS" id="tab-propertyDDS"/>
                                <Tab label="JSON" id="tab-json"/>
                            </Tabs>
                            <div className={classes.tableContainer}>
                                <AutoSizer>
                                {
                                    ({ width, height }) =>
                                        <div className={classes.horizontalContainer}>
                                            <TabPanel value={tabIndex} index={0}>
                                                <InspectorTable
                                                    {...tableProps}
                                                    width={width}
                                                    height={height}
                                                    {...props}
                                                />
                                            </TabPanel>
                                            <TabPanel value={tabIndex} index={1}>
                                                <InspectorTable
                                                    readOnly={true}
                                                    {...jsonTableProps}
                                                    width={width}
                                                    height={height}
                                                    {...props}
                                                    data={json}
                                                />
                                            </TabPanel>
                                        </div>
                                    }
                                </AutoSizer>
                            </div>
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
