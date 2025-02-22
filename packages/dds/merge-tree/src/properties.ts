/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { ICombiningOp } from "./ops";

export interface MapLike<T> {
	[index: string]: T;
}

// We use any because when you include custom methods
// such as toJSON(), JSON.stringify accepts most types other
// than functions
export type PropertySet = MapLike<any>;

// Assume these are created with Object.create(null)

export interface IConsensusValue {
	seq: number;
	value: any;
}

/**
 * @deprecated This functionality was not intended for public export and will
 * be removed in a future release.
 */
export function combine(
	combiningInfo: ICombiningOp,
	currentValue: any,
	newValue: any,
	seq?: number,
) {
	let _currentValue = currentValue;

	if (_currentValue === undefined) {
		_currentValue = combiningInfo.defaultValue;
	}
	// Fixed set of operations for now

	switch (combiningInfo.name) {
		case "incr":
			_currentValue += newValue as number;
			if (combiningInfo.minValue) {
				if (_currentValue < combiningInfo.minValue) {
					_currentValue = combiningInfo.minValue;
				}
			}
			break;
		case "consensus":
			if (_currentValue === undefined) {
				const cv: IConsensusValue = {
					value: newValue,
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					seq: seq!,
				};

				_currentValue = cv;
			} else {
				const cv = _currentValue as IConsensusValue;
				if (cv.seq === -1) {
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					cv.seq = seq!;
				}
			}
			break;
		default:
			break;
	}

	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return _currentValue;
}

/**
 * @deprecated This functionality was not intended for public export and will
 * be removed in a future release.
 */
export function matchProperties(a: PropertySet | undefined, b: PropertySet | undefined) {
	if (!a && !b) {
		return true;
	}

	const keysA = a ? Object.keys(a) : [];
	const keysB = b ? Object.keys(b) : [];

	if (keysA.length !== keysB.length) {
		return false;
	}

	for (const key of keysA) {
		if (b?.[key] === undefined) {
			return false;
		} else if (typeof b[key] === "object") {
			if (!matchProperties(a?.[key], b[key])) {
				return false;
			}
		} else if (b[key] !== a?.[key]) {
			return false;
		}
	}

	return true;
}

/**
 * @deprecated This functionality was not intended for public export and will
 * be removed in a future release.
 */
export function extend<T>(
	base: MapLike<T>,
	extension: MapLike<T> | undefined,
	combiningOp?: ICombiningOp,
	seq?: number,
) {
	if (extension !== undefined) {
		// eslint-disable-next-line guard-for-in, no-restricted-syntax
		for (const key in extension) {
			const v = extension[key];
			if (v === null) {
				// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
				delete base[key];
			} else {
				base[key] =
					combiningOp && combiningOp.name !== "rewrite"
						? combine(combiningOp, base[key], v, seq)
						: v;
			}
		}
	}
	return base;
}

/**
 * @deprecated This functionality was not intended for public export and will
 * be removed in a future release.
 */
export function clone<T>(extension: MapLike<T> | undefined) {
	if (extension === undefined) {
		return undefined;
	}
	const cloneMap = createMap<T>();
	// eslint-disable-next-line guard-for-in, no-restricted-syntax
	for (const key in extension) {
		const v = extension[key];
		if (v !== null) {
			cloneMap[key] = v;
		}
	}
	return cloneMap;
}

/**
 * @deprecated This functionality was not intended for public export and will
 * be removed in a future release.
 */
export function addProperties(
	oldProps: PropertySet | undefined,
	newProps: PropertySet,
	op?: ICombiningOp,
	seq?: number,
) {
	let _oldProps = oldProps;
	if (!_oldProps || (op && op.name === "rewrite")) {
		_oldProps = createMap<any>();
	}
	extend(_oldProps, newProps, op, seq);
	return _oldProps;
}

/**
 * @deprecated This functionality was not intended for public export and will
 * be removed in a future release.
 */
export function extendIfUndefined<T>(base: MapLike<T>, extension: MapLike<T> | undefined) {
	if (extension !== undefined) {
		// eslint-disable-next-line no-restricted-syntax
		for (const key in extension) {
			if (base[key] === undefined) {
				base[key] = extension[key];
			}
		}
	}
	return base;
}

/**
 * @deprecated This functionality was not intended for public export and will
 * be removed in a future release.
 */
// Create a MapLike with good performance.
export function createMap<T>(): MapLike<T> {
	return Object.create(null) as MapLike<T>;
}
