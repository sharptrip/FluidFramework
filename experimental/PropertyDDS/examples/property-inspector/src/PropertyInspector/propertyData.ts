/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import _ from "lodash";

import { getDefaultObjectFromContainer } from "@fluidframework/aqueduct";
import { getTinyliciousContainer } from "@fluid-experimental/get-container";
import { PropertyFactory } from "@fluid-experimental/property-properties";
import { registerSchemas } from "@fluid-experimental/schemas";

import { PropertyProxy } from "@fluid-experimental/property-proxy";

import { DataBinder } from "@fluid-experimental/property-binder";

import { IPropertyTree } from "../dataObject";
import { PropertyTreeContainerRuntimeFactory as ContainerFactory } from "../containerCode";

export const loadPropertyDDS = async (props: any) => {
    // Register all schemas.
    // It's important to register schemas before loading an existing document
    // in order to process the changeset.
    registerSchemas(PropertyFactory);

    const { documentId, shouldCreateNew, render } = props;

    // The getTinyliciousContainer helper function facilitates loading our container code into a Container and
    // connecting to a locally-running test service called Tinylicious.  This will look different when moving to a
    // production service, but ultimately we'll still be getting a reference to a Container object.  The helper
    // function takes the ID of the document we're creating or loading, the container code to load into it, and a
    // flag to specify whether we're creating a new document or loading an existing one.
    const [container, containerId] = await getTinyliciousContainer(documentId, ContainerFactory, shouldCreateNew);

    // update the browser URL and the window title with the actual container ID
    location.hash = containerId;
    document.title = containerId;

    const propertyTree: IPropertyTree = await getDefaultObjectFromContainer<IPropertyTree>(container);

    const dataBinder = new DataBinder();

    dataBinder.attachTo(propertyTree.tree);

	// Create an ES6 proxy for the DDS, this enables JS object interface for interacting with the DDS.
	// Note: This is what currently inspector table expect for "data" prop.
	const proxifiedDDS = PropertyProxy.proxify(propertyTree.tree.root);
    // Listening to any change the root path of the PropertyDDS, and rendering the latest state of the
    // inspector tree-table.
	dataBinder.registerOnPath("/", ["insert", "remove", "modify"], _.debounce(() => {
		render(proxifiedDDS);
	}, 20));
    return proxifiedDDS;
};
