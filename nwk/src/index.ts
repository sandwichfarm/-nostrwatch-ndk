export * from './monitor-manager';
export * from './relay-fetcher';

// import type NDK from '@nostr-dev-kit/ndk';

// import { RelayMeta } from '@nostr-dev-kit/ndk';

// import { MonitorRelayFetcher } from './relay-fetcher';
// import { RelayCache } from './cache/default-relay-cache';

// import { MonitorManager } from './monitor-manager';
// import { MonitorCache } from './cache/default-monitor-cache';

// const NWDKOptionsDefault: NWDKOptions = { 
//   explicitMonitors: [],
//   monitorSelectionBias: MonitorSelectionBias.None,
//   monitorSelectionBiasValue: undefined, 
//   monitorCache: undefined
// }

// const enum MonitorSelectionBias {
//   None = "none",
//   Random = "random",
//   Proximity = "proximity",
//   Country = "country"
// }

// type NWDKOptions = {
//   explicitRelays?: string[],
//   explicitMonitors?: string[],
//   monitorSelectionBias: MonitorSelectionBias,
//   monitorSelectionBiasValue?: string | number,
//   monitorCache?: RelayCache
// }

// class NWDK {
//   private ndk: NDK; 
//   private activeMonitor: MonitorRelayFetcher | undefined;
//   private bias: MonitorSelectionBias;

//   private _monitors: MonitorManager;
//   private _relays?: Map<string, RelayMeta>
  

//   constructor( ndk: NDK, opts: NWDKOptions ){
//     this.ndk = ndk;
//     this._monitors = new MonitorManager( this.ndk )
//     this.bias = opts.monitorSelectionBias;
//   }

//   async init(){
//     await this.monitors.populate();
//     this.monitors.
//   }

//   async autoSelectMonitor(){

//   }

//   async selectMonitor(pubkey: string){
//     this.activeMonitor = await this.monitors.cache.get(pubkey)
//   }

//   set relayCache(cache: RelayCache){
//     if(!this.activeMonitor) return 
//     this.activeMonitor.cache = cache;
//   }

//   set monitorCache(cache: MonitorCache){
//     this.monitors.cache = cache;
//   }
  
//   get monitors(): MonitorManager {
//     return this._monitors;
//   }

//   get relays(): Map<string, RelayMeta> | undefined {  
//     return this._relays;
//   }


//   async populateMonitors(){
//     this.monitors.populate();
//   }

//   populateRelays(){
//     if(!this?.activeMonitor) return
//     this.activeMonitor.load()
//   }

//   populateRelayMeta(){

//   }

//   ListMonitors(){
//     return 
//   }

//   sortRelaysByDistance(){

//   }

//   sortRelaysBySpeed(){

//   }
// }