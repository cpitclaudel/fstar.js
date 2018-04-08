interface ErrorConstructor {
    stackTraceLimit?: number;
}

if (Error.hasOwnProperty("stackTraceLimit")) {
    // Get larger stack traces in Chromium and NodeJS
    Error.stackTraceLimit = 50;
}

const _underscore: any = _;
declare const $u: _.UnderscoreStatic | undefined;

namespace FStar {
    // Sphinx renames _
    const _ = typeof($u) !== "undefined" ? $u : _underscore;
}
