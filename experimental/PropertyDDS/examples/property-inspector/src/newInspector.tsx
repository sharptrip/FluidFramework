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
    symbolIsFieldKey,
    isPrimitive,
    typeSymbol,
    isUnwrappedNode,
    createField,
    singleTextCursor,
    brand,
    hasPrimaryField,
    FieldKey,
    ValueSchema,
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
    IEditableTreeRow,
    IExpandedMap,
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
    rowData: IEditableTreeRow,
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
    dataCreationHandler: async (rowData: IEditableTreeRow, name: string, typeid: string, context: string) => {
        // TODO: a workaround to avoid issues with `React.Switch`, as it handles undefined booleans differently.
        // Anyway, this is a good candidate to be handled by either a view (or app) schema or a stored schema
        // i.e. to statically force boolean nodes to be valuated.
        const value = typeid === "Bool" ? false : undefined;
        const newContent = singleTextCursor({ type: brand(typeid), value });
        // TODO: clarify & fix, how a generic schema like `NodeProperty` should be handled
        // It seems that currently the `schemaConverter` incorrectly handles it.
        if (isUnwrappedNode(rowData.parent)) {
            rowData.parent[createField](brand(name), newContent);
        } else {
            rowData.parent.insertNodes(Number(name), newContent);
        }
    },
    dataCreationOptionGenerationHandler: handleDataCreationOptionGeneration,
    expandColumnKey: "name",
    width: 1000,
    height: 600,
    expandAll: (data: EditableField): IExpandedMap => {
        assert(isEditableField(data), "wrong root type");
        return forEachNode(expandNode, data, {});
    },
};

function expandNode(
    expanded: IExpandedMap,
    parent: EditableField,
    node: EditableTree,
    pathPrefix: string,
): void {
    const id = getRowId(parent.fieldKey, node[indexSymbol], pathPrefix);
    const nodeType = node[typeSymbol];
    // TODO: e.g., how to properly schematize maps (`Serializable`)?
    if (!isPrimitive(nodeType) || nodeType.value === ValueSchema.Serializable) {
        expanded[id] = true;
    }
    forEachField(expandNode, expanded, node, id);
}

// TODO: maybe discuss alternatives on how global fields must be converted into row IDs.
// Global fields in runtime are used as follows:
// - as `GlobalFieldKeySymbol` (a symbol) => `Symbol(myGlobalField)` - used to read the tree data;
// - as `GlobalFieldKey` (a string) => `myGlobalField` - used in `TreeSchema` and `JsonableTree`,
// since global and local fields there are structurally separated.
// Here we use "Symbol(myGlobalField)" (and not "myGlobalField") as a unique ID for this field,
// since then a name clashing occurs iff one defines a local field "Symbol(myGlobalField)" for the same node,
// and it will be more probable if we'll use just a string "myGlobalField" instead.
// We might introduce a new special syntax for the IDs of global fields to avoid clashing,
// but it seems that the default syntax already provides a very good safeguard though.
const getRowId = (fieldKey: FieldKey, nodeIndex: number, pathPrefix: string): string =>
    `${pathPrefix}/${String(fieldKey)}[${nodeIndex}]`;

function stringifyKey(fieldKey: FieldKey): string {
    if (isGlobalFieldKey(fieldKey) && symbolIsFieldKey(fieldKey)) {
        return keyFromSymbol(fieldKey);
    }
    return fieldKey;
}

function nodeToRows(
    rows: IEditableTreeRow[],
    parent: EditableField,
    node: EditableTree,
    pathPrefix: string,
    isSequenceNode = false,
): void {
    const fieldKey = parent.fieldKey;
    const nodeIndex = node[indexSymbol];
    const id = getRowId(fieldKey, nodeIndex, pathPrefix);
    // TODO: this is a workaround, which must be replaced with the `EditableTreeUpPath` (not yet implemented)
    // in order to get, if the field is a root field.
    // For `EditableTreeUpPath`, see https://github.com/microsoft/FluidFramework/pull/12810#issuecomment-1303949419
    const keyAsString = pathPrefix === "" ? "/" : stringifyKey(fieldKey);
    const name = isSequenceNode ? `[${nodeIndex}]` : keyAsString;
    const children = forEachField(nodeToRows, [], node, id, addNewDataLine);
    // TODO: currently, the whole story around arrays is not well defined neither implemented.
    // Prevent to create fields under a node already having a primary field.
    if (!(isPrimitive(node[typeSymbol]) || hasPrimaryField(node))
        || node[typeSymbol].value === ValueSchema.Serializable) {
        addNewDataLine(children, node, id);
    }
    rows.push({
        id,
        name,
        context: "single",
        children,
        isReference: false,
        value: node[valueSymbol],
        typeid: node[typeNameSymbol],
        parent,
        data: node,
        isEditableTree: true,
    });
}

function addNewDataLine(rows: IEditableTreeRow[], parent: EditableField | EditableTree, pathPrefix: string): void {
    rows.push({
        id: `${pathPrefix}/Add`,
        isNewDataRow: true,
        parent,
        value: "",
        typeid: "",
        name: "",
        isEditableTree: true,
    });
}

function forEachField<T>(
    fn: (result: T, parent: EditableField, node: EditableTree, pathPrefix: string, isSequence: boolean) => void,
    data: T,
    node: EditableTree,
    pathPrefix: string,
    addOnIfSequenceField?: (result: T, parent: EditableField | EditableTree, pathPrefix: string) => void,
): T {
    for (const field of node) {
        forEachNode(fn, field, data, pathPrefix, addOnIfSequenceField);
    }
    return data;
}

function forEachNode<T>(
    fn: (result: T, parent: EditableField, node: EditableTree, pathPrefix: string, isSequence: boolean) => void,
    field: EditableField,
    data: T,
    pathPrefix = "",
    addOnIfSequenceField?: (result: T, parent: EditableField | EditableTree, pathPrefix: string) => void,
): T {
    const isSequence = field.fieldSchema.kind === fieldKinds.sequence;
    for (let index = 0; index < field.length; index++) {
        const node = field.getNode(index);
        fn(data, field, node, pathPrefix, isSequence);
    }
    if (isSequence && addOnIfSequenceField !== undefined) {
        addOnIfSequenceField(data, field, pathPrefix);
    }
    return data;
}

const editableTreeTableProps: Partial<IInspectorTableProps> = {
    ...tableProps,
    columnsRenderers: {
        name: nameCellRenderer,
        value: valueCellRenderer,
        type: typeCellRenderer,
    },
    toTableRows: (
        { data, id = "" }: IEditableTreeRow,
        props: IToTableRowsProps,
        options: Partial<IToTableRowsOptions> = {},
        pathPrefix: string = "",
    ): IEditableTreeRow[] => {
        assert(isEditableField(data), "wrong root type");
        return forEachNode(nodeToRows, data, [], "", addNewDataLine);
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
