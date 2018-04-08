import * as CodeMirror from "codemirror";

declare module "codemirror" {
    interface Editor {
        setValue(content: string, selection?: number): void;
    }
}
