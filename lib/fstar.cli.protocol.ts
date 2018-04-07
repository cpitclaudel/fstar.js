namespace FStar.CLI.Protocol {
    enum Client {
        VERIFY = "VERIFY"
    }

    enum Worker {
        PROGRESS = "PROGRESS",
        READY = "READY",
        STDOUT = "STDOUT",
        STDERR = "STDERR",
        VERIFICATION_COMPLETE = "VERIFICATION_COMPLETE",
        IDE_RESPONSE = "IDE_RESPONSE",
        IDE_EXIT = "IDE_EXIT" // FIXME
    }
}
