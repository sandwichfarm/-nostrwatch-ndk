import { RelayMonitorSet } from "../relay-fetcher";
import { MonitorRelayFetcher } from "..";

type RelayMonitorMap = Map<string, MonitorRelayFetcher>;

// Define the MonitorCacheInterface interface
export interface MonitorCacheInterface {
    set: (monitorEvent: MonitorRelayFetcher) => Promise<void>;
    get: (monitorPubkey: string) => Promise<MonitorRelayFetcher | undefined>;
    remove: (monitorPubkey: string) => Promise<boolean>;
    keys: () => Promise<Set<string>>;
    load: (monitorEvents: RelayMonitorSet) => Promise<void>;
    dump: () => Promise<RelayMonitorSet>;
    reset: () => Promise<void>;
    [key: string]: any;
}

export class MonitorCacheDefault implements MonitorCacheInterface {
    MonitorManager: RelayMonitorMap;

    constructor() {
        this.MonitorManager = new Map();
    }

    async set( monitorEvent: MonitorRelayFetcher ): Promise<void> {
        this.MonitorManager.set( monitorEvent.pubkey, monitorEvent as MonitorRelayFetcher );
    }

    async get( monitorPubkey: string ): Promise<MonitorRelayFetcher | undefined> {
        return this.MonitorManager.get(monitorPubkey)
    }

    async remove( monitorPubkey: string ): Promise<boolean> {
        return this.MonitorManager.delete(monitorPubkey);
    }

    async keys(): Promise<Set<string>> {
        const arr = Array.from(this.MonitorManager.values());
        const urls = arr.map(event => event.tags.find(tag => tag[0] === 'd')?.[1])
        return new Set(urls.filter((tag): tag is string => tag !== undefined));
    }

    async load( monitorEvents: RelayMonitorSet ): Promise<void> {
        monitorEvents?.forEach( event => {
            this.MonitorManager.set( event.pubkey, event as MonitorRelayFetcher );
        })
    }

    async dump(): Promise<RelayMonitorSet> {
        return new Set(this.MonitorManager.values())
    }

    async reset(): Promise<void> {
        this.MonitorManager.clear();
    }
}