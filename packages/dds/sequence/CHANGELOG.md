# @fluidframework/sequence

## 2.0.0-internal.7.1.0

### Minor Changes

-   sequence: IntervalCollection.add's intervalType is now deprecated ([#17165](https://github.com/microsoft/FluidFramework/issues/17165)) [a8ea26c9d6](https://github.com/microsoft/FluidFramework/commits/a8ea26c9d61e4938f10c87a8757734f8772fbce6)

    The `intervalType` parameter is being removed from `IntervalCollection.add`. The new usage requires calling add with an object containing each of the desired parameters.
    Example: `add({start: 0, end: 1, props: { a: b }})`

    The signature of `IntervalCollection.change` is also being updated to an object containing the desired parameters,
    instead of the existing list of parameters. In addition, `changeProperties` will be removed, so in order to change the
    properties of an interval, the `change` method (with the updated signature) will be used. The id of the interval is not
    included in the object passed to `change`, but is instead passed as the first parameter to `change`.

    Examples:

    -   Change interval endpoints: `change(intervalId, { start: 3, end: 4 })`
    -   Change interval properties: `change(intervalId, { props: { a: c } })`

-   merge-tree: Deprecate IntervalType.Nest, internedSpaces, RangeStackMap, refGetRangeLabels, refHasRangeLabel, and refHasRangeLabels ([#17555](https://github.com/microsoft/FluidFramework/issues/17555)) [e4c11874ef](https://github.com/microsoft/FluidFramework/commits/e4c11874ef7c62b7cde7c282bc7997519d35fbbc)

    The following classes and functions have been deprecated. The functionality has poor test coverage and is largely
    unused. They will be removed in a future release.

    -   IntervalType.Nest
    -   internedSpaces
    -   RangeStackMap
    -   refGetRangeLabels
    -   refHasRangeLabel
    -   refHasRangeLabels

## 2.0.0-internal.7.0.0

### Major Changes

-   sequence: New API for specifying spatial positioning of intervals [871b3493dd](https://github.com/microsoft/FluidFramework/commits/871b3493dd0d7ea3a89be64998ceb6cb9021a04e)

    Previously intervals were specified with only an index. Now the model is a bit more nuanced in that you can specify positions that lie before or after a given index. This makes it more clear how interval endpoints should interact with changes to the sequence. See the docs for SequencePlace for additional context.

-   sequence: IIntervalCollection.change must specify both endpoints [871b3493dd](https://github.com/microsoft/FluidFramework/commits/871b3493dd0d7ea3a89be64998ceb6cb9021a04e)

    IIntervalCollection.change no longer allows an endpoint to be undefined. undefined can unintentionally result in end < start. To adapt to this change, simply use the current position of the endpoint that is not intended to change.

-   Dependencies on @fluidframework/protocol-definitions package updated to 3.0.0 [871b3493dd](https://github.com/microsoft/FluidFramework/commits/871b3493dd0d7ea3a89be64998ceb6cb9021a04e)

    This included the following changes from the protocol-definitions release:

    -   Updating signal interfaces for some planned improvements. The intention is split the interface between signals
        submitted by clients to the server and the resulting signals sent from the server to clients.
        -   A new optional type member is available on the ISignalMessage interface and a new ISentSignalMessage interface has
            been added, which will be the typing for signals sent from the client to the server. Both extend a new
            ISignalMessageBase interface that contains common members.
    -   The @fluidframework/common-definitions package dependency has been updated to version 1.0.0.

-   Server upgrade: dependencies on Fluid server packages updated to 2.0.1 [871b3493dd](https://github.com/microsoft/FluidFramework/commits/871b3493dd0d7ea3a89be64998ceb6cb9021a04e)

    Dependencies on the following Fluid server package have been updated to version 2.0.1:

    -   @fluidframework/gitresources: 2.0.1
    -   @fluidframework/server-kafka-orderer: 2.0.1
    -   @fluidframework/server-lambdas: 2.0.1
    -   @fluidframework/server-lambdas-driver: 2.0.1
    -   @fluidframework/server-local-server: 2.0.1
    -   @fluidframework/server-memory-orderer: 2.0.1
    -   @fluidframework/protocol-base: 2.0.1
    -   @fluidframework/server-routerlicious: 2.0.1
    -   @fluidframework/server-routerlicious-base: 2.0.1
    -   @fluidframework/server-services: 2.0.1
    -   @fluidframework/server-services-client: 2.0.1
    -   @fluidframework/server-services-core: 2.0.1
    -   @fluidframework/server-services-ordering-kafkanode: 2.0.1
    -   @fluidframework/server-services-ordering-rdkafka: 2.0.1
    -   @fluidframework/server-services-ordering-zookeeper: 2.0.1
    -   @fluidframework/server-services-shared: 2.0.1
    -   @fluidframework/server-services-telemetry: 2.0.1
    -   @fluidframework/server-services-utils: 2.0.1
    -   @fluidframework/server-test-utils: 2.0.1
    -   tinylicious: 2.0.1

-   Minimum TypeScript version now 5.1.6 [871b3493dd](https://github.com/microsoft/FluidFramework/commits/871b3493dd0d7ea3a89be64998ceb6cb9021a04e)

    The minimum supported TypeScript version for Fluid 2.0 clients is now 5.1.6.

-   sequence: Remove `compareStarts` and `compareEnds` from `IIntervalHelpers` [871b3493dd](https://github.com/microsoft/FluidFramework/commits/871b3493dd0d7ea3a89be64998ceb6cb9021a04e)

    These methods are redudant with the functions `IInterval.compareStart` and `IInterval.compareEnd` respectively.

-   sequence: Remove the mergeTreeUseNewLengthCalculations flag [871b3493dd](https://github.com/microsoft/FluidFramework/commits/871b3493dd0d7ea3a89be64998ceb6cb9021a04e)

    The `mergeTreeUseNewLengthCalculations` flag has been removed, because the feature was enabled by default in 2.0.0-internal.6.0.0.

## 2.0.0-internal.6.4.0

Dependency updates only.

## 2.0.0-internal.6.3.0

### Minor Changes

-   deprecate compareStarts and compareEnds on IIntervalHelpers ([#17127](https://github.com/microsoft/FluidFramework/issues/17127)) [a830eca757](https://github.com/microsoft/FluidFramework/commits/a830eca7571cfb230abe5b9443ba5c5fc44671e0)

    these functions will be removed in a future version. use the methods IInterval.compareStart and IInterval.compareEnd respectively instead

## 2.0.0-internal.6.2.0

### Minor Changes

-   Deprecate getStackContext and associated NestBegin/End ([#16877](https://github.com/microsoft/FluidFramework/issues/16877)) [8e743fe1dd](https://github.com/microsoft/FluidFramework/commits/8e743fe1dde9adb3a1240971987d3abd51ab2fbe)

    Deprecate SharedSegmentSequence.getStackContext and Client.getStackContext (and the enums ReferenceType.NestBegin and NestEnd they use).
    This functionality is unused, poorly tested, and incurs performance overhead.

-   Remove use of @fluidframework/common-definitions ([#16638](https://github.com/microsoft/FluidFramework/issues/16638)) [a8c81509c9](https://github.com/microsoft/FluidFramework/commits/a8c81509c9bf09cfb2092ebcf7265205f9eb6dbf)

    The **@fluidframework/common-definitions** package is being deprecated, so the following interfaces and types are now
    imported from the **@fluidframework/core-interfaces** package:

    -   interface IDisposable
    -   interface IErrorEvent
    -   interface IErrorEvent
    -   interface IEvent
    -   interface IEventProvider
    -   interface ILoggingError
    -   interface ITaggedTelemetryPropertyType
    -   interface ITelemetryBaseEvent
    -   interface ITelemetryBaseLogger
    -   interface ITelemetryErrorEvent
    -   interface ITelemetryGenericEvent
    -   interface ITelemetryLogger
    -   interface ITelemetryPerformanceEvent
    -   interface ITelemetryProperties
    -   type ExtendEventProvider
    -   type IEventThisPlaceHolder
    -   type IEventTransformer
    -   type ReplaceIEventThisPlaceHolder
    -   type ReplaceIEventThisPlaceHolder
    -   type TelemetryEventCategory
    -   type TelemetryEventPropertyType

-   Deprecate SharedSequence, SubSequence, and IJSONRunSegment ([#16829](https://github.com/microsoft/FluidFramework/issues/16829)) [0cf2b6d909](https://github.com/microsoft/FluidFramework/commits/0cf2b6d9098c7ef4234b66c5d7d169192db40d15)

    The types SharedSequence, SubSequence, and IJSONRunSegment are being deprecated and moved.

    They are now, and will continue to be exposed from the @fluid-experimental/sequence-deprecated package.

    New usages of these types should not be added, but they may be necessary for migration.

## 2.0.0-internal.6.1.0

Dependency updates only.

## 2.0.0-internal.6.0.0

### Major Changes

-   IntervalConflictResolver removed [8abce8cdb4](https://github.com/microsoft/FluidFramework/commits/8abce8cdb4e2832fb6405fb44e393bef03d5648a)

    IntervalConflictResolver has been removed. Any lingering usages in application code can be removed as well. This change also marks APIs deprecated in #14318 as internal.

-   Remove ISegment.parent [8abce8cdb4](https://github.com/microsoft/FluidFramework/commits/8abce8cdb4e2832fb6405fb44e393bef03d5648a)

    This change removed the parent property on the ISegment interface. The property will still exist, but should not generally be used by outside consumers.

    There are some circumstances where a consumer may wish to know if a segment is still in the underlying tree and were using the parent property to determine that.

    Please change those checks to use the following `"parent" in segment && segment.parent !== undefined`

-   Upgraded typescript transpilation target to ES2020 [8abce8cdb4](https://github.com/microsoft/FluidFramework/commits/8abce8cdb4e2832fb6405fb44e393bef03d5648a)

    Upgraded typescript transpilation target to ES2020. This is done in order to decrease the bundle sizes of Fluid Framework packages. This has provided size improvements across the board for ex. Loader, Driver, Runtime etc. Reduced bundle sizes helps to load lesser code in apps and hence also helps to improve the perf.If any app wants to target any older versions of browsers with which this target version is not compatible, then they can use packages like babel to transpile to a older target.

## 2.0.0-internal.5.4.0

### Minor Changes

-   Some interval-related APIs are deprecated ([#16573](https://github.com/microsoft/FluidFramework/issues/16573)) [82de148126](https://github.com/microsoft/FluidFramework/commits/82de14812617e4d305bdb621737a0d94a5392d25)

    The following APIs are now deprecated from `IntervalCollection`:

    -   `findOverlappingIntervals` and `gatherIterationResults` - these functions are moved to
        the `OverlappingIntervalsIndex`. Users are advised to independently attach the index to the collection and utilize the
        API accordingly, for instance:

        ```typescript
        const overlappingIntervalsIndex = createOverlappingIntervalsIndex(client, helpers);
        collection.attachIndex(overlappingIntervalsIndex);
        const result1 = overlappingIntervalsIndex.findOverlappingIntervals(start, end);

        const result2 = [];
        overlappingIntervalsIndex.gatherIterationResults(result2, true);
        ```

    -   `CreateBackwardIteratorWithEndPosition`, `CreateBackwardIteratorWithStartPosition`,
        `CreateForwardIteratorWithEndPosition` and `CreateForwardIteratorWithStartPosition` - only the default iterator will be
        supported in the future, and it will no longer preserve sequence order.

        Equivalent functionality to these four methods is provided by `IOverlappingIntervalIndex.gatherIterationResults`.

    -   `previousInterval` and `nextInterval` - These functionalities are moved to the `EndpointIndex`. Users are advised to
        independently attach the index to the collection and utilize the API accordingly, for instance:

        ```typescript
        const endpointIndex = createEndpointIndex(client, helpers);
        collection.attachIndex(endpointIndex);

        const result1 = endpointIndex.previousInterval(pos);
        const result2 = endpointIndex.nextInterval(pos);
        ```

## 2.0.0-internal.5.3.0

Dependency updates only.

## 2.0.0-internal.5.2.0

### Minor Changes

-   Deprecate ISegment.parent ([#16097](https://github.com/microsoft/FluidFramework/issues/16097)) [9486bec0ea](https://github.com/microsoft/FluidFramework/commits/9486bec0ea2f9f1dd3e40fc3b4c42af6b6a44697)

    This change deprecates the parent property on the ISegment interface. The property will still exist, but should not generally be used by outside consumers.

    There are some circumstances where a consumer may wish to know if a segment is still in the underlying tree and were using the parent property to determine that.

    Please change those checks to use the following `"parent" in segment && segment.parent !== undefined`

-   slide parameter in changeInterval event ([#16117](https://github.com/microsoft/FluidFramework/issues/16117)) [46f74fe568](https://github.com/microsoft/FluidFramework/commits/46f74fe5684e44df436ed28ea41c98ca146b03cc)

    The changeInterval event listener has a new parameter "slide" that is true if the event was caused by the interval endpoint sliding from a removed range.

## 2.0.0-internal.5.1.0

### Minor Changes

-   New APIs for interval querying by range ([#15837](https://github.com/microsoft/FluidFramework/issues/15837)) [2a4242e1b5](https://github.com/microsoft/FluidFramework/commits/2a4242e1b5f15442b13ae413124ec76315a4cc52)

    SharedString now supports querying intervals whose start/end-points fall in a specified range.

## 2.0.0-internal.5.0.0

### Major Changes

-   The following types have been removed: `IntervalCollection`, `CompressedSerializedInterval`, [8b242fdc79](https://github.com/microsoft/FluidFramework/commits/8b242fdc796714cf1da9ad3f90d02efb122af0c2)
    `IntervalCollectionIterator`, and `ISerializedIntervalCollectionV2`. These types were deprecated in version
    2.0.0-internal.4.4.0.

## 2.0.0-internal.4.4.0

### Minor Changes

-   `IntervalCollection` has been deprecated in favor of an interface (`IIntervalCollection`) containing its public API. ([#15774](https://github.com/microsoft/FluidFramework/pull/15774)) [8c6e76ab75](https://github.com/microsoft/FluidFramework/commits/8c6e76ab753d4ec0cc43bdd6ed04db905391ef2e)
    Several types transitively referenced by `IntervalCollection` implementation details have also been deprecated:
    `CompressedSerializedInterval`, `IntervalCollectionIterator`, and `ISerializedIntervalCollectionV2`.
-   New feature: Revertibles for SharedString and Interval provide undo-redo functionality. This includes all direct interval edits as well as string edits that indirectly affect intervals, wrapping merge-tree revertibles. ([#15778](https://github.com/microsoft/FluidFramework/pull/15778)) [6433cb2937](https://github.com/microsoft/FluidFramework/commits/6433cb2937d9a6bc39ac93b0eca2c073e6d5be52)
-   Experimental feature: An initial implementation of "interval stickiness". This experimental feature can only be used by ([#15423](https://github.com/microsoft/FluidFramework/pull/15423)) [8ba75c508f](https://github.com/microsoft/FluidFramework/commits/8ba75c508ff2370f3de0c9f63390f90a12d9bca2)
    enabling the feature flag "intervalStickinessEnabled".
-   New feature: `IntervalCollection`s now have an `attachIndex` and `detachIndex` API for interval querying. ([#15683](https://github.com/microsoft/FluidFramework/pull/15683)) [f5db26a122](https://github.com/microsoft/FluidFramework/commits/f5db26a122735cf12dc0477b37d9297f7f3ae602)

## 2.0.0-internal.4.1.0

### Minor Changes

-   IntervalConflictResolver deprecation ([#15089](https://github.com/microsoft/FluidFramework/pull-requests/15089)) [38345841a7](https://github.com/microsoft/FluidFramework/commits/38345841a75d68e94748823c3da5078a2fc57449)

    In `SharedString`, interval conflict resolvers have been unused since [this
    change](https://github.com/microsoft/FluidFramework/pull/6407), which added support for multiple intervals at the same
    position. As such, any existing usages can be removed. Related APIs have been deprecated and will be removed in an
    upcoming release.
