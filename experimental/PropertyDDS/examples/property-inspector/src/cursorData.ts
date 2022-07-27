/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import { IRowData } from "@fluid-experimental/property-inspector-table";
import {
    TreeNavigationResult,
    TreeType,
    EmptyKey,
    ITreeCursor,
    FieldKey,
    jsonArray,
    jsonObject,
} from "@fluid-internal/tree";

export interface IInspectorRowData extends IRowData<any> {
    name?: string;
    value?: number | string | [] | boolean | Record<string, unknown>;
    type?: TreeType;
}

const cursorToRowData = (
    cursor: ITreeCursor, parentKey: FieldKey, key: FieldKey, idx: number, isReadOnly: boolean,
): IInspectorRowData => {
    const type = cursor.type;
    const value = type === jsonArray.name ? `[${cursor.length(EmptyKey)}]` : cursor.value;
    const name = key as string || String(idx);
    const id = `${parentKey}/${name}`;
    const children: IInspectorRowData[] = getDataFromCursor(cursor, [], isReadOnly, id as FieldKey);
    const rowData: IInspectorRowData = { id, name, value, type, children };
    return rowData;
};

export const getDataFromCursor = (
    cursor: ITreeCursor, rows: IInspectorRowData[], isReadOnly: boolean = true, parentKey: FieldKey = EmptyKey,
): IInspectorRowData[] => {
    if (cursor.type === jsonArray.name) {
        const len = cursor.length(EmptyKey);
        for (let idx = 0; idx < len; idx++) {
            const result = cursor.down(EmptyKey, idx);
            if (result === TreeNavigationResult.Ok) {
                rows.push(cursorToRowData(cursor, parentKey, EmptyKey, idx, isReadOnly));
            }
            cursor.up();
        }
    } else {
        for (const key of cursor.keys) {
            const result = cursor.down(key, 0);
            if (result === TreeNavigationResult.Ok) {
                rows.push(cursorToRowData(cursor, parentKey, key, 0, isReadOnly));
            }
            cursor.up();
        }
    }
    if (!isReadOnly && (cursor.type === jsonArray.name || cursor.type === jsonObject.name)) {
        const newRow: IInspectorRowData = {
            id: `${parentKey}/Add`,
            isNewDataRow: true,
        };
        rows.push(newRow);
    }
    return rows;
};
