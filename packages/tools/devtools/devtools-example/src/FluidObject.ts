/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import { DataObject, DataObjectFactory } from "@fluidframework/aqueduct";
import { type IFluidHandle, type IFluidLoadable } from "@fluidframework/core-interfaces";
import { SharedCounter } from "@fluidframework/counter";
import { SharedString } from "@fluidframework/sequence";
import { SharedCell } from "@fluidframework/cell";
import { SharedMatrix } from "@fluidframework/matrix";
import { type SharedObjectClass } from "@fluidframework/fluid-static";
import {
	AllowedUpdateType,
	type ISharedTree,
	SchemaBuilder,
	SharedTreeFactory,
	valueSymbol,
	typeNameSymbol,
	leaf,
} from "@fluid-experimental/tree2";
import { type IFluidDataStoreRuntime } from "@fluidframework/datastore-definitions";
/**
 * AppData uses the React CollaborativeTextArea to load a collaborative HTML <textarea>
 */
export class AppData extends DataObject {
	/**
	 * Key in the app's `rootMap` under which the SharedString object is stored.
	 */
	private readonly sharedTextKey = "shared-text";

	/**
	 * Key in the app's `rootMap` under which the SharedCounter object is stored.
	 */
	private readonly sharedCounterKey = "shared-counter";

	/**
	 * Key in the app's `rootMap` under which the SharedCell object is stored.
	 */
	private readonly emojiMatrixKey = "emoji-matrix";

	/**
	 * Key in the app's `rootMap` under which the SharedTree object is stored.
	 */
	private readonly sharedTreeKey = "shared-tree";

	/**
	 * Key in the app's `rootMap` under which the SharedDirectory object is stored.
	 */
	private readonly initialObjectsDirKey = "rootMap";

	// previous app's `rootMap`
	private readonly _initialObjects: Record<string, IFluidLoadable> = {};
	private _sharedTree: ISharedTree | undefined;
	private _text: SharedString | undefined;
	private _counter: SharedCounter | undefined;
	private _emojiMatrix: SharedMatrix | undefined;

	public get text(): SharedString {
		if (this._text === undefined) {
			throw new Error("The SharedString was not initialized correctly");
		}
		return this._text;
	}

	public get counter(): SharedCounter {
		if (this._counter === undefined) {
			throw new Error("The SharedCounter was not initialized correctly");
		}
		return this._counter;
	}

	public get emojiMatrix(): SharedMatrix {
		if (this._emojiMatrix === undefined) {
			throw new Error("The SharedMatrix was not initialized correctly");
		}
		return this._emojiMatrix;
	}

	public get sharedTree(): ISharedTree {
		if (this._sharedTree === undefined) {
			throw new Error("The SharedTree was not initialized correctly");
		}
		return this._sharedTree;
	}

	public getRootObject(): Record<string, IFluidLoadable> {
		return this._initialObjects;
	}

	public static readonly Name = "@devtools-example/test-app";

	private static readonly factory = new DataObjectFactory(
		AppData.Name,
		AppData,
		[
			SharedString.getFactory(),
			SharedCounter.getFactory(),
			SharedMatrix.getFactory(),
			SharedCell.getFactory(),
			new SharedTreeFactory(),
		],
		{},
	);

	public static getFactory(): DataObjectFactory<AppData> {
		return this.factory;
	}

	protected async initializingFirstTime(): Promise<void> {
		// Create the shared objects and store their handles in the root SharedDirectory
		const text = SharedString.create(this.runtime, this.sharedTextKey);
		const counter = SharedCounter.create(this.runtime, this.sharedCounterKey);
		const sharedTree = this.generateSharedTree(this.runtime);

		const emojiMatrix = SharedMatrix.create(this.runtime, this.emojiMatrixKey);
		const matrixDimension = 2; // Height and Width
		emojiMatrix.insertRows(0, matrixDimension);
		emojiMatrix.insertCols(0, matrixDimension);
		for (let row = 0; row < matrixDimension; row++) {
			for (let col = 0; col < matrixDimension; col++) {
				const emojiCell = SharedCell.create(this.runtime);
				emojiMatrix.setCell(row, col, emojiCell.handle);
			}
		}

		this.root.createSubDirectory(this.initialObjectsDirKey);
		this.root.set(this.sharedTextKey, text.handle);
		this.root.set(this.sharedCounterKey, counter.handle);
		this.root.set(this.emojiMatrixKey, emojiMatrix.handle);
		this.root.set(this.sharedTreeKey, sharedTree.handle);

		// Also set a couple of primitives for testing the debug view
		this.root.set("numeric-value", 42);
		this.root.set("string-value", "Hello world!");
		this.root.set("record-value", {
			aNumber: 37,
			aString: "Here is some text content.",
			anObject: {
				a: "a",
				b: "b",
			},
		});

		this._initialObjects[this.initialObjectsDirKey] = this.root.IFluidLoadable;
	}

	protected async hasInitialized(): Promise<void> {
		// Store the objects if we are loading the first time or loading from existing
		this._text = await this.root.get<IFluidHandle<SharedString>>(this.sharedTextKey)?.get();
		this._counter = await this.root
			.get<IFluidHandle<SharedCounter>>(this.sharedCounterKey)
			?.get();
		this._emojiMatrix = await this.root
			.get<IFluidHandle<SharedMatrix>>(this.emojiMatrixKey)
			?.get();
		const sharedTree = await this.root
			.get<IFluidHandle<ISharedTree>>(this.sharedTreeKey)
			?.get();
		if (sharedTree === undefined) {
			throw new Error("SharedTree was not initialized");
		} else {
			this.populateSharedTree(sharedTree);
			this._sharedTree = sharedTree;

			// We will always load the initial objects so they are available to the developer
			const loadInitialObjectsP: Promise<void>[] = [];
			const dir = this.root.getSubDirectory(this.initialObjectsDirKey);
			if (dir === undefined) {
				throw new Error("InitialObjects sub-directory was not initialized");
			}

			for (const [key, value] of dir.entries()) {
				// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
				const loadDir = async () => {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
					const obj = await value.get();
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					Object.assign(this._initialObjects, { [key]: obj });
				};
				loadInitialObjectsP.push(loadDir());
			}

			await Promise.all(loadInitialObjectsP);
		}
	}

	/**
	 * Function to create an instance which contains getFactory method returning SharedTreeFactory.
	 * The example application calls container.create() to create a new DDS, and the method requires:
	 * #1. static factory method
	 * #2. class object with a constructor returning a type with a handle field
	 *
	 * The function below satisfies the requirements to populate the SharedTree within the application.
	 */
	private castSharedTreeType(): SharedObjectClass<ISharedTree> {
		/**
		 * SharedTree class object containing static factory method used for {@link @fluidframework/fluid-static#IFluidContainer}.
		 */
		// eslint-disable-next-line @typescript-eslint/no-extraneous-class
		class SharedTree {
			public static getFactory(): SharedTreeFactory {
				return new SharedTreeFactory();
			}
		}

		return SharedTree as unknown as SharedObjectClass<ISharedTree>;
	}

	private generateSharedTree(runtime: IFluidDataStoreRuntime): ISharedTree {
		const sharedTreeObject = this.castSharedTreeType();

		const factory = sharedTreeObject.getFactory();
		return runtime.createChannel(undefined, factory.type) as ISharedTree;
	}

	private populateSharedTree(sharedTree: ISharedTree): void {
		// Set up SharedTree for visualization
		const builder = new SchemaBuilder({
			scope: "DefaultVisualizer_SharedTree_Test",
			libraries: [leaf.library],
		});

		// TODO: Maybe include example handle

		const leafSchema = builder.object("leaf-item", {
			leafField: [leaf.boolean, leaf.handle, leaf.string],
		});

		const childSchema = builder.object("child-item", {
			childField: [leaf.string, leaf.boolean],
			childData: builder.optional(leafSchema),
		});

		const rootNodeSchema = builder.object("root-item", {
			childrenOne: builder.sequence(childSchema),
			childrenTwo: leaf.number,
		});

		const schema = builder.intoSchema(rootNodeSchema);

		sharedTree.schematize({
			schema,
			allowedSchemaModifications: AllowedUpdateType.None,
			initialTree: {
				childrenOne: [
					{
						childField: "Hello world!",
						childData: {
							leafField: {
								[typeNameSymbol]: leaf.string.name,
								[valueSymbol]: "Hello world again!",
							},
						},
					},
					{
						childField: true,
						childData: {
							leafField: {
								[typeNameSymbol]: leaf.boolean.name,
								[valueSymbol]: false,
							},
						},
					},
				],
				childrenTwo: 32,
			},
		});
	}
}
