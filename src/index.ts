export { RelayMonitors as Nip66Fetcher } from './fetchers/relay-monitors';
export { RelayMonitorFetcher as RelayMonitor } from './fetchers/relay-monitor';

import type NDK from '@nostr-dev-kit/ndk';

import { RelayMeta } from '@nostr-dev-kit/ndk';

import { RelayMonitorFetcher as RelayMonitor } from './fetchers/relay-monitor';
import { RelayCache } from './cache/default-relay-cache';

import { RelayMonitors } from './fetchers/relay-monitors';
import { MonitorCache } from './cache/default-monitor-cache';

const NWKOptionsDefault: NWKOptions = { 
  explicitMonitors: [],
  monitorBias: MonitorBias.None,
  monitorBiasValue: undefined, 
  monitorCache: undefined
}

const enum MonitorBias {
  None = "none",
  Random = "random",
  Active = "active",
  Proximity = "proximity",
  Country = "country"
}

type NWKOptions = {
  explicitRelays?: string[],
  explicitMonitors?: string[],
  monitorBias: MonitorBias,
  monitorBiasValue?: string | number,
  monitorCache?: RelayCache
}

class NWK {
  private _ndk: NDK; 
  private _monitors: RelayMonitors;
  private _relays?: Map<string, RelayMeta>
  private _active_monitor?: RelayMonitor

  constructor( ndk: NDK, opts: NWKOptions ){
    this._ndk = ndk;
    this._monitors = new RelayMonitors( ndk )
  }

  set relayCache(cache: RelayCache){
    if(!this.activeMonitor) return 
    this.activeMonitor.cache = cache;
  }

  set monitorCache(cache: MonitorCache){

  }

  set activeMonitor(pubkey: RelayMonitor){
    this._active_monitor = pubkey
  }
  
  get monitors(): RelayMonitors {
    return this._monitors;
  }

  get relays(): Map<string, RelayMeta> | undefined {  
    return this._relays;
  }

  get activeMonitor(): RelayMonitor | undefined {
    return this._active_monitor
  }

  async populateMonitors(){
    this.monitors.populate();
  }

  populateRelays(){
    if(!this?.activeMonitor) return
    this.activeMonitor.load()
  }

  populateRelayMeta(){

  }

  ListMonitors(){
    return 
  }

  sortRelaysByDistance(){

  }

  sortRelaysBySpeed(){

  }
}