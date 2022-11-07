/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import React, { useState } from "react";
import ReactDOM from "react-dom";

import { assert } from "@fluidframework/common-utils";
import {
    EditableTree,
    typeNameSymbol,
    valueSymbol,
    EditableTreeContext,
    indexSymbol,
    keyFromSymbol,
    fieldKinds,
    isEditableField,
    EditableField,
    isGlobalFieldKey,
    isPrimitive,
    typeSymbol,
    isUnwrappedNode,
    createField,
    singleTextCursor,
    brand,
    getPrimaryField,
} from "@fluid-internal/tree";
import {
    IDataCreationOptions,
    IInspectorTableProps,
    InspectorTable,
    ModalManager,
    ModalRoot,
    fetchRegisteredTemplates,
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
    dataCreationHandler: async (rowData: EditableTreeRow, name: string, typeid: string, context: string) => {
        // TODO: clarify & fix, how a generic schema like `NodeProperty` should be handled
        // It seems that currently the `schemaConverter` incorrectly handles it.
        if (isUnwrappedNode(rowData.parent)) {
            rowData.parent[createField](brand(name), singleTextCursor({ type: brand(typeid) }));
        } else {
            rowData.parent.insertNodes(Number(name), singleTextCursor({ type: brand(typeid) }));
        }
    },
    dataCreationOptionGenerationHandler: handleDataCreationOptionGeneration,
    expandColumnKey: "name",
    width: 1000,
    height: 600,
};

function nodeToRow(
    parent: EditableField,
    node: EditableTree,
    pathPrefix: string,
    isSequenceNode = false,
): EditableTreeRow {
    const fieldKey = parent.fieldKey;
    const keyAsString =
        pathPrefix === "" ? "/" : isGlobalFieldKey(fieldKey) ? keyFromSymbol(fieldKey) : fieldKey;
    const nodeIndex = node[indexSymbol];
    const id = `${pathPrefix}/${String(fieldKey)}[${nodeIndex}]`;
    const name = isSequenceNode ? `[${nodeIndex}]` : keyAsString;
    const row: EditableTreeRow = {
        id,
        name,
        context: "single",
        children: getNodeFields(node, id),
        isReference: false,
        value: node[valueSymbol],
        typeid: node[typeNameSymbol],
        parent,
        data: node,
        isEditableTree: true,
    };
    return row;
}

const getNodeFields = (
    node: EditableTree,
    pathPrefix: string,
): EditableTreeRow[] => {
    const rows: EditableTreeRow[] = [];
    for (const field of node) {
        getFieldNodes(field, rows, pathPrefix);
    }
    const nodeType = node[typeSymbol];
    // Prevent to create fields under a node already having a primary field.
    // It is not well defined, how array should look like, see note on `getPrimaryField`.
    // TODO: clarify & fix
    if (!isPrimitive(nodeType) && getPrimaryField(nodeType) === undefined) {
        rows.push({
            id: `${pathPrefix}/Add`,
            isNewDataRow: true,
            parent: node,
            value: "",
            typeid: "",
            name: "",
            isEditableTree: true,
        });
    }
    return rows;
};

const getFieldNodes = (
    field: EditableField,
    rows: EditableTreeRow[] = [],
    pathPrefix = "",
): EditableTreeRow[] => {
    const isSequence = field.fieldSchema.kind === fieldKinds.sequence;
    for (let index = 0; index < field.length; index++) {
        const node = field.getNode(index);
        rows.push(nodeToRow(field, node, pathPrefix, isSequence));
    }
    if (isSequence) {
        rows.push({
            id: `${pathPrefix}/Add`,
            isNewDataRow: true,
            parent: field,
            value: "",
            typeid: "",
            name: "",
            isEditableTree: true,
        });
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
        assert(isEditableField(data), "wrong root type");
        return getFieldNodes(data);
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
                                                    data={data}
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
};

export function renderApp(data: InspectorAppData, element: HTMLElement) {
    const { context } = data;
    const render = () => {
        context.free();
        ReactDOM.render(<InspectorApp data={context.root} />, element);
    };
    context.attachAfterChangeHandler(render);
    render();
}
