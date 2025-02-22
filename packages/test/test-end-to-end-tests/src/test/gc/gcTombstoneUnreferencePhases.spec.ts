/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { requestFluidObject } from "@fluidframework/runtime-utils";
import {
	createSummarizer,
	ITestContainerConfig,
	ITestObjectProvider,
	mockConfigProvider,
	summarizeNow,
	waitForContainerConnection,
} from "@fluidframework/test-utils";
import {
	describeNoCompat,
	ITestDataObject,
	TestDataObjectType,
} from "@fluid-internal/test-version-utils";
import { IGCRuntimeOptions } from "@fluidframework/container-runtime";
import { stringToBuffer } from "@fluid-internal/client-utils";
import { delay } from "@fluidframework/core-utils";
import { gcTreeKey } from "@fluidframework/runtime-definitions";
import { SummaryType } from "@fluidframework/protocol-definitions";
import { getGCStateFromSummary, getGCTombstoneStateFromSummary } from "./gcTestSummaryUtils.js";

/**
 * Validates that an unreferenced datastore and blob goes through all the GC phases without overlapping.
 */
describeNoCompat("GC unreference phases", (getTestObjectProvider) => {
	const inactiveTimeoutMs = 100;
	const sweepTimeoutMs = 200;

	const settings = {};
	const gcOptions: IGCRuntimeOptions = { inactiveTimeoutMs };
	const testContainerConfig: ITestContainerConfig = {
		runtimeOptions: {
			summaryOptions: {
				summaryConfigOverrides: {
					state: "disabled",
				},
			},
			gcOptions,
		},
		loaderProps: { configProvider: mockConfigProvider(settings) },
	};

	let provider: ITestObjectProvider;

	beforeEach(async function () {
		provider = getTestObjectProvider({ syncSummarizer: true });
		// These tests validate the GC state in summary generated by the container runtime. They do not care
		// about the snapshot that is downloaded from the server. So, it doesn't need to run against real services.
		if (provider.driver.type !== "local") {
			this.skip();
		}

		settings["Fluid.GarbageCollection.ThrowOnTombstoneUsage"] = true;
		settings["Fluid.GarbageCollection.TestOverride.SweepTimeoutMs"] = sweepTimeoutMs;
	});

	it("GC nodes go from referenced to unreferenced to inactive to sweep ready to tombstone", async () => {
		const mainContainer = await provider.makeTestContainer(testContainerConfig);
		const mainDataStore = await requestFluidObject<ITestDataObject>(mainContainer, "default");
		await waitForContainerConnection(mainContainer);

		const { summarizer } = await createSummarizer(provider, mainContainer, {
			runtimeOptions: { gcOptions },
			loaderProps: { configProvider: mockConfigProvider(settings) },
		});

		// create datastore and blob
		const dataStore =
			await mainDataStore._context.containerRuntime.createDataStore(TestDataObjectType);
		const dataStoreHandle = dataStore.entryPoint;
		assert(dataStoreHandle !== undefined, "Expected a handle when creating a datastore");
		const blobContents = "Blob contents";
		const blobHandle = await mainDataStore._runtime.uploadBlob(
			stringToBuffer(blobContents, "utf-8"),
		);

		// store datastore and blob handles
		mainDataStore._root.set("dataStore", dataStoreHandle);
		mainDataStore._root.set("blob", blobHandle);

		// unreference datastore and blob handles
		mainDataStore._root.delete("dataStore");
		mainDataStore._root.delete("blob");

		// Summarize and verify datastore and blob are unreferenced and not tombstoned
		await provider.ensureSynchronized();
		let summaryTree = (await summarizeNow(summarizer)).summaryTree;
		const gcState = getGCStateFromSummary(summaryTree);
		assert(gcState !== undefined, "Expected GC state to be generated");
		assert(
			gcState.gcNodes[dataStoreHandle.absolutePath] !== undefined,
			"Datastore should exist on gc graph",
		);
		assert(
			gcState.gcNodes[dataStoreHandle.absolutePath].unreferencedTimestampMs !== undefined,
			"Datastore should be unreferenced",
		);
		assert(
			gcState.gcNodes[blobHandle.absolutePath] !== undefined,
			"Blob should exist on gc graph",
		);
		assert(
			gcState.gcNodes[blobHandle.absolutePath].unreferencedTimestampMs !== undefined,
			"Blob should be unreferenced",
		);
		let tombstoneState = getGCTombstoneStateFromSummary(summaryTree);
		assert(tombstoneState === undefined, "Nothing should be tombstoned");

		// Wait inactive timeout
		await delay(inactiveTimeoutMs);
		// Summarize and verify datastore and blob are unreferenced and not tombstoned
		// Functionally being inactive should have no effect on datastores
		mainDataStore._root.set("send", "op");
		await provider.ensureSynchronized();
		summaryTree = (await summarizeNow(summarizer)).summaryTree;
		// GC state is a handle meaning it is the same as before, meaning nothing is tombstoned.
		assert(
			summaryTree.tree[gcTreeKey].type === SummaryType.Handle,
			"GC tree should not have changed",
		);

		// Wait sweep timeout
		await delay(sweepTimeoutMs);
		mainDataStore._root.set("send", "op2");
		await provider.ensureSynchronized();
		summaryTree = (await summarizeNow(summarizer)).summaryTree;
		const rootGCTree = summaryTree.tree[gcTreeKey];
		assert(rootGCTree?.type === SummaryType.Tree, `GC data should be a tree`);
		tombstoneState = getGCTombstoneStateFromSummary(summaryTree);
		// After sweep timeout the datastore and blob should be tombstoned.
		assert(tombstoneState !== undefined, "Should have tombstone state");
		assert(
			tombstoneState.includes(dataStoreHandle.absolutePath),
			"Datastore should be tombstoned",
		);
		assert(tombstoneState.includes(blobHandle.absolutePath), "Blob should be tombstoned");
	});
});
