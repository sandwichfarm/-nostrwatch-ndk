import type NDK from '@nostr-dev-kit/ndk';
import type { NDKFilter, NDKKind } from '@nostr-dev-kit/ndk';
import { NDKEventGeoCoded as EventGeoCoded } from '@nostr-dev-kit/ndk';
import type { RelayMonitorSet, RelayListSet, RelayMonitorDiscoveryFilters, RelayMonitorCriterias, MonitorRelayFetcher } from './relay-fetcher';

export type MonitorFetcherOptions = {
  customFilter?: NDKFilter;
  builtinFilter?: RelayMonitorDiscoveryFilters;
  criterias?: RelayMonitorCriterias;
  nearby?: EventGeoCodedGeospatialOptions;
  activeOnly?: boolean;
}

export type EventGeoCodedGeospatialOptions = {
  geohash: string;
  maxPrecision?: number;
  minPrecision?: number; 
  minResults?: number;
  recurse?: boolean;
}

export class MonitorFetcher {
    private _ndk: NDK;
    private _options: MonitorFetcherOptions;

    constructor( ndk: NDK, options: MonitorFetcherOptions = MonitorFetcherOptionsDefaults ){
        this._options = options || {} as MonitorFetcherOptions;
        this._ndk = ndk;
    }

    get ndk(): NDK {
      return this._ndk;
    }

    set ndk(ndk: NDK) {
      this._ndk = ndk;
    }

    get options(): MonitorFetcherOptions {
      return this._options;
    }

    set options( options: MonitorFetcherOptions ) {
        this._options = options;
    }
    
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
          return MonitorFetcher.filterActiveMonitors(events);
      }
      return events;
  }

      /**
     * @description Filters monitors by their active state
     * 
     * @param {RelayMonitorSet} monitors A set of `MonitorRelayFetcher` objects to filter.
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
        _monitors.forEach( ($monitor: MonitorRelayFetcher)  => {
            if(!$monitor.active) {
                _monitors.delete($monitor);
            }
        });
        return new Set(_monitors) as RelayMonitorSet;
    }

  /**
   * @description Fetches monitors by a MonitorTag
   * 
   * @param {RelayMonitorSet} monitors A set of `MonitorRelayFetcher` objects to filter.
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
      const active = await MonitorFetcher.filterActiveMonitors( events );
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
          cb = async (events: Set<EventGeoCoded>) => await MonitorFetcher.filterActiveMonitors(events as RelayMonitorSet) || new Set();
      }
      const kinds: NDKKind[] = [ NDKKind.RelayMonitor ];
      const _filter: NDKFilter = { ...filter, kinds };
      const geocodedEvents = await EventGeoCoded.fetchNearby(this.ndk, geohash, _filter, { maxPrecision, minPrecision, minResults, recurse, callbackFilter: cb });
      const events: RelayMonitorSet= new Set(Array.from(geocodedEvents || new Set()).map( (event: EventGeoCoded) => (event as MonitorRelayFetcher) ));
      return events;
  }
}