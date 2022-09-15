/* eslint-disable max-len */
/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";

import _ from "lodash";
import { assert } from "@fluidframework/common-utils";
import {
    // EditableTreeContext, UnwrappedEditableField,
    getTypeSymbol, isPrimitive, proxyTargetSymbol,
    TreeSchema, UnwrappedEditableTree, Value,
    SimpleObservingDependent,
    IEditableForest,
    InvalidationToken,
    Delta,
    EditableTreeContext,
    UnwrappedEditableField,
    ISharedTree,
    getEditableTree,
} from "@fluid-internal/tree";
import { clone } from "@fluid-internal/tree/dist/util";
import {
    IDataCreationOptions,
    IInspectorTableProps,
    InspectorTable,
    ModalManager,
    ModalRoot,
    fetchRegisteredTemplates,
    handlePropertyDataCreation,
    IToTableRowsProps,
    IToTableRowsOptions,
    nameCellRenderer,
    typeCellRenderer,
    valueCellRenderer,
    // NewDataForm,
    // getShortId,
    IRowData,
} from "@fluid-experimental/property-inspector-table";

import { Tabs, Tab } from "@material-ui/core";
import { makeStyles } from "@material-ui/styles";
import { MuiThemeProvider } from "@material-ui/core/styles";

// import ReactJson from "react-json-view";

// import { PropertyProxy } from "@fluid-experimental/property-proxy";

// import { DataBinder } from "@fluid-experimental/property-binder";
// import { SharedPropertyTree } from "@fluid-experimental/property-dds";
import AutoSizer from "react-virtualized-auto-sizer";

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

interface PropertyRow<T = UnwrappedEditableTree> extends IRowData<T> {
    context?: string;
    typeid: string;
    isReference?: boolean;
    parent?: T;
    value?: Value;
    name: string;
}

export const handleDataCreationOptionGeneration = (rowData: PropertyRow, nameOnly: boolean):
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

const getChildren = (data, pathPrefix?: string): PropertyRow[] => {
    const rows: PropertyRow[] = [];
    if (data === undefined) {
        return rows;
    }
    for (const key of Object.keys(data)) {
        assert(data[key] !== undefined, "undefined detected!!!");
        const type = data[getTypeSymbol](key) as TreeSchema;
        const typeid = data[getTypeSymbol](key, true) ?? "";
        if (isPrimitive(type) && typeof data[key] !== "object") {
            const row: PropertyRow = {
                id: `${pathPrefix}/${key}`,
                name: key,
                context: "single",
                children: [],
                isReference: false,
                value: data[key],
                typeid,
                parent: data,
            };
            rows.push(row);
        } else if (proxyTargetSymbol in data[key] && Object.keys(data[key]).length) {
            const row: PropertyRow = {
                id: `${pathPrefix}/${key}`,
                name: key,
                context: "single",
                children: getChildren(data[key], `${pathPrefix}/${key}`),
                isReference: false,
                typeid,
                parent: data,
            };
            rows.push(row);
        }
    }
    return rows;
};

const editableTreeTableProps: Partial<IInspectorTableProps> = {
    ...tableProps,
    columnsRenderers: {
        name: nameCellRenderer,
        value: valueCellRenderer,
        type: typeCellRenderer,
    },
    toTableRows: (
        {
            data, id = "",
        }: PropertyRow,
        props: IToTableRowsProps,
        options: Partial<IToTableRowsOptions> = {},
        pathPrefix: string = "",
    ): PropertyRow[] => {
        const rows: PropertyRow[] = [];
        if (data === undefined) {
            return rows;
        }
        const typeid = data?.[getTypeSymbol]?.(undefined, true) ?? "";
        const root: PropertyRow = {
            name: "root",
            id: "root",
            context: "single",
            typeid: typeid || "",
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
    const { data } = props;

    const { context, editableTree }: { context: EditableTreeContext; editableTree: UnwrappedEditableField; } = data;
    let state = 0;
    const [, updateState] = React.useState(state);
    context.registerAfterHandler(() => {
        state += 1;
        updateState(state);
    });
    // React.useCallback(forceUpdate, []);

    // useEffect(() => {
    //     const forest = sharedTree.forest as IEditableForest;
    //     const dependent = new SimpleObservingDependent((token?: InvalidationToken, delta?: Delta.Root) => {
    //         if (token?.isSecondaryInvalidation) {
    //             forceUpdate();
    //         } else {
    //             if (context) {
    //                 context.prepareForEdit();
    //             }
    //             (forest as any).currentCursors.clear();
    //         }
    //     });

    //     // if (forest.roots.get(forest.rootField).length !== 0) {
    //     //     const data = getEditableTree(inspectorProps.editableTree);
    //     //     setProxyData(() => data);
    //     // }
    //     forest.registerDependent(dependent);

    //     return () => context.free();
    // }, []);

    // const [json, setJson] = useState(editableTree);
    const [tabIndex, setTabIndex] = useState(0);

    // const onJsonEdit = ({ updated_src }) => {
    //     setJson(updated_src);
    // };

    return (
        <MuiThemeProvider theme={theme}>
            <ModalManager>
                <ModalRoot />
                <div className={classes.root}>
                    <div className={classes.horizontalContainer}>
                        {/* <div className={classes.editor}>
                            <ReactJson src={json as EditableTree} onEdit={onJsonEdit}/>
                        </div> */}
                        <div className={classes.verticalContainer}>
                            <Tabs value={tabIndex} onChange={(event, newTabIndex) => setTabIndex(newTabIndex)}>
                                <Tab label="Editable Tree" id="tab-editableTree"/>
                                {/* <Tab label="JSON" id="tab-json"/> */}
                            </Tabs>
                            <div className={classes.tableContainer}>
                                <AutoSizer>
                                {
                                    ({ width, height }) =>
                                        <div className={classes.horizontalContainer}>
                                            {/* <TabPanel value={tabIndex} index={1}>
                                                <InspectorTable
                                                    {...tableProps}
                                                    width={width}
                                                    height={height}
                                                    {...props}
                                                />
                                            </TabPanel> */}
                                            <TabPanel value={tabIndex} index={0}>
                                                <InspectorTable
                                                    readOnly={false}
                                                    {...editableTreeTableProps}
                                                    width={width}
                                                    height={height}
                                                    {...props}
                                                    data={editableTree}
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

export function renderApp(data: any, element: HTMLElement) {
    ReactDOM.render(<InspectorApp data={data} />, element);
    // const dataBinder = new DataBinder();

    // dataBinder.attachTo(propertyTree);

    // // Listening to any change the root path of the PropertyDDS, and rendering the latest state of the
    // // inspector tree-table.
    // dataBinder.registerOnPath("/", ["insert", "remove", "modify"], _.debounce(() => {
    //     // Create an ES6 proxy for the DDS, this enables JS object interface for interacting with the DDS.
    //     // Note: This is what currently inspector table expect for "data" prop.
    //     const proxifiedDDS = PropertyProxy.proxify(propertyTree.root);
    //     ReactDOM.render(<InspectorApp data={proxifiedDDS} />, element);
    // }, 20));
}
