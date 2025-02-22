/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
/*
 * THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
 * Generated by fluid-type-test-generator in @fluidframework/build-tools.
 */
import type * as old from "@fluidframework/ordered-collection-previous";
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
* "TypeAliasDeclaration_ConsensusCallback": {"forwardCompat": false}
*/
declare function get_old_TypeAliasDeclaration_ConsensusCallback():
    TypeOnly<old.ConsensusCallback<any>>;
declare function use_current_TypeAliasDeclaration_ConsensusCallback(
    use: TypeOnly<current.ConsensusCallback<any>>);
use_current_TypeAliasDeclaration_ConsensusCallback(
    get_old_TypeAliasDeclaration_ConsensusCallback());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "TypeAliasDeclaration_ConsensusCallback": {"backCompat": false}
*/
declare function get_current_TypeAliasDeclaration_ConsensusCallback():
    TypeOnly<current.ConsensusCallback<any>>;
declare function use_old_TypeAliasDeclaration_ConsensusCallback(
    use: TypeOnly<old.ConsensusCallback<any>>);
use_old_TypeAliasDeclaration_ConsensusCallback(
    get_current_TypeAliasDeclaration_ConsensusCallback());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "ClassDeclaration_ConsensusOrderedCollection": {"forwardCompat": false}
*/
declare function get_old_ClassDeclaration_ConsensusOrderedCollection():
    TypeOnly<old.ConsensusOrderedCollection>;
declare function use_current_ClassDeclaration_ConsensusOrderedCollection(
    use: TypeOnly<current.ConsensusOrderedCollection>);
use_current_ClassDeclaration_ConsensusOrderedCollection(
    get_old_ClassDeclaration_ConsensusOrderedCollection());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "ClassDeclaration_ConsensusOrderedCollection": {"backCompat": false}
*/
declare function get_current_ClassDeclaration_ConsensusOrderedCollection():
    TypeOnly<current.ConsensusOrderedCollection>;
declare function use_old_ClassDeclaration_ConsensusOrderedCollection(
    use: TypeOnly<old.ConsensusOrderedCollection>);
use_old_ClassDeclaration_ConsensusOrderedCollection(
    get_current_ClassDeclaration_ConsensusOrderedCollection());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "ClassDeclaration_ConsensusQueue": {"forwardCompat": false}
*/
declare function get_old_ClassDeclaration_ConsensusQueue():
    TypeOnly<old.ConsensusQueue>;
declare function use_current_ClassDeclaration_ConsensusQueue(
    use: TypeOnly<current.ConsensusQueue>);
use_current_ClassDeclaration_ConsensusQueue(
    get_old_ClassDeclaration_ConsensusQueue());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "ClassDeclaration_ConsensusQueue": {"backCompat": false}
*/
declare function get_current_ClassDeclaration_ConsensusQueue():
    TypeOnly<current.ConsensusQueue>;
declare function use_old_ClassDeclaration_ConsensusQueue(
    use: TypeOnly<old.ConsensusQueue>);
use_old_ClassDeclaration_ConsensusQueue(
    get_current_ClassDeclaration_ConsensusQueue());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "EnumDeclaration_ConsensusResult": {"forwardCompat": false}
*/
declare function get_old_EnumDeclaration_ConsensusResult():
    TypeOnly<old.ConsensusResult>;
declare function use_current_EnumDeclaration_ConsensusResult(
    use: TypeOnly<current.ConsensusResult>);
use_current_EnumDeclaration_ConsensusResult(
    get_old_EnumDeclaration_ConsensusResult());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "EnumDeclaration_ConsensusResult": {"backCompat": false}
*/
declare function get_current_EnumDeclaration_ConsensusResult():
    TypeOnly<current.ConsensusResult>;
declare function use_old_EnumDeclaration_ConsensusResult(
    use: TypeOnly<old.ConsensusResult>);
use_old_EnumDeclaration_ConsensusResult(
    get_current_EnumDeclaration_ConsensusResult());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IConsensusOrderedCollection": {"forwardCompat": false}
*/
declare function get_old_InterfaceDeclaration_IConsensusOrderedCollection():
    TypeOnly<old.IConsensusOrderedCollection>;
declare function use_current_InterfaceDeclaration_IConsensusOrderedCollection(
    use: TypeOnly<current.IConsensusOrderedCollection>);
use_current_InterfaceDeclaration_IConsensusOrderedCollection(
    get_old_InterfaceDeclaration_IConsensusOrderedCollection());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IConsensusOrderedCollection": {"backCompat": false}
*/
declare function get_current_InterfaceDeclaration_IConsensusOrderedCollection():
    TypeOnly<current.IConsensusOrderedCollection>;
declare function use_old_InterfaceDeclaration_IConsensusOrderedCollection(
    use: TypeOnly<old.IConsensusOrderedCollection>);
use_old_InterfaceDeclaration_IConsensusOrderedCollection(
    get_current_InterfaceDeclaration_IConsensusOrderedCollection());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IConsensusOrderedCollectionEvents": {"forwardCompat": false}
*/
declare function get_old_InterfaceDeclaration_IConsensusOrderedCollectionEvents():
    TypeOnly<old.IConsensusOrderedCollectionEvents<any>>;
declare function use_current_InterfaceDeclaration_IConsensusOrderedCollectionEvents(
    use: TypeOnly<current.IConsensusOrderedCollectionEvents<any>>);
use_current_InterfaceDeclaration_IConsensusOrderedCollectionEvents(
    get_old_InterfaceDeclaration_IConsensusOrderedCollectionEvents());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IConsensusOrderedCollectionEvents": {"backCompat": false}
*/
declare function get_current_InterfaceDeclaration_IConsensusOrderedCollectionEvents():
    TypeOnly<current.IConsensusOrderedCollectionEvents<any>>;
declare function use_old_InterfaceDeclaration_IConsensusOrderedCollectionEvents(
    use: TypeOnly<old.IConsensusOrderedCollectionEvents<any>>);
use_old_InterfaceDeclaration_IConsensusOrderedCollectionEvents(
    get_current_InterfaceDeclaration_IConsensusOrderedCollectionEvents());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IConsensusOrderedCollectionFactory": {"forwardCompat": false}
*/
declare function get_old_InterfaceDeclaration_IConsensusOrderedCollectionFactory():
    TypeOnly<old.IConsensusOrderedCollectionFactory>;
declare function use_current_InterfaceDeclaration_IConsensusOrderedCollectionFactory(
    use: TypeOnly<current.IConsensusOrderedCollectionFactory>);
use_current_InterfaceDeclaration_IConsensusOrderedCollectionFactory(
    get_old_InterfaceDeclaration_IConsensusOrderedCollectionFactory());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IConsensusOrderedCollectionFactory": {"backCompat": false}
*/
declare function get_current_InterfaceDeclaration_IConsensusOrderedCollectionFactory():
    TypeOnly<current.IConsensusOrderedCollectionFactory>;
declare function use_old_InterfaceDeclaration_IConsensusOrderedCollectionFactory(
    use: TypeOnly<old.IConsensusOrderedCollectionFactory>);
use_old_InterfaceDeclaration_IConsensusOrderedCollectionFactory(
    get_current_InterfaceDeclaration_IConsensusOrderedCollectionFactory());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IOrderedCollection": {"forwardCompat": false}
*/
declare function get_old_InterfaceDeclaration_IOrderedCollection():
    TypeOnly<old.IOrderedCollection>;
declare function use_current_InterfaceDeclaration_IOrderedCollection(
    use: TypeOnly<current.IOrderedCollection>);
use_current_InterfaceDeclaration_IOrderedCollection(
    get_old_InterfaceDeclaration_IOrderedCollection());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IOrderedCollection": {"backCompat": false}
*/
declare function get_current_InterfaceDeclaration_IOrderedCollection():
    TypeOnly<current.IOrderedCollection>;
declare function use_old_InterfaceDeclaration_IOrderedCollection(
    use: TypeOnly<old.IOrderedCollection>);
use_old_InterfaceDeclaration_IOrderedCollection(
    get_current_InterfaceDeclaration_IOrderedCollection());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_ISnapshotable": {"forwardCompat": false}
*/
declare function get_old_InterfaceDeclaration_ISnapshotable():
    TypeOnly<old.ISnapshotable<any>>;
declare function use_current_InterfaceDeclaration_ISnapshotable(
    use: TypeOnly<current.ISnapshotable<any>>);
use_current_InterfaceDeclaration_ISnapshotable(
    get_old_InterfaceDeclaration_ISnapshotable());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_ISnapshotable": {"backCompat": false}
*/
declare function get_current_InterfaceDeclaration_ISnapshotable():
    TypeOnly<current.ISnapshotable<any>>;
declare function use_old_InterfaceDeclaration_ISnapshotable(
    use: TypeOnly<old.ISnapshotable<any>>);
use_old_InterfaceDeclaration_ISnapshotable(
    get_current_InterfaceDeclaration_ISnapshotable());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "FunctionDeclaration_acquireAndComplete": {"forwardCompat": false}
*/
declare function get_old_FunctionDeclaration_acquireAndComplete():
    TypeOnly<typeof old.acquireAndComplete>;
declare function use_current_FunctionDeclaration_acquireAndComplete(
    use: TypeOnly<typeof current.acquireAndComplete>);
use_current_FunctionDeclaration_acquireAndComplete(
    get_old_FunctionDeclaration_acquireAndComplete());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "FunctionDeclaration_acquireAndComplete": {"backCompat": false}
*/
declare function get_current_FunctionDeclaration_acquireAndComplete():
    TypeOnly<typeof current.acquireAndComplete>;
declare function use_old_FunctionDeclaration_acquireAndComplete(
    use: TypeOnly<typeof old.acquireAndComplete>);
use_old_FunctionDeclaration_acquireAndComplete(
    get_current_FunctionDeclaration_acquireAndComplete());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "FunctionDeclaration_waitAcquireAndComplete": {"forwardCompat": false}
*/
declare function get_old_FunctionDeclaration_waitAcquireAndComplete():
    TypeOnly<typeof old.waitAcquireAndComplete>;
declare function use_current_FunctionDeclaration_waitAcquireAndComplete(
    use: TypeOnly<typeof current.waitAcquireAndComplete>);
use_current_FunctionDeclaration_waitAcquireAndComplete(
    get_old_FunctionDeclaration_waitAcquireAndComplete());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "FunctionDeclaration_waitAcquireAndComplete": {"backCompat": false}
*/
declare function get_current_FunctionDeclaration_waitAcquireAndComplete():
    TypeOnly<typeof current.waitAcquireAndComplete>;
declare function use_old_FunctionDeclaration_waitAcquireAndComplete(
    use: TypeOnly<typeof old.waitAcquireAndComplete>);
use_old_FunctionDeclaration_waitAcquireAndComplete(
    get_current_FunctionDeclaration_waitAcquireAndComplete());
