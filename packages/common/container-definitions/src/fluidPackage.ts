/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Specifies an environment on Fluid property of a IFluidPackage.
 * @public
 */
export interface IFluidPackageEnvironment {
	/**
	 * The name of the target. For a browser environment, this could be umd for scripts
	 * or css for styles.
	 */
	[target: string]:
		| undefined
		| {
				/**
				 * List of files for the target. These can be relative or absolute.
				 * The code loader should resolve relative paths, and validate all
				 * full urls.
				 */
				files: string[];

				/**
				 * General access for extended fields as specific usages will
				 * likely have additional infornamation like a definition
				 * of Library, the entrypoint for umd packages.
				 */
				[key: string]: unknown;
		  };
}

/**
 * Fluid-specific properties expected on a package to be loaded by the code loader.
 * While compatible with the npm package format it is not necessary that that package is an
 * npm package:
 * {@link https://stackoverflow.com/questions/10065564/add-custom-metadata-or-config-to-package-json-is-it-valid}
 * @public
 */
export interface IFluidPackage {
	/**
	 * The name of the package that this code represnets
	 */
	name: string;
	/**
	 * This object represents the Fluid specific properties of the package
	 */
	fluid: {
		/**
		 * The name of the of the environment. This should be something like browser, or node
		 * and contain the necessary targets for loading this code in that environment.
		 */
		[environment: string]: undefined | IFluidPackageEnvironment;
	};
	/**
	 * General access for extended fields as specific usages will
	 * likely have additional infornamation like a definition of
	 * compatible versions, or deployment information like rings or rollouts.
	 */
	[key: string]: unknown;
}

/**
 * Check if the package.json defines a Fluid package
 * @param pkg - the package json data to check if it is a Fluid package.
 * @public
 */
export const isFluidPackage = (pkg: unknown): pkg is Readonly<IFluidPackage> =>
	typeof pkg === "object" &&
	typeof (pkg as Partial<IFluidPackage>)?.name === "string" &&
	typeof (pkg as Partial<IFluidPackage>)?.fluid === "object";

/**
 * Package manager configuration. Provides a key value mapping of config values
 * @public
 */
export interface IFluidCodeDetailsConfig {
	readonly [key: string]: string;
}

/**
 * Data structure used to describe the code to load on the Fluid document
 * @public
 */
export interface IFluidCodeDetails {
	/**
	 * The code package to be used on the Fluid document. This is either the package name which will be loaded
	 * from a package manager. Or the expanded Fluid package.
	 */
	readonly package: string | Readonly<IFluidPackage>;

	/**
	 * Configuration details. This includes links to the package manager and base CDNs.
	 *
	 * @remarks This is strictly consumer-defined data.
	 * Its contents and semantics (including whether or not this data is present) are completely up to the consumer.
	 */
	readonly config?: IFluidCodeDetailsConfig;
}

/**
 * Determines if any object is an IFluidCodeDetails
 * @public
 */
export const isFluidCodeDetails = (details: unknown): details is Readonly<IFluidCodeDetails> => {
	const maybeCodeDetails = details as Partial<IFluidCodeDetails> | undefined;
	return (
		typeof maybeCodeDetails === "object" &&
		(typeof maybeCodeDetails?.package === "string" ||
			isFluidPackage(maybeCodeDetails?.package)) &&
		(maybeCodeDetails?.config === undefined || typeof maybeCodeDetails?.config === "object")
	);
};

/**
 * @public
 */
export const IFluidCodeDetailsComparer: keyof IProvideFluidCodeDetailsComparer =
	"IFluidCodeDetailsComparer";

/**
 * @public
 */
export interface IProvideFluidCodeDetailsComparer {
	readonly IFluidCodeDetailsComparer: IFluidCodeDetailsComparer;
}

/**
 * Provides capability to compare Fluid code details.
 * @public
 */
export interface IFluidCodeDetailsComparer extends IProvideFluidCodeDetailsComparer {
	/**
	 * Determines if the `candidate` code details satisfy the constraints specified in `constraint` code details.
	 *
	 * Similar semantics to:
	 * {@link https://github.com/npm/node-semver#usage}
	 */
	satisfies(candidate: IFluidCodeDetails, constraint: IFluidCodeDetails): Promise<boolean>;

	/**
	 * Return a number representing the ascending sort order of the `a` and `b` code details:
	 *
	 * - `< 0` if `a < b`.
	 *
	 * - `= 0` if `a === b`.
	 *
	 * - `> 0` if `a > b`.
	 *
	 * - `undefined` if `a` is not comparable to `b`.
	 *
	 * Similar semantics to:
	 * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort#description | Array.sort}
	 */
	compare(a: IFluidCodeDetails, b: IFluidCodeDetails): Promise<number | undefined>;
}
