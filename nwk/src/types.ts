import { MonitorRelayFetcher as LocalRelayMonitor } from './relay-fetcher';
import { RelayMonitor as NDKRelayMonitor } from '@nostr-dev-kit/ndk';

export type CombinedRelayMonitor = LocalRelayMonitor | NDKRelayMonitor;
export type CombinedRelayMonitorSet = Set<CombinedRelayMonitor>;