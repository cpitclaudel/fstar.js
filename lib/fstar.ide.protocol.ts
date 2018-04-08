namespace FStar.IDE.Protocol {
    export enum Client {
        INIT = "INIT",
        QUERY = "QUERY",
        UPDATE_CONTENTS = "UPDATE_CONTENTS"
    }

    export enum Worker {
        PROGRESS = "PROGRESS",
        READY = "READY",
        MESSAGE = "MESSAGE",
        RESPONSE = "RESPONSE",
        EXIT = "EXIT"
    }

    export enum Status {
        SUCCESS = "success",
        FAILURE = "failure",
        MESSAGE = "message"
    }
}
