
import { NDKKind } from '@nostr-dev-kit/ndk';
import type NDK from '@nostr-dev-kit/ndk';
import type { NDKFilter } from '@nostr-dev-kit/ndk';

import { NDKEventGeoCoded as EventGeoCoded, RelayMeta } from '@nostr-dev-kit/ndk';
import type { Coords } from '@nostr-dev-kit/ndk';

import { RelayMonitorDiscoveryTags } from './relay-monitor';
import type { RelayMonitorSet, RelayMonitorFetcher as RelayMonitor, RelayListSet, RelayMonitorDiscoveryFilters, RelayMonitorCriterias } from './relay-monitor';

import { MonitorCache, MonitorCacheDefault } from '../cache/index';

type RelayMonitorsOptions = {
    customFilter?: NDKFilter;
    builtinFilter?: RelayMonitorDiscoveryFilters;
    criterias?: RelayMonitorCriterias;
    nearby?: EventGeoCodedGeospatialOptions;
    activeOnly?: boolean;
    cache?: MonitorCache;
}

type EventGeoCodedGeospatialOptions = {
    geohash: string;
    maxPrecision?: number;
    minPrecision?: number;
    minResults?: number;
    recurse?: boolean;
}

type RelayAggregateMixed = RelayListSet | Set<RelayMeta> | undefined;


/**
 * 
 * const monitors = new NKRelayMonitor(ndk)
 * await monitors.populate()
 * monitors.
 */
export class RelayMonitors {

    private _ndk: NDK;
    private _options: RelayMonitorsOptions;
    private _cache: MonitorCache;

    constructor( ndk: NDK, options?: RelayMonitorsOptions ){
        this._ndk = ndk;
        // this._events = new Set();
        this._options = options || {} as RelayMonitorsOptions;
        this._cache = new MonitorCacheDefault();
    }

    get ndk(): NDK {
        return this._ndk;
    }

    get options(): RelayMonitorsOptions {
        return this._options;
    }

    set options( options: RelayMonitorsOptions ) {
        this._options = options;
    }

    get cache(): MonitorCache {
        return this._cache;
    }

    set cache( cache: MonitorCache ) {
        this._cache = cache;
    }

    resetMonitors(): void {
        this.cache.reset();
    }

    getMonitor( key: string ): Promise<RelayMonitor | undefined> {
        return this.cache.get( key );
    }

    loadMonitors( monitors: RelayMonitorSet ): void {
        if(!monitors?.size) return;
        this.cache.load( monitors );
    }

    set monitor( monitor: RelayMonitor ) {
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
     * @public
     * @async
     */
    async aggregate(fetchAggregate: string, opts?: RelayMonitorsOptions): Promise<RelayAggregateMixed | undefined> {
        const promises: Promise<RelayAggregateMixed>[] = [];
        const criterias = opts?.criterias || this.options?.criterias as RelayMonitorCriterias || undefined;
        const monitors: RelayMonitorSet = criterias ? await this.meetsCriterias(criterias) : await this.cache.dump();
    
        if (!monitors || monitors.size === 0) return undefined;
    
        monitors.forEach( (monitor: RelayMonitor) => {
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
        return new Set(Array.from(monitors).filter( (monitor: RelayMonitor) => monitor.meetsCriterias(criterias) ));
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
    public async getClosestMonitor( coords: Coords, criterias?: RelayMonitorCriterias, populate: boolean = false ): Promise<RelayMonitor | undefined> {
        const _criterias = criterias || this.options?.criterias || {} as RelayMonitorCriterias;
        let monitors = await this.monitors
        if(!monitors?.size || populate) {
            await this.populateByCriterias( criterias || this?._options?.criterias as RelayMonitorCriterias);
        }
        monitors = await this.meetsCriterias(_criterias);
        if(!monitors?.size) return undefined;
        const sorted: RelayMonitorSet = RelayMonitors.sortMonitorsByProximity(coords, monitors);
        return sorted?.values().next().value;
    };

    /**
     * @description Fetches monitors with optional filter
     * 
     * @param {NDKFilter} filter The NDK instance to use for fetching events.
     * @param {boolean} activeOnly Return only active monitors.
     * @returns Promise resolves to an array of `RelayListSet` objects.
     * 
     * @public
     * @async
     */
    public async fetchMonitors( filter?: NDKFilter, activeOnly: boolean = true ): Promise<RelayMonitorSet> {
        if(!this.ndk){
            return undefined;
        }
        
        const kinds: NDKKind[] = [ NDKKind.RelayMonitor ];
        const _filter: NDKFilter = { ...filter, kinds };
        const events: RelayMonitorSet = await this.ndk.fetchEvents(_filter) as RelayMonitorSet;

        if(!events?.size) {
            return undefined;
        }
        if(activeOnly){
            return RelayMonitors.filterActiveMonitors(events);
        }
        return events;
    }

    /**
     * @description Fetches monitors by a MonitorTag
     * 
     * @param {RelayMonitorSet} monitors A set of `RelayMonitor` objects to filter.
     * @returns Promise resolves to an array of `RelayListSet` objects.
     * 
     * @public
     * @async
     */
    public async fetchMonitorsBy( monitorTags: RelayMonitorDiscoveryFilters, filter?: NDKFilter ): Promise<RelayMonitorSet> {
        const _filter: NDKFilter = { ...filter, ...monitorTags };
        const events: RelayMonitorSet = await this.fetchMonitors(_filter);
        return new Set(events) as RelayMonitorSet;
    }

    /**
     * @description Fetches monitors and sorts by distance with a given geohash
     * 
     * @param {NDK} ndk The NDK instance to use for fetching events.
     * @param {NDKFilter} filter An optional, additional filter to ammend to the default filter.
     * @returns Promise resolves to an array of `RelayListSet` objects.
     * 
     * @public
     * @async
     */
    public async fetchActiveMonitors( filter?: NDKFilter ): Promise<RelayMonitorSet> {
        if(!this.ndk){
            return undefined;
        }
        const events: RelayMonitorSet = await this.fetchMonitors(filter);
        if(!events?.size) return undefined;
        const active = await RelayMonitors.filterActiveMonitors( events );
        return active?.size? active: undefined;
    }

    /**
     * @description Fetches monitors and sorts by distance with a given geohash
     * 
     * @param {string} geohash The geohash that represents the location to search for relays.
     * @param {number} maxPrecision The maximum precision of the geohash to search for.
     * @param {number} minPrecision The minimum precision of the geohash to search for.
     * @param {number} minResults The minimum number of results to return.
     * @param {boolean} recurse Recusively search for relays until results  >= minResults
     * @param {boolean} activeOnly Filter out inactive monitors.
     * @param {NDKFilter} filter An optional, additional filter to ammend to the default filter. 
     * @returns Promise resolves to an array of `RelayListSet` objects.
     * 
     * @public
     * @async
     */
    public async fetchNearbyMonitors( geohash: string, maxPrecision: number = 5, minPrecision: number = 5, minResults: number = 5, recurse: boolean = false, activeOnly: boolean = false, filter?: NDKFilter ): Promise<RelayMonitorSet> {
        if(!this.ndk){
            return undefined;
        }
        let cb = async (evs: Set<EventGeoCoded>) => evs;
        if(activeOnly){
            cb = async (events: Set<EventGeoCoded>) => await RelayMonitors.filterActiveMonitors(events as RelayMonitorSet) || new Set();
        }
        const kinds: NDKKind[] = [ NDKKind.RelayMonitor ];
        const _filter: NDKFilter = { ...filter, kinds };
        const geocodedEvents = await EventGeoCoded.fetchNearby(this.ndk, geohash, _filter, { maxPrecision, minPrecision, minResults, recurse, callbackFilter: cb });
        const events: RelayMonitorSet= new Set(Array.from(geocodedEvents || new Set()).map( (event: EventGeoCoded) => (event as RelayMonitor) ));
        return events;
    }

    /**
     * @description Filters monitors by their active state
     * 
     * @param {RelayMonitorSet} monitors A set of `RelayMonitor` objects to filter.
     * @returns Promise resolves to an array of `RelayListSet` objects.
     * 
     * @public
     * @async
     */
    static async filterActiveMonitors( monitors: RelayMonitorSet): Promise<RelayMonitorSet> {
        if(!monitors?.size) return undefined;
        const _monitors: RelayMonitorSet = new Set(Array.from(monitors)); //deref
        const promises = [];
        for ( const $monitor of _monitors) {
            promises.push($monitor.isMonitorActive());  
        }
        await Promise.allSettled(promises); 
        _monitors.forEach( ($monitor: RelayMonitor)  => {
            if(!$monitor.active) {
                _monitors.delete($monitor);
            }
        });
        return new Set(_monitors) as RelayMonitorSet;
    }

    /**
     * @description Sorts monitors based on provided coordinates (DD or geohash) relative to the monitor's coordinates (if available)
     * 
     * @param {Coords} coords The coordinates to use for sorting.
     * @param {RelayMonitorSet} monitors A set of `RelayMonitor` objects to filter.
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
        monitors?.forEach( async (monitor: RelayMonitor) => {
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
        criterias = criterias || this.options?.criterias;
        if (!criterias) return filter;
        const keyMapping: Record<keyof RelayMonitorCriterias, RelayMonitorDiscoveryTags> = {
            kinds: RelayMonitorDiscoveryTags.kinds,
            operator: RelayMonitorDiscoveryTags.operator, 
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