/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import { createStyles, withStyles, WithStyles } from "@material-ui/core/styles";
import classNames from "classnames";
import * as React from "react";
import { iconMarginRight, iconWidth, InspectorMessages, unit } from "./constants";
import { Field } from "./Field";
import { IEditableValueCellProps } from "./InspectorTableTypes";
import { TooltipedField } from "./TooltipedField";

const styles = () =>
	createStyles({
		container: {
			alignItems: "center",
			display: "flex",
			flexGrow: 1,
			height: "100%",
			width: "100%",
		},
		info: {
			color: "#3C3C3C",
			fontFamily: "ArtifaktElement, Helvetica, Arial",
			fontSize: "11px",
			fontStyle: "normal",
			fontWeight: "normal",
			lineHeight: "13px",
		},
		input: {
			flexShrink: 0,
			height: iconWidth,
			marginLeft: `${iconMarginRight}${unit}`,
			marginRight: `${iconMarginRight}${unit}`,
			width: iconWidth,
		},
		textField: {
			width: "100%",
		},
		tooltip: {
			"background-color": "black",
		},
	});

/**
 * Inspector table value column cell, which allows viewing and editing the value of the property for which
 * the row represents.
 */
const EditableValueCell: React.FunctionComponent<
	WithStyles<typeof styles> & IEditableValueCellProps
> = (props) => {
	const { classes, className, followReferences, rowData, iconRenderer, ...restProps } = props;

	return (
		<div className={classNames(className, classes.container)} {...restProps}>
			{rowData.isConstant || rowData.parentIsConstant ? (
				<TooltipedField message={InspectorMessages.CONSTANT_PROPERTY} {...props} />
			) : (
				<Field {...props} />
			)}
		</div>
	);
};

const StyledEditableValueCell = withStyles(styles, { name: "EditableValueCell" })(
	EditableValueCell,
);
export { StyledEditableValueCell as EditableValueCell };
