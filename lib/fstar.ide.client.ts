namespace FStar.IDE {
    import Utils = FStar.ClientUtils;
    import Protocol = FStar.IDE.Protocol;

    const _ = FStar._;
    const debug = Utils.debug;

    /// FStar.IDE.Set

    class Set<T> {
        public length: number;
        private elems: { [k: string]: T };

        constructor() {
            this.length = 0;
            this.elems = {};
        }

        public containsKey(key: string | number) {
            return this.elems[key] !== undefined;
        }

        public at(key: string | number) {
            return this.elems[key];
        }

        public add(key: string | number, value: T) {
            if (!this.containsKey(key)) {
                this.length++;
            }
            return this.elems[key] = value;
        }

        public remove(key: string | number) {
            delete this.elems[key];
        }
    }

    /// FStar.IDE.SnippetCollection

    export enum SnippetState {
        PENDING = "PENDING",
        BUSY = "BUSY",
        DONE = "DONE"
    }

    export interface PSHyp {
        type: string;
    }

    export interface PSGoal {
        goal: never;
        hyps: PSHyp[];
    }

    export interface ProofState<TSnippet> {
        label: string;
        location?: Range<TSnippet>;
        goals: PSGoal[];
    }

    // Snippet fields reserved for use by the IDE
    export interface IdePrivateSnippetData {
        length: number;
        firstLine: number;
    }

    export const emptyIdePrivateData: IdePrivateSnippetData = { length: 0, firstLine: 0 };

    export interface FStarError<TSnippet> {
        ranges: Array<Range<TSnippet>>;
        level: string;
        message: string;
    }

    export interface BasicSnippet<TSnippet> {
        idePrivateData: IdePrivateSnippetData;
        getId(): number;
        getText(): string;
        getState(): SnippetState | null;
        setState(state: SnippetState | null): void;
        setErrors(errors: Array<FStarError<TSnippet>>): void;
        setProofState(ps: ProofState<TSnippet> | null): void;
    }

    class SnippetCollection<TSnippet extends BasicSnippet<TSnippet>> {
        private list: TSnippet[];
        private map: Set<TSnippet>;
        private indices: Set<number>;

        constructor() {
            this.list = [];
            this.map = new Set();
            this.indices = new Set();
        }

        public getById(snippetId: string) {
            return this.map.at(snippetId);
        }

        public contains(snippet: TSnippet) {
            return this.indices.containsKey(snippet.getId());
        }

        public count() {
            return this.list.length;
        }

        public last() {
            if (this.list.length === 0) {
                throw new Error("Empty collection");
            }
            return this.list[this.list.length - 1];
        }

        public index(snippet: TSnippet) {
            const id = snippet.getId();
            if (!this.indices.containsKey(id)) {
                throw new Error(`Not found: ${id}`);
            }
            return this.indices.at(id);
        }

        public allInState(state: SnippetState) {
            // LATER make this faster by keeping track of snippets by state
            return _.filter(this.list, (snippet: TSnippet) => snippet.getState() === state);
        }

        public firstInState(state: SnippetState) {
            // LATER make this faster by keeping track of snippets by state
            return _.find(this.list, (snippet: TSnippet) => snippet.getState() === state);
        }

        public someInState(state: SnippetState) {
            // LATER make this faster by keeping track of snippets by state
            return this.firstInState(state) !== undefined;
        }

        public snippetAtLine(line: number) {
            const getFirstLine = (snippet: { idePrivateData: { firstLine: number } }) =>
                snippet.idePrivateData.firstLine;
            // Math.max is needed because F* sometimes thinks it found errors on (nonexistent) line 0
            const dummy = { idePrivateData: { firstLine: Math.max(line, 1) + 0.1 } };
            const insertionPoint = _.sortedIndex(this.list, dummy, getFirstLine);
            Utils.assert(insertionPoint > 0);
            return this.list[insertionPoint - 1];
        }

        public insert(snippet: TSnippet, index: number) {
            const id = snippet.getId();
            this.list.splice(index, 0, snippet);
            this.map.add(id, snippet);
            this.indices.add(id, index);
        }

        public remove(snippet: TSnippet) {
            const id = snippet.getId();
            const idx = this.indices.at(id);

            if (idx === undefined) {
                throw new Error(`Not found: ${id}`);
            }

            this.list.splice(idx, 1);
            this.map.remove(id);
            this.indices.remove(id);
        }
    }

    /// FStar.IDE.Client

    // This needs to be customizable, because web workers are loaded relative to
    // the current *page*, not to the current *script*.
    export let WORKER_DIRECTORY = "./fstar.js/";

    export interface Range<TSnippet> {
        beg: [number, number];
        end: [number, number];
        fname: string;
        snippet?: TSnippet;
    }

    export interface PushError {
        ranges: Array<Range<any>>;
    }

    type QueryCallback = (status: Protocol.QueryStatus, data: any) => void;

    export interface RawProofState<TSnippet> {
        label: string;
        location?: Range<TSnippet>;
        goals: PSGoal[];
        smt_goals: PSGoal[];
    }

    export class Client<TSnippet extends BasicSnippet<TSnippet>> {
        private fname: string;
        private gensymState: number;
        private callbacks: Set<QueryCallback>;
        private snippets: SnippetCollection<TSnippet>;
        private worker: Worker;
        private onProgress: (msg: string | null) => void;

        constructor(fname: string, onProgress: (msg: string | null) => void) {
            this.fname = fname;
            this.gensymState = 0;
            this.callbacks = new Set();
            this.snippets = new SnippetCollection();
            this.worker = new _Worker(FStar.IDE.WORKER_DIRECTORY + "fstar.ide.worker.js");
            this.worker.onmessage = (msg: MessageEvent) => this.onMessage(msg);
            this.onProgress = onProgress || (() => { /* ignore */ });

        }

        private postMessage(msg: Protocol.ClientMessage) {
            this.worker.postMessage(msg);
        }

        private static mkQuery(qid: string, query: string, args: any) {
            return { "query-id": qid, query, args };
        }

        private gensym() {
            return (++this.gensymState).toString();
        }

        private static groupHypothesesByType(hyps: PSHyp[]) {
            const groups = [];
            let prevType = null;
            for (const hyp of hyps) {
                if (hyp.type === prevType) {
                    groups[groups.length - 1].push(hyp);
                } else {
                    groups.push([hyp]);
                    prevType = hyp.type;
                }
            }
            return groups;
        }

        private annotateProofState(ps: RawProofState<TSnippet>): ProofState<TSnippet> {
            const viewHyps = (hyps: PSHyp[]) => {
                return { hyps, type: hyps[0].type };
            };
            const viewGoals = (goals: PSGoal[], label: string) => {
                return _.map(goals, (g: PSGoal, idx: number) => {
                    return { label: label + (idx + 1),
                             hyps: _.map(Client.groupHypothesesByType(g.hyps), viewHyps),
                             goal: g.goal };
                });
            };
            return {
                label: ps.label,
                location: ps.location && this.annotateRange(ps.location),
                goals: viewGoals(ps.goals, "G").concat(viewGoals(ps.smt_goals, "SMT"))
            };
        }

        private routeMessage(qid: string, status: Protocol.QueryStatus, data: any) {
            Utils.assert(this.callbacks.containsKey(qid), "Missing query ID");
            return this.callbacks.at(qid).call(this, status, data);
        }

        private processMessage(msg: Protocol.WorkerMessage) {
            debug("Client.onMessage", msg.kind, msg.payload);
            switch (msg.kind) {
                case Protocol.WorkerMessageKind.PROGRESS:
                    this.onProgress(msg.payload);
                    break;
                case Protocol.WorkerMessageKind.READY:
                    this.onProgress("Ready!");
                    this.onProgress(null);
                    break;
                case Protocol.WorkerMessageKind.RESPONSE:
                    const payload = msg.payload;
                    this.routeMessage(payload["query-id"], payload.status, payload);
                    this.callbacks.remove(payload["query-id"]);
                    break;
                case Protocol.WorkerMessageKind.MESSAGE:
                    if (msg.payload["query-id"]) {
                        // protocol-info messages don't have query IDs
                        this.routeMessage(msg.payload["query-id"]!,
                                          Protocol.QueryStatus.MESSAGE,
                                          msg.payload);
                    }
                    break;
                case Protocol.WorkerMessageKind.EXIT:
                    // TODO
                    break;
                default:
                    Utils.assertNever(msg);
            }
            this.processPending();
        }

        private onMessage(evt: MessageEvent) {
            this.processMessage(evt.data);
        }

        public busy() {
            return this.callbacks.length > 0;
        }

        private busyWithSnippets() {
            return this.snippets.someInState(SnippetState.BUSY);
        }

        private snippetForRange<T>(range: Range<T>) {
            return this.snippets.snippetAtLine(range.beg[0]);
        }

        private annotateRange(range: Range<TSnippet>) {
            if (range.fname === "<input>" || range.fname === this.fname) {
                const snippet = this.snippetForRange(range);
                const lineDelta = -snippet.idePrivateData.firstLine + 1;
                range.snippet = snippet;
                range.beg[0] += lineDelta;
                range.end[0] += lineDelta;
            }
            if (_.isEqual(range.beg, range.end)) {
                if (range.beg[1] > 0) {
                    range.beg[1]--;
                } else {
                    range.end[1]++;
                }
            }
            return range;
        }

        private annotateRanges(errors: PushError[]) {
            _.each(errors, (error: PushError) => {
                _.each(error.ranges, this.annotateRange, this);
            });
        }

        private makePushCallback(snippet: TSnippet) {
            return (status: Protocol.QueryStatus, payload: any) => {
                switch (status) {
                    case Protocol.QueryStatus.SUCCESS:
                        snippet.setErrors([]);
                        snippet.setProofState(null);
                        snippet.setState(SnippetState.DONE);
                        break;
                    case Protocol.QueryStatus.FAILURE:
                        const response = payload.response;
                        debug(response);
                        this.annotateRanges(response);
                        snippet.setErrors(response);
                        this.cancelPending();
                        this.forget(snippet);
                        break;
                    case Protocol.QueryStatus.MESSAGE:
                        if (payload.level === "proof-state") {
                            snippet.setProofState(this.annotateProofState(payload.contents));
                        } else if (payload.level === "info") {
                            debug(payload.contents); // TODO
                        }
                        break;
                    default:
                        Utils.assert(false, "Unexpected status");
                }
            };
        }

        private postQuery(jsQuery: object) {
            this.postMessage({ kind: Protocol.ClientMessageKind.QUERY,
                               payload: jsQuery });
        }

        private push(snippet: TSnippet) {
            const qid = this.gensym();
            const code = snippet.getText();
            const line = snippet.idePrivateData.firstLine;
            this.postQuery(Client.mkQuery(qid, "push", { kind: "full", code, line, column: 0 }));
            this.callbacks.add(qid, this.makePushCallback(snippet));
            snippet.setState(SnippetState.BUSY);
        }

        private assertCanPop(snippet: TSnippet) {
            Utils.assert(this.snippets.contains(snippet));
            Utils.assert(snippet === this.snippets.last());
            Utils.assert(snippet.getState() !== SnippetState.BUSY);
        }

        private forget(snippet: TSnippet) {
            this.snippets.remove(snippet);
            snippet.setState(null);
        }

        private pop(snippet: TSnippet) {
            const qid = this.gensym();
            this.assertCanPop(snippet);
            Utils.assert(snippet.getState() === SnippetState.DONE);
            this.postQuery(Client.mkQuery(qid, "pop", {}));
            this.callbacks.add(qid, (status, _response) => {
                Utils.assert(status === Protocol.QueryStatus.SUCCESS);
            });
            // No need to wait for a confirmation when popping
            this.forget(snippet);
        }

        private popOrForget(snippet: TSnippet) {
            this.assertCanPop(snippet);
            if (snippet.getState() === SnippetState.DONE) {
                this.pop(snippet);
            } else {
                this.forget(snippet);
            }
        }

        private processPending() {
            if (this.busyWithSnippets()) {
                return;
            }

            const snippet = this.snippets.firstInState(SnippetState.PENDING);
            if (snippet !== undefined) {
                this.push(snippet);
            }
        }

        private cancelPending() {
            this.snippets
                .allInState(SnippetState.PENDING)
                .reverse().map(snippet => this.popOrForget(snippet));
        }

        public init(fcontents: string, args: string[]) {
            this.postMessage({ kind: Protocol.ClientMessageKind.INIT,
                               payload: { fname: this.fname, fcontents, args } });
        }

        public updateContents(fcontents: string) {
            this.postMessage({ kind: Protocol.ClientMessageKind.UPDATE_CONTENTS,
                               payload: { fcontents } });
        }

        private insertSnippet(snippet: TSnippet, parent: TSnippet | null) {
            let index, firstLine;
            if (parent == null) {
                Utils.assert(this.snippets.count() === 0);
                index = 0;
                firstLine = 1;
            } else {
                Utils.assert(this.snippets.count() > 0);
                Utils.assert(parent === this.snippets.last());
                index = this.snippets.index(parent) + 1;
                firstLine = parent.idePrivateData.firstLine + parent.idePrivateData.length;
            }

            this.snippets.insert(snippet, index);
            snippet.idePrivateData = {
                firstLine,
                length: Utils.countLines(snippet.getText())
            };
        }

        public submit(snippet: TSnippet, parent: TSnippet | null) {
            Utils.assert(!this.snippets.contains(snippet));
            Utils.assert(snippet.getState() == null);
            snippet.setState(SnippetState.PENDING);
            this.insertSnippet(snippet, parent);
            this.processPending();
        }

        private mayCancel(snippet: TSnippet): { success: boolean; reason?: string } {
            if (!this.snippets.contains(snippet)) {
                return { success: true };
            } else if (snippet.getState() === SnippetState.BUSY) {
                return { success: false,
                         reason: "Can't edit a snippet while processing it!"};
            } else if (snippet.getState() === SnippetState.DONE && this.busyWithSnippets()) {
                return { success: false,
                         reason: ("Can't edit a processed snippet while other " +
                                  "snippets are being processed!") };
            }

            return { success: true };
        }

        public cancel(snippet: TSnippet) {
            const cancellable = this.mayCancel(snippet);
            if (!cancellable.success) {
                return cancellable;
            }
            while (this.snippets.contains(snippet)) {
                this.popOrForget(this.snippets.last());
            }
            return { success: true };
        }
    }
}
