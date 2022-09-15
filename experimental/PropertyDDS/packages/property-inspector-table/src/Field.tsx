/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import * as React from "react";
import { StringView, typeToViewMap } from "./PropertyViews";
import { IEditableValueCellProps } from "./InspectorTableTypes";

export const Field: React.FunctionComponent<IEditableValueCellProps> = ({ rowData, onSubmit, ...restProps }) => {
    const typeid = rowData.typeid;

    const ViewComponent: React.ComponentType<any> = typeToViewMap[typeid]
        ? typeToViewMap[typeid]
        : StringView;

    return (
        <ViewComponent
            onSubmit={onSubmit}
            rowData={rowData}
            {...restProps}
        />
    );
};
