/* Utilities for F*.js' CLI and IDE user modules.

Copyright (C) 2017-2018 Clément Pit-Claudel
Author: Clément Pit-Claudel <clement.pitclaudel@live.com>
URL: https://github.com/cpitclaudel/fstar.js

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License. */

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
