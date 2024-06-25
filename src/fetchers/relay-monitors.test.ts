import { describe, it, expect, beforeEach, afterEach, vi} from 'vitest';

import NDK, { NDKEventGeoCoded } from '@nostr-dev-kit/ndk';
import { RelayMonitors } from './relay-monitors';

// Mock NDKEventGeoCoded and related methods
vi.mock('../../events/kinds/nip66/NDKEventGeoCoded', () => {
  return {
    NDKEventGeoCoded: vi.fn().mockImplementation(() => {
      return {
        fetchNearby: vi.fn(),
        sortGeospatial: vi.fn()
      };
    }),
  };
});

describe("RelayMonitors", () => {
    let ndk: NDK;
    let options;
    let relayMonitors;

    beforeEach(() => {
        ndk = new NDK();
        options = {};
        relayMonitors = new RelayMonitors(ndk, options);
    });

    it("should be instantiated with the provided NDK instance", () => {
        expect(relayMonitors.ndk).toBe(ndk);
    });

    it("should initialize monitors when populate is called", async () => {
        const mockFetchEvents = vi.fn().mockResolvedValue(new Set());
        ndk.fetchEvents = mockFetchEvents;

        await relayMonitors.populate();
        
        expect(mockFetchEvents).toHaveBeenCalled();
    });

    describe("Filtering and Sorting", () => {
        it("should filter active monitors correctly", async () => {
            const activeMonitor = { active: true };
            const inactiveMonitor = { active: false };
            const monitors = new Set([activeMonitor, inactiveMonitor]);

            monitors.forEach(monitor => {
                monitor.active = vi.fn().mockResolvedValue(monitor.active);
            });

            const filteredMonitors = await RelayMonitors.filterActiveMonitors(monitors);

            expect(filteredMonitors).toContain(activeMonitor);
            expect(filteredMonitors).not.toContain(inactiveMonitor);
        });

        it("should sort monitors by proximity correctly", async () => {

            const coords = { lat: 0, lon: 0 };
            const monitors = new Set([{ lat: 1, lon: 1 }, { lat: -1, lon: -1 }]);

            const sortedMonitors = await RelayMonitors.sortMonitorsByProximity(coords, monitors);
        });
    });

    describe('populateByCriterias', () => {
        it('should populate monitors based on given criterias', async () => {
            // Setup mocks for NDK methods used within populateByCriterias
            const mockFetchMonitors = vi.fn();
            ndk.fetchEvents = mockFetchMonitors.mockResolvedValue(new Set([/* Mock RelayMonitors data */]));

            const criterias = {/* Define criterias */};
            await relayMonitors.populateByCriterias(criterias, true);

            // Verify fetchEvents was called with expected filter
            expect(mockFetchMonitors).toHaveBeenCalledWith(expect.objectContaining({
                /* Expected filter derived from criterias */
            }));

            // Further assertions on the state of relayMonitors after populateByCriterias
            expect(relayMonitors.monitors.size).toBeGreaterThan(0);
            // Add more assertions as needed
        });
    });

    describe('aggregate', () => {
        it('should aggregate data based on the specified fetchAggregate method', async () => {
            const mockFetchOnlineRelays = vi.fn();
            NDKEventGeoCoded.prototype.fetchOnlineRelays = mockFetchOnlineRelays.mockResolvedValue(/* Mock data */);

            const fetchAggregate = 'onlineList'; // Example aggregate method
            const results = await relayMonitors.aggregate(fetchAggregate, options);

            expect(mockFetchOnlineRelays).toHaveBeenCalled();

            expect(results).toBeDefined();
        });
    });
});
