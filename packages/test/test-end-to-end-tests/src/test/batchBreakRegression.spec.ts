/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/* eslint-disable @typescript-eslint/no-unsafe-return */
import { strict as assert } from "assert";
import {
	IDocumentDeltaConnectionEvents,
	IDocumentServiceFactory,
} from "@fluidframework/driver-definitions";
import { requestFluidObject } from "@fluidframework/runtime-utils";
import { ITestObjectProvider, TestFluidObject, timeoutPromise } from "@fluidframework/test-utils";
import { describeNoCompat, itExpects } from "@fluid-internal/test-version-utils";
import { isFluidError, isILoggingError } from "@fluidframework/telemetry-utils";
import { TypedEventEmitter } from "@fluid-internal/client-utils";
import {
	IDocumentMessage,
	ISequencedDocumentMessage,
	ISequencedDocumentSystemMessage,
} from "@fluidframework/protocol-definitions";
import { IContainerRuntimeOptions } from "@fluidframework/container-runtime";
import { FluidErrorTypes } from "@fluidframework/core-interfaces";

/**
 * In all cases we end up with a permanently corrupt file.
 * These tests were added because in many of these cases
 * we didn't even error out properly. Even with some of
 * the error handling improvements the errors in
 * most cases are not are not obvious as to why those
 * specific error happen.
 *
 * In general batching
 * needs improvement such that we can avoid permanent
 * data corruption in most these cases.
 */

type UnPromise<T> = T extends Promise<infer U> ? U : T;

type OverrideFunction<T, P extends keyof T> = (T: T) => T[P];

type ProxyOverrides<T> = {
	[P in keyof T]?: T[P] extends (...args: any) => any
		? ProxyOverrides<UnPromise<ReturnType<T[P]>>> | OverrideFunction<T, P>
		: OverrideFunction<T, P>;
};

function createFunctionOverrideProxy<T extends Record<string, any>>(
	obj: T,
	overrides: ProxyOverrides<T>,
): T {
	return new Proxy(obj, {
		get: (target: T, property: string) => {
			const override = overrides[property as keyof T];
			if (override) {
				if (typeof override === "function") {
					return override(target);
				}
				const real = target[property as keyof T];
				if (typeof real === "function") {
					return (...args: any) => {
						const res = real.bind(target)(...args);
						if (res.then !== undefined) {
							return res.then((v) => createFunctionOverrideProxy(v, override));
						}

						return createFunctionOverrideProxy(res, override);
					};
				}

				return createFunctionOverrideProxy(real as any, override);
			}

			return target[property];
		},
	});
}

async function runAndValidateBatch(
	provider: ITestObjectProvider,
	proxyDsf: IDocumentServiceFactory,
	timeout: number,
	runtimeOptions?: IContainerRuntimeOptions,
) {
	let containerUrl: string | undefined;
	{
		const loader = provider.createLoader([
			[provider.defaultCodeDetails, provider.createFluidEntryPoint()],
		]);

		const container = await loader.createDetachedContainer(provider.defaultCodeDetails);
		await container.attach(provider.driver.createCreateNewRequest(Date.now().toString()));
		containerUrl = await container.getAbsoluteUrl("");
		container.close();
	}
	assert(containerUrl);
	{
		const loader = provider.createLoader(
			[
				[
					provider.defaultCodeDetails,
					provider.createFluidEntryPoint({
						runtimeOptions: {
							summaryOptions: {
								summaryConfigOverrides: { state: "disabled" },
							},
							...runtimeOptions,
						},
					}),
				],
			],
			{
				documentServiceFactory: proxyDsf,
			},
		);
		const container = await loader.resolve({ url: containerUrl });
		const testObject = await requestFluidObject<TestFluidObject>(container, "default");
		// send batch
		testObject.context.containerRuntime.orderSequentially(() => {
			for (let i = 0; i < 10; i++) {
				testObject.root.set(i.toString(), i);
			}
		});
		// send non-batch
		testObject.root.set("foo", "bar");
		while (container.isDirty && !container.closed) {
			await timeoutPromise(
				(resolve, reject) => {
					container.once("saved", () => resolve());
					container.once("closed", (e) => reject(e));
				},
				{
					durationMs: timeout, // 60 * 60 * 1000,
				},
			);
		}

		for (let i = 0; i < 10; i++) {
			assert.equal(testObject.root.get(i.toString()), i, i.toString());
		}
		assert.equal(testObject.root.get("foo"), "bar", "validate after batch op");
	}
}

describeNoCompat("Batching failures", (getTestObjectProvider) => {
	it("working proxy", async function () {
		const provider = getTestObjectProvider({ resetAfterEach: true });

		const proxyDsf = createFunctionOverrideProxy<IDocumentServiceFactory>(
			provider.documentServiceFactory,
			{
				createDocumentService: {
					connectToDeltaStream: {
						submit: (ds) => (messages) => {
							// validate a no-op proxy works
							ds.submit(messages);
						},
					},
				},
			},
		);
		await runAndValidateBatch(provider, proxyDsf, this.timeout());
	});

	it("working batch", async function () {
		const provider = getTestObjectProvider({ resetAfterEach: true });
		await runAndValidateBatch(provider, provider.documentServiceFactory, this.timeout());
	});

	[true, false].forEach((enableGroupedBatching) => {
		it(`contains batch metadata groupedBatchingEnabled: ${enableGroupedBatching}`, async function () {
			const provider = getTestObjectProvider({ resetAfterEach: true });
			let batchesSent = 0;
			const sentMessages: IDocumentMessage[][] = [];

			const proxyDsf = createFunctionOverrideProxy<IDocumentServiceFactory>(
				provider.documentServiceFactory,
				{
					createDocumentService: {
						connectToDeltaStream: {
							submit: (ds) => (messages) => {
								sentMessages.push([...messages]);
								batchesSent++;
								ds.submit(messages);
							},
						},
					},
				},
			);

			await runAndValidateBatch(provider, proxyDsf, this.timeout(), {
				enableGroupedBatching,
			});
			assert.strictEqual(batchesSent, 1, "expected only a single batch to be sent");

			{
				let batch = sentMessages[0];
				if (batch.length === 1) {
					const contents = JSON.parse(batch[0].contents as string);
					assert.strictEqual(contents.type, "groupedBatch");
					batch = contents.contents;
				}

				assert.strictEqual(batch.length, 11, "expected 11 messages");
				assert.strictEqual(
					(batch[0].metadata as { batch?: unknown } | undefined)?.batch,
					true,
					"first message should contain batch metadata",
				);
				assert.strictEqual(
					(batch[10].metadata as { batch?: unknown } | undefined)?.batch,
					false,
					"last message should contain batch metadata",
				);
			}
		});
	});

	describe("client sends invalid batches ", () => {
		itExpects.skip(
			"Batch end without start",
			[{ eventName: "fluid:telemetry:Container:ContainerClose", error: "OpBatchIncomplete" }],
			async function () {
				const provider = getTestObjectProvider({ resetAfterEach: true });

				const proxyDsf = createFunctionOverrideProxy<IDocumentServiceFactory>(
					provider.documentServiceFactory,
					{
						createDocumentService: {
							connectToDeltaStream: {
								submit: (ds) => (messages) => {
									const newMessages = [...messages];
									const batchStartIndex = newMessages.findIndex(
										(m) =>
											(m.metadata as { batch?: unknown } | undefined)
												?.batch === true,
									);
									if (batchStartIndex >= 0) {
										newMessages[batchStartIndex] = {
											...newMessages[batchStartIndex],
											metadata: {
												// TODO: It's not clear if this shallow clone is required, as opposed to just setting "batch" to undefined.
												// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
												...(newMessages[batchStartIndex].metadata as any),
												batch: undefined,
											},
										};
									}
									ds.submit(newMessages);
								},
							},
						},
					},
				);

				try {
					await runAndValidateBatch(provider, proxyDsf, this.timeout());
					assert.fail("expected error");
				} catch (e) {
					assert(isILoggingError(e), `${e}`);
					assert.equal(e.message, "OpBatchIncomplete", e);
				}
			},
		);

		// bug bug: container runtime never unpauses if there is no batch end
		itExpects.skip("Batch start without end", [], async function () {
			const provider = getTestObjectProvider({ resetAfterEach: true });

			const proxyDsf = createFunctionOverrideProxy<IDocumentServiceFactory>(
				provider.documentServiceFactory,
				{
					createDocumentService: {
						connectToDeltaStream: {
							submit: (ds) => (messages) => {
								const newMessages = [...messages];
								const batchEndIndex = newMessages.findIndex(
									(m) =>
										(m.metadata as { batch?: unknown } | undefined)?.batch ===
										false,
								);
								if (batchEndIndex >= 0) {
									newMessages[batchEndIndex] = {
										...newMessages[batchEndIndex],
										metadata: {
											// TODO: It's not clear if this shallow clone is required, as opposed to just setting "batch" to undefined.
											// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
											...(newMessages[batchEndIndex].metadata as any),
											batch: undefined,
										},
									};
								}
								ds.submit(newMessages);
							},
						},
					},
				},
			);
			try {
				await runAndValidateBatch(provider, proxyDsf, this.timeout());
				assert.fail("expected error");
			} catch (e) {
				assert(isILoggingError(e), `${e}`);
				assert.equal(e.message, "OpBatchIncomplete", e);
			}
		});

		itExpects("Split batch", [], async function () {
			const provider = getTestObjectProvider({ resetAfterEach: true });

			const proxyDsf = createFunctionOverrideProxy<IDocumentServiceFactory>(
				provider.documentServiceFactory,
				{
					createDocumentService: {
						connectToDeltaStream: {
							submit: (ds) => (messages) => {
								const newMessages = [...messages];
								const batchEndIndex = newMessages.findIndex(
									(m) =>
										(m.metadata as { batch?: unknown } | undefined)?.batch ===
										false,
								);
								if (batchEndIndex >= 1) {
									ds.submit(newMessages.slice(0, batchEndIndex - 1));
									ds.submit(newMessages.slice(batchEndIndex - 1));
								} else {
									ds.submit(newMessages);
								}
							},
						},
					},
				},
			);
			// it's odd this doesn't fail.
			await runAndValidateBatch(provider, proxyDsf, this.timeout());
		});

		itExpects.skip(
			"force nack",
			[
				{
					eventName: "fluid:telemetry:Container:ContainerClose",
					error: "Received a system message during batch processing",
				},
			],
			async function () {
				const provider = getTestObjectProvider({ resetAfterEach: true });

				const proxyDsf = createFunctionOverrideProxy<IDocumentServiceFactory>(
					provider.documentServiceFactory,
					{
						createDocumentService: {
							connectToDeltaStream: {
								submit: (ds) => (messages) => {
									const newMessages = [...messages];
									const batchEndIndex = newMessages.findIndex(
										(m) =>
											(m.metadata as { batch?: unknown } | undefined)
												?.batch === false,
									);
									if (batchEndIndex >= 1) {
										// set reference seq number to below min seq so the server nacks the batch
										newMessages[batchEndIndex] = {
											...newMessages[batchEndIndex],
											referenceSequenceNumber: -1,
										};
										ds.submit(newMessages);
									} else {
										ds.submit(newMessages);
									}
								},
							},
						},
					},
				);
				try {
					await runAndValidateBatch(provider, proxyDsf, this.timeout());
					assert.fail("expected error");
				} catch (e) {
					assert(isILoggingError(e), `${e}`);
					assert(isFluidError(e));
					assert.strictEqual(e.errorType, FluidErrorTypes.dataProcessingError);
				}
			},
		);
	});
	describe("server sends invalid batch", () => {
		// Batches are now all 1 message
		itExpects(
			"interleave system message",
			[
				{
					eventName: "fluid:telemetry:Container:ContainerClose",
					error: "Received a system message during batch processing",
				},
			],
			async function () {
				const provider = getTestObjectProvider({ resetAfterEach: true });

				const proxyDsf = createFunctionOverrideProxy<IDocumentServiceFactory>(
					provider.documentServiceFactory,
					{
						createDocumentService: {
							connectToDeltaStream: (docService) => async (client) => {
								const real = await docService.connectToDeltaStream(client);
								const emitter =
									real as any as TypedEventEmitter<IDocumentDeltaConnectionEvents>;
								const originalEmit = emitter.emit.bind(emitter);
								emitter.emit = (event, ...args) => {
									if (
										event === "op" &&
										Array.isArray(args) &&
										args.length >= 2 &&
										Array.isArray(args[1])
									) {
										// this code adds a join message in the middle of a batch
										const newMessages: (
											| ISequencedDocumentMessage
											| ISequencedDocumentSystemMessage
										)[] = [...args[1]];
										const batchEndIndex = newMessages.findIndex(
											(m) =>
												(m.metadata as { batch?: unknown } | undefined)
													?.batch === false,
										);
										if (batchEndIndex >= 0) {
											args[1] = newMessages
												.slice(0, batchEndIndex)
												.concat({
													...newMessages[batchEndIndex],
													metadata: undefined,
													clientId: null as any as string,
													clientSequenceNumber: -1,
													contents: null,
													referenceSequenceNumber: -1,
													type: "join",
													data: '{"clientId":"fake_client","detail":{"user":{"id":"fake_user"},"scopes":["doc:read","doc:write"],"permission":[],"details":{"capabilities":{"interactive":true}},"mode":"write"}}',
												})
												.concat(
													...newMessages
														.slice(batchEndIndex)
														.map((m) => ({
															...m,
															sequenceNumber: m.sequenceNumber + 1,
														})),
												);
										}
									}
									return originalEmit(event, ...args);
								};
								return real;
							},
						},
					},
				);
				try {
					await runAndValidateBatch(provider, proxyDsf, this.timeout(), {
						enableGroupedBatching: false,
					});
					assert.fail("expected error");
				} catch (e) {
					assert(isILoggingError(e), `${e}`);
					assert(isFluidError(e));
					assert(e.errorType === FluidErrorTypes.dataProcessingError);
				}
			},
		);
	});
});
