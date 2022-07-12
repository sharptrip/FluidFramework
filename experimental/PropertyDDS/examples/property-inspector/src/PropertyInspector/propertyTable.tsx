import * as React from "react";

import { InspectorTable } from "@fluid-experimental/property-inspector-table";

export interface IPropertyTableProps {

}

export const PropertyTable = (props: IPropertyTableProps) => {
    return <InspectorTable {...props} />;
};
