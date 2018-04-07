namespace FStar.IDE.Protocol {
    enum Client {
        INIT = "INIT",
        QUERY = "QUERY",
        UPDATE_CONTENTS = "UPDATE_CONTENTS"
    }

    enum Worker {
        PROGRESS = "PROGRESS",
        READY = "READY",
        MESSAGE = "MESSAGE",
        RESPONSE = "RESPONSE",
        EXIT = "EXIT"
    }

    enum Status {
        SUCCESS = "success",
        FAILURE = "failure",
        MESSAGE = "message"
    }
}
