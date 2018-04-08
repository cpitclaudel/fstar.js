/* Run F* on whole files and print the command line output (protocol).

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

namespace FStar.CLI.Protocol {
    export enum ClientMessageKind {
        VERIFY = "VERIFY"
    }

    export interface ClientVerifyPayload {
        fname: string;
        fcontents: string;
        args: string[];
    }

    export interface ClientVerifyMessage {
        kind: ClientMessageKind.VERIFY;
        payload: ClientVerifyPayload;
    }

    export type ClientMessage = ClientVerifyMessage;

    export enum WorkerMessageKind {
        PROGRESS = "PROGRESS",
        READY = "READY",
        STDOUT = "STDOUT",
        STDERR = "STDERR",
        VERIFICATION_COMPLETE = "VERIFICATION_COMPLETE",
    }

    export interface WorkerProgressMessage {
        kind: WorkerMessageKind.PROGRESS;
        payload: string;
    }

    export interface WorkerReadyMessage {
        kind: WorkerMessageKind.READY;
        payload: null;
    }

    export interface WorkerStdoutMessage {
        kind: WorkerMessageKind.STDOUT;
        payload: string;
    }

    export interface WorkerStderrMessage {
        kind: WorkerMessageKind.STDERR;
        payload: string;
    }

    export interface WorkerVerificationCompleteMessage {
        kind: WorkerMessageKind.VERIFICATION_COMPLETE;
        payload: number;
    }

    export type WorkerMessage =
        WorkerProgressMessage |
        WorkerReadyMessage |
        WorkerStdoutMessage |
        WorkerStderrMessage |
        WorkerVerificationCompleteMessage;
}
