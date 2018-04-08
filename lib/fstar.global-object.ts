interface ErrorConstructor {
    stackTraceLimit?: number;
}

if (Error.hasOwnProperty("stackTraceLimit")) {
    // Get larger stack traces in Chromium and NodeJS
    Error.stackTraceLimit = 50;
}

namespace FStar {
    // Sphinx renames _
    export const _: _.UnderscoreStatic = (self as any).$u || (self as any)._;
    export const _Worker = (self as any).Worker;
}
