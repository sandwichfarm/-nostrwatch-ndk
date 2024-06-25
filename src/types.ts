import { RelayMonitorFetcher as LocalRelayMonitor } from './fetchers/relay-monitor';
import { RelayMonitor as NDKRelayMonitor } from '@nostr-dev-kit/ndk';

export type CombinedRelayMonitor = LocalRelayMonitor | NDKRelayMonitor;
export type CombinedRelayMonitorSet = Set<CombinedRelayMonitor>;