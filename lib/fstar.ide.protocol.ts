/* Run F* in --ide mode (protocol).

Copyright (C) 2017-2018 Clément Pit-Claudel
Author: Clément Pit-Claudel <clement.pitclaudel@live.com>
URL: https://github.com/cpitclaudel/fstar.js

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License. */

namespace FStar.IDE.Protocol {
    export enum FStarMessageKind {
        MESSAGE = "message",
        RESPONSE = "response",
        PROTOCOL_INFO = "protocol-info"
    }

    export interface FStarMessageMessage {
        kind: FStarMessageKind.MESSAGE;
        "query-id"?: string;
        level: string;
        contents: any;
    }

    export interface FStarResponseMessage {
        kind: FStarMessageKind.RESPONSE;
        "query-id": string;
        status: QueryStatus;
        response: any;
    }

    export interface FStarProtocolInfoMessage {
        kind: FStarMessageKind.PROTOCOL_INFO;
        [k: string]: any;
    }

    export type FStarMessage =
        FStarMessageMessage |
        FStarResponseMessage |
        FStarProtocolInfoMessage;

    export enum ClientMessageKind {
        INIT = "INIT",
        QUERY = "QUERY",
        UPDATE_CONTENTS = "UPDATE_CONTENTS"
    }

    export interface ClientInitPayload {
        fname: string;
        fcontents: string;
        args: string[];
    }

    export interface ClientInitMessage {
        kind: ClientMessageKind.INIT;
        payload: ClientInitPayload;
    }

    export interface ClientQueryMessage {
        kind: ClientMessageKind.QUERY;
        payload: object;
    }

    export interface ClientUpdateContentsPayload {
        fcontents: string;
    }

    export interface ClientUpdateContentsMessage {
        kind: ClientMessageKind.UPDATE_CONTENTS;
        payload: ClientUpdateContentsPayload;
    }

    export type ClientMessage = ClientInitMessage | ClientQueryMessage | ClientUpdateContentsMessage;

    export enum QueryStatus {
        SUCCESS = "success",
        FAILURE = "failure",
        MESSAGE = "message"
    }

    export enum WorkerMessageKind {
        PROGRESS = "PROGRESS",
        READY = "READY",
        MESSAGE = "MESSAGE",
        RESPONSE = "RESPONSE",
        EXIT = "EXIT"
    }

    export interface WorkerProgressMessage {
        kind: WorkerMessageKind.PROGRESS;
        payload: string | null;
    }

    export interface WorkerReadyMessage {
        kind: WorkerMessageKind.READY;
        payload: null;
    }

    export type WorkerMessagePayload = FStarMessageMessage;

    export interface WorkerMessageMessage {
        kind: WorkerMessageKind.MESSAGE;
        payload: WorkerMessagePayload;
    }

    export type WorkerResponsePayload = FStarResponseMessage;

    export interface WorkerResponseMessage {
        kind: WorkerMessageKind.RESPONSE;
        payload: WorkerResponsePayload;
    }

    export interface WorkerExitMessage {
        kind: WorkerMessageKind.EXIT;
        payload: null;
    }

    export type WorkerMessage =
        WorkerProgressMessage |
        WorkerReadyMessage |
        WorkerMessageMessage |
        WorkerResponseMessage |
        WorkerExitMessage;
}
