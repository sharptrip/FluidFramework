/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import React, { useState } from "react";
import ReactDOM from "react-dom";

import { assert } from "@fluidframework/common-utils";
import {
    UnwrappedEditableField,
    EditableTree,
    typeNameSymbol,
    valueSymbol,
    isUnwrappedNode,
    EditableTreeContext,
    indexSymbol,
    keyFromSymbol,
    fieldKinds,
} from "@fluid-internal/tree";
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
    EditableTreeRow,
} from "@fluid-experimental/property-inspector-table";

import { Tabs, Tab } from "@material-ui/core";
import { makeStyles } from "@material-ui/styles";
import { MuiThemeProvider } from "@material-ui/core/styles";

import AutoSizer from "react-virtualized-auto-sizer";

import { theme } from "./theme";

const useStyles = makeStyles(
    {
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
    },
    { name: "InspectorApp" },
);

export const handleDataCreationOptionGeneration = (
    rowData: EditableTreeRow,
    nameOnly: boolean,
): IDataCreationOptions => {
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

function node2row(
    parent: EditableTree,
    node: EditableTree,
    fieldKey: string,
    pathPrefix: string,
    isSequenceNode = false,
): EditableTreeRow {
    const id = `${pathPrefix}/${fieldKey}[${node[indexSymbol]}]`;
    const name = isSequenceNode ? `[${node[indexSymbol]}]` : fieldKey;
    const row: EditableTreeRow = {
        id,
        name,
        context: "single",
        children: getChildren(node, id),
        isReference: false,
        value: node[valueSymbol],
        typeid: node[typeNameSymbol],
        parent,
        isEditableTree: true,
    };
    return row;
}

const getChildren = (parent: EditableTree, pathPrefix?: string): EditableTreeRow[] => {
    const rows: EditableTreeRow[] = [];
    // use `Reflect.ownKeys` instead of `Object.keys`
    // since latter does not support symbols, which are used to handle global fields
    for (const field of parent) {
        // TODO: id for same string representation of local and global field keys
        const keyAsString =
            typeof field.fieldKey === "symbol" ? keyFromSymbol(field.fieldKey) : field.fieldKey;
        if (field.fieldSchema.kind === fieldKinds.sequence) {
            for (let index = 0; index < field.length; index++) {
                rows.push(node2row(parent, field.getNode(index), keyAsString, pathPrefix ?? "", true));
            }
        } else {
            rows.push(node2row(parent, field.getNode(0), keyAsString, pathPrefix ?? ""));
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
        { data, id = "" }: EditableTreeRow,
        props: IToTableRowsProps,
        options: Partial<IToTableRowsOptions> = {},
        pathPrefix: string = "",
    ): EditableTreeRow[] => {
        const rows: EditableTreeRow[] = [];
        if (data === undefined) {
            return rows;
        }
        assert(isUnwrappedNode(data), "Root must not be primitive.");
        const typeid = data[typeNameSymbol];
        const root: EditableTreeRow = {
            name: "/",
            id: "/",
            context: "single",
            typeid: typeid || "",
            isEditableTree: true,
        };
        root.children = getChildren(data);
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
        <div role="tabpanel" hidden={value !== index} id={`simple-tabpanel-${index}`} {...other}>
            {value === index && children}
        </div>
    );
}

export const InspectorApp = (props: any) => {
    const classes = useStyles();
    const { data } = props;

    const { context, root }: InspectorAppData = data;
    let state = 0;
    const [, updateState] = React.useState(state);
    context.attachAfterChangeHandler(() => updateState(++state));

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
                            <Tabs
                                value={tabIndex}
                                onChange={(event, newTabIndex) => setTabIndex(newTabIndex)}
                            >
                                <Tab label="Editable Tree" id="tab-editableTree" />
                                {/* <Tab label="JSON" id="tab-json"/> */}
                            </Tabs>
                            <div className={classes.tableContainer}>
                                <AutoSizer>
                                    {({ width, height }) => (
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
                                                    data={root}
                                                />
                                            </TabPanel>
                                        </div>
                                    )}
                                </AutoSizer>
                            </div>
                        </div>
                    </div>
                </div>
            </ModalManager>
        </MuiThemeProvider>
    );
};

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type InspectorAppData = {
    context: EditableTreeContext;
    root: UnwrappedEditableField;
};

export function renderApp(data: InspectorAppData, element: HTMLElement) {
    ReactDOM.render(<InspectorApp data={data} />, element);
}
