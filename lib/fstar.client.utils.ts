namespace FStar.ClientUtils {
    const _ = FStar._;
    export let DEBUG = true;

    export function debug(...args: any[]) {
        if (DEBUG) {
            // tslint:disable-next-line: no-console
            console.debug(...args);
        }
    }

    const CM_DEFAULTS = {
        lineNumbers: true,
        theme: "tango",
        mode: "text/x-fstar"
    };

    export function setupEditor(parent: HTMLElement, text: string, options?: CodeMirror.EditorConfiguration) {
        options = _.extend({}, CM_DEFAULTS, (options || {}), { value: text || "" });
        return CodeMirror(parent, options);
    }

    export function highlightSnippet(snippet: string) {
        const container = document.createElement("span");
        CodeMirror.runMode(snippet, "fstar", container);
        container.className = "cm-s-tango";
        return container.outerHTML;
    }

    export function stripNewLines(text: string) {
        return text.replace(/^[\r\n]+/, "").replace(/[\r\n]+$/, "");
    }

    export function countLines(text: string) {
        return (text.match(/\n/g) || []).length;
    }

    export function assert(condition: boolean | null | undefined, message?: string) {
        if (!condition) {
            throw (message || "assertion failed");
        }
    }

    export function assertNever(x: never): never {
        throw new Error(`Unexpected value: ${x}`);
    }
}
