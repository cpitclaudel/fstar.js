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
