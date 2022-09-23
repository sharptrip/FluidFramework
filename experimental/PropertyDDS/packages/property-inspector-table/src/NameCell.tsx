/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { createStyles, withStyles, WithStyles } from "@material-ui/core/styles";
import classNames from "classnames";
import * as React from "react";
import { ICopyOptions, ItemMenu } from "./ItemMenu";
import { iconMarginRight, iconWidth, unit } from "./constants";
import { IInspectorRow } from "./InspectorTableTypes";
import { OverflowableCell } from "./OverflowableCell";
import { IDeleteOptions } from "./DeleteModal";

const styles = () => createStyles({
  iconContainer: {
    height: iconWidth,
    marginRight: `${iconMarginRight}${unit}`, width: iconWidth,
  },
  menuGravity: {
    visibility: "hidden",
    width: "56px",
  },
  rowContainer: {
    "&:hover $menuGravity": {
      visibility: "visible",
    },
    "display": "flex",
    "justify-content": "space-between",
    "width": "100%",
  },
  textAndIconContainer: {
    alignItems: "center",
    display: "flex",
    width: "100%",
  },
});

export interface ICellProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * A callback that returns the icons based on the row data.
   */
  iconRenderer: (rowData: IInspectorRow) => React.ReactNode;
  /**
   * The row data of the row which contains the cell.
   */
  rowData: IInspectorRow;
}

export interface INameCellProps {
  editReferenceHandler: any;
  readOnly: boolean;
  copyHandler?: ICopyOptions["handler"];
  deleteHandler?: IDeleteOptions["handler"];
}

// Class names that are relevant to fake a hover style on the table row.
const BaseTableRowClass = "BaseTable__row";
const NameCellHoveredClass = "NameCell__hovered";

/**
 * Inspector table name column cell. Displays the property name for which the row represents.
 */
const NameCell: React.FunctionComponent<WithStyles<typeof styles> & INameCellProps & ICellProps> =
({ rowData, iconRenderer, classes, className, editReferenceHandler, readOnly,
  deleteHandler, copyHandler, ...restProps }) => {
  const icon = iconRenderer(rowData);
  const ref = React.useRef<HTMLDivElement>(null);

  /**
   * A callback that is executed when we open or close the menu/modal. It modifies the class name of the cell to
   * keep the menu icon visible when the menu is opened.
   */
  const menuHandler = () => {
    // Get menu element and make it visible.
    if (ref.current) {
      const menuElement = ref.current;
      menuElement.classList.toggle(classes.menuGravity);

      // Get table row and set its hover state
      let parentElement: HTMLElement | null = menuElement.parentElement;
      while (parentElement && !parentElement.classList.contains(BaseTableRowClass)) {
        parentElement = parentElement.parentElement;
      }
      if (parentElement) {
        parentElement.classList.toggle(NameCellHoveredClass);
      }
    }
  };
  return (
    <div className={classNames(classes.rowContainer, className)}>
      <div className={classes.textAndIconContainer}>
        <div className={classes.iconContainer}>
          {icon}
        </div>
        <OverflowableCell
          cellContent={rowData.name}
        />
      </div>
      <div className={classNames(classes.menuGravity)} ref={ref}>
        <ItemMenu
          name={rowData.name}
          openHandler={menuHandler}
          closeHandler={menuHandler}
          options={{
            copy: copyHandler ? {
              handler: copyHandler.bind(null, rowData),
            } : undefined,
            delete: deleteHandler ? {
              handler: deleteHandler.bind(null, rowData, readOnly),
            } : undefined,
            edit: !readOnly && (rowData.isReference) ?
              { handler: editReferenceHandler } : undefined,
          }}
          modalTextParameters={{
            modalCallingSource: "property",
            modalHeader: `Delete Property`,
          }}
        />
      </div>
    </div>
  );
};

const StyledNameCell = withStyles(styles, { name: "NameCell" })(NameCell);
export { StyledNameCell as NameCell };
