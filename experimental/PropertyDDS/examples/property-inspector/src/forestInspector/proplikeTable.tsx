/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import * as React from "react";

import {
    // handlePropertyDataCreation,
    fetchRegisteredTemplates,
    IDataCreationOptions,
    IInspectorRow,
    IInspectorTableProps,
    InspectorTable,
    fillExpanded,
    nameCellRenderer,
    valueCellRenderer,
    typeCellRenderer,
    toTableRows,
    generateForm,
    addDataForm,
    expandAll,
    getDefaultInspectorTableIcons,
} from "@fluid-experimental/property-inspector-table";

export const handleDataCreationOptionGeneration = (rowData: IInspectorRow, nameOnly: boolean): IDataCreationOptions => {
    if (nameOnly) {
        return { name: "property" };
    }
    const templates = fetchRegisteredTemplates();
    return { name: "property", options: templates };
};

export const propertyTableProps: Partial<IInspectorTableProps> = {
    columns: ["name", "value", "type"],
    expandColumnKey: "name",
    width: 1000,
    height: 600,
    dataCreationHandler: async (rowData: any, name: string, typeid: string, context: string): Promise<any> => {
        if (typeid.startsWith("String") && context === "single") {
            rowData.parent[name] = "";
        } else if (context === "single" && typeid.startsWith("Int")) {
            rowData.parent[name] = 0;
        } else if (context === "single" && typeid.startsWith("Float")) {
            rowData.parent[name] = 0.0;
        }

        return new Promise((resolve) => resolve(true));
    },
    dataCreationOptionGenerationHandler: handleDataCreationOptionGeneration,
    fillExpanded,
    toTableRows,
    expandAll,
    generateForm,
    rowIconRenderer: getDefaultInspectorTableIcons,
    addDataForm,
    columnsRenderers: {
        name: nameCellRenderer,
        value: valueCellRenderer,
        type: typeCellRenderer,
    },
};

export const ProplikeTable = (props: IInspectorTableProps) => {
    return <InspectorTable {...propertyTableProps} {...props} />;
};
