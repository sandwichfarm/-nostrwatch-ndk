
import { NDKKind } from '@nostr-dev-kit/ndk';
import type NDK from '@nostr-dev-kit/ndk';
import type { NDKFilter } from '@nostr-dev-kit/ndk';

import { NDKEventGeoCoded as EventGeoCoded, RelayMeta } from '@nostr-dev-kit/ndk';
import type { Coords } from '@nostr-dev-kit/ndk';

import { MonitorRelayFetcher, RelayMonitorDiscoveryTags } from './relay-fetcher';
import type { RelayMonitorSet, RelayListSet, RelayMonitorDiscoveryFilters, RelayMonitorCriterias } from './relay-fetcher';

import { MonitorCacheInterface, MonitorCacheDefault } from './cache/index';

import { MonitorFetcher, MonitorFetcherOptions } from './monitor-fetcher';

const MonitorFetcherOptionsDefaults: MonitorFetcherOptions = {
    activeOnly: true
}

type RelayAggregateMixed = RelayListSet | Set<RelayMeta> | undefined;

/**
 * 
 * const monitors = new NKRelayMonitor(ndk)
 * await monitors.populate()
 * monitors.
 */
export class MonitorManager {

    private _ndk: NDK;
    private _fetcher: MonitorFetcher;
    private _cache: MonitorCacheInterface;

    constructor( ndk: NDK, cache: MonitorCacheInterface, fetcherOptions: MonitorFetcherOptions = MonitorFetcherOptionsDefaults ){
        this._ndk = ndk;
        this._fetcher = new MonitorFetcher(this.ndk, fetcherOptions || {} as MonitorFetcherOptions)
        this._cache = new MonitorCacheDefault();
    }

    get ndk(): NDK {
        return this._ndk;
    }

    get fetch(): MonitorFetcher {
        return this._fetcher;
    }

    get fetchOptions(): MonitorFetcherOptions {
        return this.fetch.options;
    }

    set fetchrOptions( options: MonitorFetcherOptions ) {
        this.fetch.options = options;
    }

    get cache(): MonitorCacheInterface {
        return this._cache;
    }

    set cache( cache: MonitorCacheInterface ) {
        this._cache = cache;
    }

    resetMonitors(): void {
        this.cache.reset();
    }

    getMonitor( key: string ): Promise<MonitorRelayFetcher | undefined> {
        return this.cache.get( key );
    }

    loadMonitors( monitors: RelayMonitorSet ): void {
        if(!monitors?.size) return;
        this.cache.load( monitors );
    }

    set monitor( monitor: MonitorRelayFetcher ) {
        const pubkey = monitor.pubkey;
        this.cache.set( monitor );
    }

    get monitors(): Promise<RelayMonitorSet> {
        return this.cache.dump();
    }

    get monitorKeys(): Promise<Set<string>> {
        return this.cache.keys();
    }

    set monitors( monitors: RelayMonitorSet) {
        if(!monitors?.size) return;
        this.cache.reset();
        this.cache.load( monitors )
    }

    /**
     * @description Aggregates relay data based on the specified fetch method and options.
     * This method collects data from each monitor that meets the specified criteria
     * and aggregates it based on the `fetchAggregate` parameter.
     *
     * @param fetchAggregate - The aggregation method to be used for fetching data.
     * @param opts - Optional parameters including custom filters, criteria for monitor selection, and geospatial options for nearby search.
     * @returns A promise that resolves to a mixed set of relay data based on the specified aggregation method.
     * 
     * @todo fetchAggregate -> enum
     * @public
     * @async
     */
    async aggregate(fetchAggregate: string, opts?: MonitorFetcherOptions): Promise<RelayAggregateMixed | undefined> {
        const promises: Promise<RelayAggregateMixed>[] = [];
        const criterias = opts?.criterias || this.fetch.options?.criterias as RelayMonitorCriterias || undefined;
        const monitors: RelayMonitorSet = criterias ? await this.meetsCriterias(criterias) : await this.cache.dump();
    
        if (!monitors || monitors.size === 0) return undefined;
    
        monitors.forEach( (monitor: MonitorRelayFetcher) => {
            let result: Promise<RelayAggregateMixed> = Promise.resolve(undefined);
            switch (fetchAggregate) {
                case 'onlineList':
                    result = monitor.fetchOnlineRelays(opts?.customFilter);
                    break;
                case 'onlineMeta':
                    result = monitor.fetchOnlineRelaysMeta(opts?.customFilter);
                    break;
                case 'onlineListNearby':
                    if (!opts?.nearby) break;
                    result = monitor.fetchNearbyRelaysList(
                        opts?.nearby.geohash,
                        opts?.nearby?.maxPrecision,
                        opts?.nearby?.minPrecision,
                        opts?.nearby?.minResults,
                        opts?.nearby?.recurse,
                        opts?.customFilter
                    );
                    break;
            }
            promises.push(result);
        });
    
        const settledPromises = await Promise.allSettled(promises);
    
        const results = new Set<RelayAggregateMixed>();
        settledPromises.forEach((settled) => {
            if (settled.status === 'fulfilled' && settled.value) {
                results.add(settled.value);
            }
        });
    
        return results as unknown as RelayAggregateMixed; // Cast to the appropriate type
    }

    /**
     * @description Populates the internal set of monitors based on a custom filter and optionally filters for only active monitors.
     * This method fetches relay monitors matching the provided filter and updates the internal set of monitors.
     *
     * @param customFilter - A custom filter to apply when fetching monitors.
     * @param activeOnly - If true, only active monitors are considered.
     * @returns A promise that resolves once the internal set of monitors is populated.
     * 
     * @async
     */
    public async populate( customFilter: NDKFilter = {}, activeOnly: boolean = true ) {
        this.cache.reset(); 
        const events: RelayMonitorSet = await this.fetchMonitors(customFilter, activeOnly);
        if(!events?.size) return undefined;
        await this.cache.load(events)
        this._initMonitors();
    }

    /**
     * @description Populates the internal set of monitors based on specified criteria and optionally filters for only active monitors.
     * This method constructs a filter from the given criteria and fetches relay monitors that meet these criteria.
     *
     * @param criterias - Criteria used to filter the monitors.
     * @param activeOnly - If true, only active monitors are considered.
     * @returns A promise that resolves once the internal set of monitors is populated based on the criteria.
     * 
     * @async
     */
    public async populateByCriterias( criterias: RelayMonitorCriterias, activeOnly: boolean = true ) {
        const filter: NDKFilter = this._generateCriteriasFilter(criterias);
        this.populate( filter, activeOnly );
    }

    /**
     * @description Populates the internal set of monitors based on proximity to a given geohash and optionally appends a custom filter.
     * This method fetches relay monitors that are nearby the specified geohash and meets any additional specified criteria.
     *
     * @param geohash - The geohash representing the location to search near.
     * @param maxPrecision - The maximum precision of the geohash to consider.
     * @param minPrecision - The minimum precision of the geohash to consider.
     * @param minResults - The minimum number of results to return.
     * @param recurse - If true, recursively search for relays until the minimum number of results is met.
     * @param appendFilter - An optional filter to append to the default filter.
     * @param activeOnly - If true, only considers active monitors.
     * @returns A promise that resolves once the internal set of monitors is populated based on proximity.
     * @public
     * @async
     */
    public async populateNearby( geohash: string, maxPrecision: number = 5, minPrecision: number = 5, minResults: number = 5, recurse: boolean = false, appendFilter?: NDKFilter, activeOnly: boolean = false ) {
        this.cache.reset();  
        const _builtinFilter: NDKFilter = this._generateCriteriasFilter();
        const events: RelayMonitorSet = await this.fetchNearbyMonitors(geohash, maxPrecision, minPrecision, minResults, recurse, activeOnly, { ..._builtinFilter, ...appendFilter  });
        if(!events?.size) return undefined;
        this.cache.load(events)
        this._initMonitors();
    }

    /**
     * @description Filters the internal set of monitors based on the specified criteria.
     *
     * @param criterias - The criteria used to filter the monitors.
     * @returns A set of relay monitors that meet the specified criteria or undefined if no monitors meet the criteria.
     * @public
     */
    public async meetsCriterias( criterias: RelayMonitorCriterias ): Promise<RelayMonitorSet| undefined> {
        let monitors = await this.cache.dump()
        if(!monitors?.size) return undefined;
        return new Set(Array.from(monitors).filter( (monitor: MonitorRelayFetcher) => monitor.meetsCriterias(criterias) ));
    }

    /**
     * @description Retrieves the closest monitor to the specified coordinates that meets any provided criteria.
     * If no monitors meet the criteria or are close enough, returns undefined.
     *
     * @param coords - The coordinates used to find the closest monitor.
     * @param criterias - Optional criteria to filter monitors.
     * @param populate - If true, populates the internal set of monitors based on the criteria before searching.
     * @returns A promise that resolves to the closest monitor meeting the criteria, or undefined if no suitable monitor is found.
     * @public
     * @async
     */
    public async getClosestMonitor( coords: Coords, criterias?: RelayMonitorCriterias, populate: boolean = false ): Promise<MonitorRelayFetcher | undefined> {
        const _criterias = criterias || this.fetch.options?.criterias || {} as RelayMonitorCriterias;
        let monitors = await this.monitors
        if(!monitors?.size || populate) {
            await this.populateByCriterias( criterias || this?.fetch.options?.criterias as RelayMonitorCriterias);
        }
        monitors = await this.meetsCriterias(_criterias);
        if(!monitors?.size) return undefined;
        const sorted: RelayMonitorSet = MonitorManager.sortMonitorsByProximity(coords, monitors);
        return sorted?.values().next().value;
    };

    /**
     * @description Sorts monitors based on provided coordinates (DD or geohash) relative to the monitor's coordinates (if available)
     * 
     * @param {Coords} coords The coordinates to use for sorting.
     * @param {RelayMonitorSet} monitors A set of `MonitorRelayFetcher` objects to filter.
     * @returns Promise resolves to an array of `RelayListSet` objects.
     * 
     * @static
     * @async
     */
    static sortMonitorsByProximity( coords: Coords, monitors: RelayMonitorSet ): RelayMonitorSet | undefined {
        if(!monitors?.size) return undefined;
        const monitorsSorted = EventGeoCoded.sortGeospatial( coords, monitors as Set<EventGeoCoded> );
        return monitorsSorted as RelayMonitorSet;
    }

    /**
     * @description Initializes monitors by calling their `init` method if they have not been initialized yet.
     * This method iterates through all monitors and initializes each that hasn't been initialized.
     * The initialization process for each monitor is performed asynchronously, and this method
     * waits for all initialization promises to settle before completing.
     * 
     * @private
     * @async
     */
    private async _initMonitors(){
        const promises: Promise<void>[] = [];
        let monitors = await this.monitors
        if(!monitors?.size) return;
        monitors = await this.cache.dump()
        monitors?.forEach( async (monitor: MonitorRelayFetcher) => {
            if(!monitor.initialized){
                promises.push(monitor.init());
            }
        });
        await Promise.allSettled(promises);
    }

    /**
     * @description Generates a filter for relay monitor discovery based on specified criteria.
     * The method maps the provided criteria to their corresponding discovery tags
     * and constructs a filter object that can be used for relay monitor discovery.
     * If no criteria are provided, it defaults to using the criteria specified in
     * the instance's options, if available.
     * 
     * @param criterias - Optional. The criteria to generate the filter from.
     * @returns An object representing the filter for relay monitor discovery.
     * 
     * @private
     */
    private _generateCriteriasFilter( criterias?: RelayMonitorCriterias ): RelayMonitorDiscoveryFilters {
        const filter: RelayMonitorDiscoveryFilters = {};
        criterias = criterias || this.fetch.options?.criterias;
        if (!criterias) return filter;
        const keyMapping: Record<keyof RelayMonitorCriterias, RelayMonitorDiscoveryTags> = {
            kinds: RelayMonitorDiscoveryTags.kinds,
            checks: RelayMonitorDiscoveryTags.checks,
        };
        Object.entries(keyMapping).forEach(([optionKey, tagValue]) => {
            const filterKey = `#${tagValue}` as keyof RelayMonitorDiscoveryFilters;
            const originalValue = criterias?.[optionKey as keyof RelayMonitorCriterias];
            if (originalValue) {
                filter[filterKey] = originalValue.map(String);
            }
        });
        return filter;
    }
}