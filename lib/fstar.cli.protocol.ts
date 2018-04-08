namespace FStar.CLI.Protocol { // FIXME rename
    export enum Client {
        VERIFY = "VERIFY"
    }

    export enum Worker {
        PROGRESS = "PROGRESS",
        READY = "READY",
        STDOUT = "STDOUT",
        STDERR = "STDERR",
        VERIFICATION_COMPLETE = "VERIFICATION_COMPLETE",
        IDE_RESPONSE = "IDE_RESPONSE",
        IDE_EXIT = "IDE_EXIT" // FIXME
    }
}
