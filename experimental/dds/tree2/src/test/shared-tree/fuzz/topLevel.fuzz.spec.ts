/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import { takeAsync } from "@fluid-internal/stochastic-test-utils";
import {
	DDSFuzzModel,
	createDDSFuzzSuite,
	DDSFuzzTestState,
	DDSFuzzSuiteOptions,
} from "@fluid-internal/test-dds-utils";
import { FlushMode } from "@fluidframework/runtime-definitions";
import { SharedTreeTestFactory, validateTreeConsistency } from "../../utils";
import { makeOpGenerator, EditGeneratorOpWeights } from "./fuzzEditGenerators";
import { fuzzReducer } from "./fuzzEditReducers";
import { failureDirectory, onCreate } from "./fuzzUtils";
import { Operation } from "./operationTypes";

const baseOptions: Partial<DDSFuzzSuiteOptions> = {
	numberOfClients: 3,
	clientJoinOptions: {
		maxNumberOfClients: 6,
		clientAddProbability: 0.1,
	},
	reconnectProbability: 0.5,
};

/**
 * Fuzz tests in this suite are meant to exercise as much of the SharedTree code as possible and do so in the most
 * production-like manner possible. For example, these fuzz tests should not utilize branching APIs to emulate
 * multiple clients working on the same document. Instead, they should use multiple SharedTree instances, tied together
 * by a sequencing service. The tests may still use branching APIs because that's part of the normal usage of
 * SharedTree, but not as way to avoid using multiple SharedTree instances.
 *
 * The fuzz tests should validate that the clients do not crash and that their document states do not diverge.
 * See the "Fuzz - Targeted" test suite for tests that validate more specific code paths or invariants.
 */
describe("Fuzz - Top-Level", () => {
	const runsPerBatch = 20;
	const opsPerRun = 20;
	// TODO: Enable other types of ops.
	const editGeneratorOpWeights: Partial<EditGeneratorOpWeights> = {
		insert: 1,
	};
	const generatorFactory = () => takeAsync(opsPerRun, makeOpGenerator(editGeneratorOpWeights));
	/**
	 * This test suite is meant exercise all public APIs of SharedTree together, as well as all service-oriented
	 * operations (such as summarization and stashed ops).
	 */
	describe("Everything", () => {
		const model: DDSFuzzModel<
			SharedTreeTestFactory,
			Operation,
			DDSFuzzTestState<SharedTreeTestFactory>
		> = {
			workloadName: "SharedTree",
			factory: new SharedTreeTestFactory(onCreate),
			generatorFactory,
			reducer: fuzzReducer,
			validateConsistency: validateTreeConsistency,
		};
		const options: Partial<DDSFuzzSuiteOptions> = {
			...baseOptions,
			defaultTestCount: runsPerBatch,
			saveFailures: {
				directory: failureDirectory,
			},
			detachedStartOptions: {
				enabled: false,
				attachProbability: 0.2,
			},
			clientJoinOptions: {
				clientAddProbability: 0,
				maxNumberOfClients: 3,
			},
			reconnectProbability: 0,
			skipMinimization: true,
			// These seeds trigger 0x370 and 0x405 relatively frequently.
			// See the test case "can rebase over successive sets" for a minimized version of 0x370.
			// Both issues are likely related to current optional field rebasing semantics, and it may be possible to re-enable
			// these seeds once optional field supports storing changes to transient nodes.
			skip: [6, 10, 12, 14, 15, 17, 18, 19],
		};
		createDDSFuzzSuite(model, options);
	});

	describe("Batch rebasing", () => {
		const model: DDSFuzzModel<
			SharedTreeTestFactory,
			Operation,
			DDSFuzzTestState<SharedTreeTestFactory>
		> = {
			workloadName: "SharedTree rebasing",
			factory: new SharedTreeTestFactory(onCreate),
			generatorFactory,
			reducer: fuzzReducer,
			validateConsistency: validateTreeConsistency,
		};
		const options: Partial<DDSFuzzSuiteOptions> = {
			...baseOptions,
			reconnectProbability: 0.0,
			defaultTestCount: runsPerBatch,
			rebaseProbability: 0.2,
			containerRuntimeOptions: {
				flushMode: FlushMode.TurnBased,
				enableGroupedBatching: true,
			},
			saveFailures: {
				directory: failureDirectory,
			},
			// These seeds trigger 0x370 and 0x405 relatively frequently.
			// See the test case "can rebase over successive sets" for a minimized version of 0x370.
			// Both issues are likely related to current optional field rebasing semantics, and it may be possible to re-enable
			// these seeds once optional field supports storing changes to transient nodes.
			skip: [2, 3, 6, 12, 14, 15, 16],
		};
		createDDSFuzzSuite(model, options);
	});
});
