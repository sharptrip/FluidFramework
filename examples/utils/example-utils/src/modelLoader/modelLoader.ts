/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import {
	LoaderHeader,
	type IContainer,
	type IHostLoader,
} from "@fluidframework/container-definitions";
import { ILoaderProps, Loader } from "@fluidframework/container-loader";
import type { IContainerRuntime } from "@fluidframework/container-runtime-definitions";
import type { IRequest, IResponse } from "@fluidframework/core-interfaces";
// eslint-disable-next-line import/no-deprecated
import { create404Response, requestFluidObject } from "@fluidframework/runtime-utils";
import type { IDetachedModel, IModelLoader, ModelMakerCallback } from "./interfaces";

// This ModelLoader works on a convention, that the container it will load a model for must respond to a specific
// request format with the model object.  Here we export a helper function for those container authors to align to
// that contract -- the container author provides a ModelMakerCallback that will produce the model given a container
// runtime and container, and this helper will appropriately translate to/from the request/response format.

const modelUrl = "model";

interface IModelRequest extends IRequest {
	url: typeof modelUrl;
	headers: {
		containerRef: IContainer;
	};
}

const isModelRequest = (request: IRequest): request is IModelRequest =>
	request.url === modelUrl && request.headers?.containerRef !== undefined;

/**
 * A helper function for container authors, which generates the request handler they need to align with the
 * ModelLoader contract.
 * @param modelMakerCallback - A callback that will produce the model for the container
 * @returns A request handler that can be provided to the container runtime factory
 * @deprecated Will be removed in future major release. Migrate all usage of IFluidRouter to the "entryPoint" pattern. Refer to Removing-IFluidRouter.md
 */
export const makeModelRequestHandler = <ModelType>(
	modelMakerCallback: ModelMakerCallback<ModelType>,
) => {
	return async (request: IRequest, runtime: IContainerRuntime): Promise<IResponse> => {
		// The model request format is for an empty path (i.e. "") and passing a reference to the container in the
		// header as containerRef.
		if (isModelRequest(request)) {
			const container: IContainer = request.headers.containerRef;
			const model = await modelMakerCallback(runtime, container);
			return { status: 200, mimeType: "fluid/object", value: model };
		}
		return create404Response(request);
	};
};

export class ModelLoader<ModelType> implements IModelLoader<ModelType> {
	private readonly loader: IHostLoader;
	private readonly generateCreateNewRequest: () => IRequest;

	// TODO: See if there's a nicer way to parameterize the createNew request.
	// Here we specifically pick just the loader props we know we need to keep API exposure low.  Fine to add more
	// here if we determine they're needed, but they should be picked explicitly (e.g. avoid "scope").
	public constructor(
		props: Pick<
			ILoaderProps,
			"urlResolver" | "documentServiceFactory" | "codeLoader" | "logger"
		> & {
			generateCreateNewRequest: () => IRequest;
		},
	) {
		this.loader = new Loader({
			urlResolver: props.urlResolver,
			documentServiceFactory: props.documentServiceFactory,
			codeLoader: props.codeLoader,
			logger: props.logger,
		});
		this.generateCreateNewRequest = props.generateCreateNewRequest;
	}

	public async supportsVersion(version: string): Promise<boolean> {
		// To answer the question of whether we support a given version, we would need to query the codeLoader
		// to see if it thinks it can load the requested version.  But for now, ICodeDetailsLoader doesn't have
		// a supports() method.  We could attempt a load and catch the error, but it might not be desirable to
		// load code just to check.  It might be desirable to add a supports() method to ICodeDetailsLoader.
		return true;
	}

	/**
	 * The purpose of the model pattern and the model loader is to wrap the IContainer in a more useful object and
	 * interface.  This demo uses a convention of requesting the default path and passing the container reference
	 * in the request header.  It does this with the expectation that the model has been bundled with the container
	 * code along with a request handler that will recognize this request format and return the model.
	 * makeModelRequestHandler is provide to create exactly that request handler that the container author needs.
	 *
	 * Other strategies to obtain the wrapping model could also work fine here - for example a standalone model code
	 * loader that separately fetches model code and wraps the container from the outside.
	 */
	private async getModelFromContainer(container: IContainer) {
		const request: IModelRequest = {
			url: modelUrl,
			headers: { containerRef: container },
		};
		// eslint-disable-next-line import/no-deprecated
		return requestFluidObject<ModelType>(container, request);
	}

	// It would be preferable for attaching to look more like service.attach(model) rather than returning an attach
	// callback here, but this callback at least allows us to keep the method off the model interface.
	public async createDetached(version: string): Promise<IDetachedModel<ModelType>> {
		const container = await this.loader.createDetachedContainer({ package: version });
		const model = await this.getModelFromContainer(container);
		// The attach callback lets us defer the attach so the caller can do whatever initialization pre-attach,
		// without leaking out the loader, service, etc.  We also return the container ID here so we don't have
		// to stamp it on something that would rather not know it (e.g. the model).
		const attach = async () => {
			await container.attach(this.generateCreateNewRequest());
			if (container.resolvedUrl === undefined) {
				throw new Error("Resolved Url not available on attached container");
			}
			return container.resolvedUrl.id;
		};
		return { model, attach };
	}

	public async loadExisting(id: string): Promise<ModelType> {
		const container = await this.loader.resolve({
			url: id,
			headers: {
				[LoaderHeader.loadMode]: {
					// Here we use "all" to ensure we are caught up before returning.  This is particularly important
					// for direct-link scenarios, where the user might have a direct link to a data object that was
					// just attached (i.e. the "attach" op and the "set" of the handle into some map is in the
					// trailing ops).  If we don't fully process those ops, the expected object won't be found.
					opsBeforeReturn: "all",
				},
			},
		});
		const model = await this.getModelFromContainer(container);
		return model;
	}

	public async loadExistingPaused(id: string, sequenceNumber: number): Promise<ModelType> {
		const container = await this.loader.resolve({
			url: id,
			headers: {
				[LoaderHeader.loadMode]: {
					opsBeforeReturn: "sequenceNumber",
					pauseAfterLoad: true,
				},
				[LoaderHeader.sequenceNumber]: sequenceNumber,
			},
		});
		const model = await this.getModelFromContainer(container);
		return model;
	}
}
