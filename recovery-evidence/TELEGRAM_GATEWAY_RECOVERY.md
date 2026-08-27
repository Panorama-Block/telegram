# Telegram Gateway V1 Recovery

## Historical Azure workload

Container App:

    panorama-dev-telegram-api

Resource group:

    rg-panorama-dev

Historical image:

    panoramadevpublicapi.azurecr.io/telegram-gateway:latest

Historical ACR manifest digest:

    sha256:94b824a05a9404368616938e606729fb3d4a6f379a89465c4b2886bb6bae0d8a

Historical Container App revision:

    panorama-dev-telegram-api--0000001

## Verified Git source

Historical source commit:

    a9f9ec858ed7f54f52f36129d42ac64f272c66e7

Commit date:

    2026-05-27T15:25:48+02:00

Author:

    noymaxx <hugo.povoleri@sou.inteli.edu.br>

Subject:

    test: capability intent, client, deep-link tests (#191,#197,#201)

The ACR repository also contains an immutable image tag named with this
exact Git commit SHA.

## Application provenance verification

The historical production image was exported and its compiled Telegram
gateway application recovered from:

    /app/apps/gateway/dist

The deployed application contained 53 JavaScript files.

An isolated checkout of Git commit
a9f9ec858ed7f54f52f36129d42ac64f272c66e7 was compiled and compared
against the production filesystem.

Results:

    Recovered JavaScript files: 53
    Candidate TypeScript files: 53

    Matched:   53
    Different: 0
    Missing:   0

The complete SHA-256 inventories of the emitted and deployed JavaScript
files were identical.

Source-to-deployed-application provenance is therefore verified.

## Package manifest

The package.json recovered from the production image was byte-identical
to Git blob:

    d91f25fd7cef095b7e8cb54845e36708add87c40

This blob is present at:

    apps/gateway/package.json

in historical Git commit:

    a9f9ec858ed7f54f52f36129d42ac64f272c66e7

## Historical dependency lock

The historical production container contains a package-lock.json that
was not present in the corresponding Git commit.

Recovered production lock SHA-256:

    364f60ea3c16d3ba6ae4c2f600e1edc4a1dc7e4760e55c92cb59f19690da4e68

A fresh npm install performed during the recovery investigation generated
a different lockfile:

    823401c082df7a5c89c7ec80aaf7de20ffe7f7ab6fd85d522bdc12feaff9b1f2

The recovered production lockfile has therefore been restored on this
recovery branch to preserve the historical dependency resolution.

## Historical Dockerfile

Git blob:

    0a4d311c46dcf1f40335eeaf2ea1e2dd947d2668

The Dockerfile present at the verified historical source commit has Git blob:

    0a4d311c46dcf1f40335eeaf2ea1e2dd947d2668

Its runtime structure is consistent with the recovered historical image.
The application provenance established above does not depend on asserting
that this Dockerfile was necessarily the exact Dockerfile consumed by
the historical ACR build.

## Recovery semantics

The historical Git commit remains unchanged.

This recovery branch starts from the verified historical source commit
and adds only artefacts required to make the historical deployment
reproducible and company-controlled.

The branch must therefore not be represented as the original historical
Git state. It is the controlled reconstruction of that state.
