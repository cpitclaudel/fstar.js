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
