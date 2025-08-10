# Note 0000 - Promise Flattening

**Date Created:** 2025-01-05

## 1. Introduction

In JavaScript, when obtaining the result from a promise, the promise chain is fully flattened. This poses significant problems for the developer when objects are incorrectly classified as promises due to containing a callable `then` property. 

## 2. Details

JavaScript uses duck-typing to classify promise-like objects. This behaviour was intended to allow for interoperability with existing libraries at the time, but can also be seen to be problematic.

Since promises fully flatten their promise chains, it is impossible to resolve with a "[thenable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise#thenables)" object (one possessing a callable `then` property) that is not intended to be promise-like.

The runtime will always interpret the object as a promise and attempt to invoke the `then` method. There is no option to prevent this behaviour and interpret the object as a regular object.

## 3. Resolution

As native promises are industry standard, we have no choice but to accept defeat.

It shall be strictly prohibited for an object to possess a callable `then` property under any circumstances.

Any exception must reference this note and offer a rationale.

Any code impacted by this note is recommended to reference it.

## 4. Reassessment

This note can be reassessed if JavaScript alters promise flattening behaviour or offers more developer control.
