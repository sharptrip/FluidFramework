/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
/*
 * THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
 * Generated by fluid-type-test-generator in @fluidframework/build-tools.
 */
import type * as old from "@fluid-tools/webpack-fluid-loader-previous";
import type * as current from "../../index";


// See 'build-tools/src/type-test-generator/compatibility.ts' for more information.
type TypeOnly<T> = T extends number
	? number
	: T extends string
	? string
	: T extends boolean | bigint | symbol
	? T
	: {
			[P in keyof T]: TypeOnly<T[P]>;
	  };

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "VariableDeclaration_after": {"forwardCompat": false}
*/
declare function get_old_VariableDeclaration_after():
    TypeOnly<typeof old.after>;
declare function use_current_VariableDeclaration_after(
    use: TypeOnly<typeof current.after>);
use_current_VariableDeclaration_after(
    get_old_VariableDeclaration_after());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "VariableDeclaration_after": {"backCompat": false}
*/
declare function get_current_VariableDeclaration_after():
    TypeOnly<typeof current.after>;
declare function use_old_VariableDeclaration_after(
    use: TypeOnly<typeof old.after>);
use_old_VariableDeclaration_after(
    get_current_VariableDeclaration_after());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "VariableDeclaration_before": {"forwardCompat": false}
*/
declare function get_old_VariableDeclaration_before():
    TypeOnly<typeof old.before>;
declare function use_current_VariableDeclaration_before(
    use: TypeOnly<typeof current.before>);
use_current_VariableDeclaration_before(
    get_old_VariableDeclaration_before());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "VariableDeclaration_before": {"backCompat": false}
*/
declare function get_current_VariableDeclaration_before():
    TypeOnly<typeof current.before>;
declare function use_old_VariableDeclaration_before(
    use: TypeOnly<typeof old.before>);
use_old_VariableDeclaration_before(
    get_current_VariableDeclaration_before());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "FunctionDeclaration_devServerConfig": {"forwardCompat": false}
*/
declare function get_old_FunctionDeclaration_devServerConfig():
    TypeOnly<typeof old.devServerConfig>;
declare function use_current_FunctionDeclaration_devServerConfig(
    use: TypeOnly<typeof current.devServerConfig>);
use_current_FunctionDeclaration_devServerConfig(
    get_old_FunctionDeclaration_devServerConfig());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "FunctionDeclaration_devServerConfig": {"backCompat": false}
*/
declare function get_current_FunctionDeclaration_devServerConfig():
    TypeOnly<typeof current.devServerConfig>;
declare function use_old_FunctionDeclaration_devServerConfig(
    use: TypeOnly<typeof old.devServerConfig>);
use_old_FunctionDeclaration_devServerConfig(
    get_current_FunctionDeclaration_devServerConfig());
