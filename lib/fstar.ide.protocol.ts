namespace FStar.IDE.Protocol {
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
        payload: string;
    }

    export interface WorkerReadyMessage {
        kind: WorkerMessageKind.READY;
        payload?: null;
    }

    export interface WorkerResponsePayload {
        "query-id": string;
    }

    export interface WorkerMessageMessage {
        kind: WorkerMessageKind.MESSAGE;
        payload: WorkerResponsePayload;
    }

    export interface WorkerResponsePayload {
        "query-id": string;
        status: QueryStatus;
    }

    export interface WorkerResponseMessage {
        kind: WorkerMessageKind.RESPONSE;
        payload: WorkerResponsePayload;
    }

    export interface WorkerExitMessage {
        kind: WorkerMessageKind.EXIT;
        payload: {};
    }

    export type WorkerMessage =
        WorkerProgressMessage |
        WorkerReadyMessage |
        WorkerMessageMessage |
        WorkerResponseMessage |
        WorkerExitMessage;
}
