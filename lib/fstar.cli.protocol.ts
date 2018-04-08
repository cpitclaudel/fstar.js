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

    export type WorkerProgressPayload = string;

    export interface WorkerProgressMessage {
        kind: WorkerMessageKind.PROGRESS;
        payload: WorkerProgressPayload;
    }

    export type WorkerReadyPayload = undefined;

    export interface WorkerReadyMessage {
        kind: WorkerMessageKind.READY;
        payload: WorkerReadyPayload;
    }

    export type WorkerStdoutPayload = string;

    export interface WorkerStdoutMessage {
        kind: WorkerMessageKind.STDOUT;
        payload: WorkerStdoutPayload;
    }

    export type WorkerStderrPayload = string;

    export interface WorkerStderrMessage {
        kind: WorkerMessageKind.STDERR;
        payload: WorkerStderrPayload;
    }

    export interface WorkerVerificationCompleteMessage {
        kind: WorkerMessageKind.VERIFICATION_COMPLETE;
        payload: undefined;
    }

    export type WorkerMessage =
        WorkerProgressMessage |
        WorkerReadyMessage |
        WorkerStdoutMessage |
        WorkerStderrMessage |
        WorkerVerificationCompleteMessage;
}
