import { NDKRelaySet, RelayMeta, RelayMetaSet } from "@nostr-dev-kit/ndk";

// Define the RelayCacheSetter and RelayCacheGetter function types
type RelayCacheSetter = (relayMetaEvent: RelayMeta) => Promise<void>;
type RelayCacheGetter = (relayPubkey: string) => Promise<RelayMeta | undefined>;
type RelayCacheKeyer = () => Promise<string[]>;
type RelayCacheLoader = (relayEvents: RelayMetaSet) => Promise<void>;
type RelayCacheDumper = () => Promise<RelayMetaSet>;
type RelayCacheReset = () => Promise<void>;

// Define the RelayCache interface
export interface RelayCache {
    set: RelayCacheSetter;
    get: RelayCacheGetter;
    keys: RelayCacheKeyer;
    load: RelayCacheLoader;
    dump: RelayCacheDumper;
    reset: RelayCacheReset;
}

export class RelayCacheDefault implements RelayCache {
    private _events: Map<string, RelayMeta>

    constructor() {
        this._events = new Map()
    }

    async set( relayMetaEvent: RelayMeta ): Promise<void> {
        this._events.set( relayMetaEvent.pubkey, relayMetaEvent as RelayMeta );
    }

    async get( relayPubkey: string ): Promise<RelayMeta | undefined> {
        return this._events.get(relayPubkey)
    }

    async keys(): Promise<string[]> {
        const arr = Array.from(this._events.values());
        const urls = arr.map(event => event.tags.find(tag => tag[0] === 'd')?.[1])
        return urls.filter((tag): tag is string => tag !== undefined);
    }

    async load( relayEvents: RelayMetaSet ): Promise<void> {
        relayEvents?.forEach( event => {
            this._events.set( event.pubkey, event as RelayMeta );
        });
    }

    async dump(): Promise<RelayMetaSet> {
        return new Set(this._events.values())
    }

    async reset(): Promise<void> {
        this._events.clear();
    }
}