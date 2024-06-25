import { RelayMonitorSet } from "../fetchers/relay-monitor";
import { RelayMonitor } from "..";

// Define the MonitorCacheSetter and MonitorCacheGetter function types
type MonitorCacheSetter = (monitorEvent: RelayMonitor) => Promise<void>;
type MonitorCacheGetter = (monitorPubkey: string) => Promise<RelayMonitor | undefined>;
type MonitorCacheKeyer = () => Promise< Set<string> >;
type MonitorCacheLoader = (monitorEvents: RelayMonitorSet) => Promise<void>;
type MonitorCacheDumper = () => Promise<RelayMonitorSet>;
type MonitorCacheReset = () => Promise<void>;

// Define the MonitorCache interface
export interface MonitorCache {
    set: MonitorCacheSetter;
    get: MonitorCacheGetter;
    keys: MonitorCacheKeyer;
    load: MonitorCacheLoader;
    dump: MonitorCacheDumper;
    reset: MonitorCacheReset;
}

export class MonitorCacheDefault implements MonitorCache {
    _events: Map<string, RelayMonitor>

    constructor() {
        this._events = new Map()
    }

    async set( monitorEvent: RelayMonitor ): Promise<void> {
        this._events.set( monitorEvent.pubkey, monitorEvent as RelayMonitor );
    }

    async get( monitorPubkey: string ): Promise<RelayMonitor | undefined> {
        return this._events.get(monitorPubkey)
    }

    async keys(): Promise<Set<string>> {
        const arr = Array.from(this._events.values());
        const urls = arr.map(event => event.tags.find(tag => tag[0] === 'd')?.[1])
        return new Set(urls.filter((tag): tag is string => tag !== undefined));
    }

    async load( monitorEvents: RelayMonitorSet ): Promise<void> {
        monitorEvents?.forEach( event => {
            this._events.set( event.pubkey, event as RelayMonitor );
        })
    }

    async dump(): Promise<RelayMonitorSet> {
        return new Set(this._events.values())
    }

    async reset(): Promise<void> {
        this._events.clear();
    }
}