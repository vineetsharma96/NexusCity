import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Vector3 } from 'three';

async function systems() {
  const data = new Map();
  const events = [];
  globalThis.localStorage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) };
  globalThis.window = { dispatchEvent: (event) => { events.push(event); return true; } };
  const result = await build({
    stdin: { resolveDir: process.cwd(), contents: `
      export { SaveSystem } from './src/core/SaveSystem';
      export { LivingCityEventSystem } from './src/world/LivingCityEventSystem';
      export { DialogueSystem } from './src/npc/DialogueSystem';
      export {
        VehicleInteractionSystem,
        DEFAULT_CAR_PERFORMANCE_SPEC,
        SOLARIS_CAR_PERFORMANCE_SPEC,
      } from './src/vehicle/VehicleInteractionSystem';
      export { InteractionSystem } from './src/interaction/InteractionSystem';
      export { TerminalSystem } from './src/interaction/TerminalSystem';
      export { NavigationSystem } from './src/map/NavigationSystem';
      export { DiscoverySystem } from './src/world/DiscoverySystem';
      export { AudioManager } from './src/audio/AudioManager';
      export { AmbientAudioManager } from './src/audio/AmbientAudioManager';
      export { TimeSystem } from './src/world/TimeSystem';
      export { NPCManager } from './src/npc/NPCManager';
      export { CityGenerator } from './src/city/CityGenerator';
      export { ProceduralChunkGenerator } from './src/city/ProceduralChunkGenerator';
      export { WeatherSystem } from './src/world/WeatherSystem';
      export { WindSystem } from './src/world/WindSystem';
      export { TrafficLightSystem } from './src/city/TrafficLightSystem';
      export { EmergencyAlertSystem } from './src/world/EmergencyAlertSystem';
      export { WorldPhysicsEngine } from './src/world/WorldPhysicsEngine';
      export { InputManager } from './src/player/InputManager';
      export {
        createSculptedHypercarBodyGeometry,
        createTeardropCanopyGeometry,
        createSculptedTireGeometry,
        createAirfoilWingGeometry,
      } from './src/vehicle/ExperimentalCarGeometry';
      export {
        createSolarisFormulaFuselageGeometry,
        createSolarisSidepodGeometry,
        createSolarisCanopyGeometry,
        createSolarisTireGeometry,
        createSolarisDorsalFinGeometry,
        createSolarisAirbrakeFlapGeometry,
      } from './src/vehicle/SolarisCarGeometry';
      export {
        createTrafficCarModelSet,
        createSkyCruiserGeometry,
      } from './src/city/TrafficCarGeometry';
      export {
        createInitialTrafficFleet,
        stepTrafficFleet,
        buildIntersectionTurnBezier,
        getRightHandLaneOffset,
        getHeadingYaw,
      } from './src/city/TrafficNavigation';
      export { isPointOnAnyRoad } from './src/city/WorldRoadClearance';
      export { VegetationGenerator } from './src/city/VegetationGenerator';
      export { TransitScheduleSystem } from './src/vehicle/TransitScheduleSystem';
      export {
        createSmoothBeveledBoxGeometry,
        createSmoothBuildingPrismGeometry,
        createSmoothFoliageCrownGeometry,
        createSmoothHoverCoupeGeometry,
        createSmoothMagShuttleGeometry,
      } from './src/rendering/SmoothWorldGeometries';
    ` },
    bundle: true, platform: 'node', format: 'esm', write: false,
  });
  // Each import receives fresh singleton state, matching a fresh browser session.
  const url = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}#${Math.random()}`;
  return { ...(await import(url)), data, events };
}

test('save load rejects malformed coordinates and collection fields, caps upgrades', async () => {
  const { SaveSystem, data } = await systems();
  data.set('nexus_city_flagship_save_v2', JSON.stringify({ version: 2, player: { position: [0, 'bad', 10], rotationY: 'bad' }, discoveredDistricts: null, discoveredLandmarks: null, cityHistory: null, terminalObjectives: null, stats: { distanceTraveledMeters: 'bad' }, vehicleUpgrades: { speed: 999, handling: true, neon: -4 } }));
  const save = SaveSystem.getInstance();
  assert.deepEqual(save.getData().player.position, [0, 0.2, 10]);
  assert.equal(save.getData().player.rotationY, 0);
  assert.deepEqual(save.getData().vehicleUpgrades, { speed: 3, handling: 1, neon: 0 });
  assert.equal(save.getData().stats.distanceTraveledMeters, 0);
  assert.doesNotThrow(() => save.updateDistrict('NEURAL_DISTRICT'));
  assert.doesNotThrow(() => save.recordHistory('test', 'TEST', 'Valid history after recovery'));
});

test('emergency alert system transitions through expected states based on weather and time', async () => {
  const { EmergencyAlertSystem, WeatherSystem, TimeSystem, data } = await systems();
  const alert = EmergencyAlertSystem.getInstance();
  const weather = WeatherSystem.getInstance();
  const time = TimeSystem.getInstance();

  // Reset state
  alert.update(weather.getState(), time.getState());

  // 1. Default (NOMINAL)
  weather.setWeather('CLEAR');
  time.setTime(12.0); // Noon
  alert.update(weather.getState(), time.getState());
  assert.equal(alert.getState().active, false);
  assert.equal(alert.getState().level, 'NOMINAL');
  assert.equal(alert.getState().kind, 'NONE');

  // 2. Storm Advisory (CRITICAL, STORM)
  weather.setWeather('HEAVY_RAIN');
  alert.update(weather.getState(), time.getState());
  assert.equal(alert.getState().active, true);
  assert.equal(alert.getState().level, 'CRITICAL');
  assert.equal(alert.getState().kind, 'STORM');

  // Also check lightning trigger
  weather.setWeather('CLEAR');
  alert.update({ ...weather.getState(), lightningFlash: 0.3 }, time.getState());
  assert.equal(alert.getState().active, true);
  assert.equal(alert.getState().level, 'CRITICAL');
  assert.equal(alert.getState().kind, 'STORM');

  // 3. Visibility Advisory (ADVISORY, VISIBILITY)
  weather.setWeather('FOG');
  alert.update({ ...weather.getState(), lightningFlash: 0.0 }, time.getState());
  assert.equal(alert.getState().active, true);
  assert.equal(alert.getState().level, 'ADVISORY');
  assert.equal(alert.getState().kind, 'VISIBILITY');

  // 4. Curfew Advisory (ADVISORY, CURFEW)
  weather.setWeather('CLEAR');
  time.setTime(23.5); // Night time (>= 23 or < 4)
  // Ensure night state triggers properly by using dummy WeatherState
  alert.update(weather.getState(), { ...time.getState(), isNight: true, hours: 23 });
  assert.equal(alert.getState().active, true);
  assert.equal(alert.getState().level, 'ADVISORY');
  assert.equal(alert.getState().kind, 'CURFEW');

  alert.update(weather.getState(), { ...time.getState(), isNight: true, hours: 2 });
  assert.equal(alert.getState().active, true);
  assert.equal(alert.getState().level, 'ADVISORY');
  assert.equal(alert.getState().kind, 'CURFEW');

  // 5. Back to NOMINAL
  alert.update(weather.getState(), { ...time.getState(), isNight: false, hours: 12 });
  assert.equal(alert.getState().active, false);
  assert.equal(alert.getState().level, 'NOMINAL');
  assert.equal(alert.getState().kind, 'NONE');
});

test('distance statistics use loaded location and resume after long teleports', async () => {
  const { SaveSystem, data } = await systems();
  data.set('nexus_city_flagship_save_v2', JSON.stringify({ version: 2, player: { position: [500, 0.2, 10] } }));
  const save = SaveSystem.getInstance();
  try {
    save.updatePlayerPosition(new Vector3(501, 0.2, 10));
    assert.equal(save.getData().stats.distanceTraveledMeters, 1);
    save.updatePlayerPosition(new Vector3(1000, 0.2, 10));
    save.updatePlayerPosition(new Vector3(1002, 0.2, 10));
    assert.equal(save.getData().stats.distanceTraveledMeters, 3);
    save.updatePlayerPosition(new Vector3(NaN, 0, 0));
    assert.deepEqual(save.getData().player.position, [1002, 0.2, 10]);
  } finally { clearTimeout(save.autoSaveTimer); }
});

test('city event IDs stay stable inside a phase across later cycles', async () => {
  const { LivingCityEventSystem, events } = await systems();
  const director = LivingCityEventSystem.getInstance();
  for (let i = 0; i < 469; i++) director.update(0.25);
  const id = director.getState().id;
  assert.equal(director.getState().type, 'PUBLIC_FESTIVAL');
  for (let i = 0; i < 20; i++) director.update(0.25);
  assert.equal(director.getState().id, id);
  assert.equal(events.filter((event) => event.detail?.title === 'NEXUS NIGHT MARKET // CITY BROADCAST').length, 2);
});

test('dialogue choices resolve shared node IDs within the current speaker', async () => {
  const { DialogueSystem } = await systems();
  const dialogue = DialogueSystem.getInstance();
  for (const speaker of ['first', 'second']) dialogue.registerConversation({ npcId: speaker, startNodeId: 'intro', nodes: { intro: { id: 'intro', speaker, role: 'Resident', text: 'Hello', choices: [{ text: 'Continue', nextNodeId: 'shared' }] }, shared: { id: 'shared', speaker, role: 'Resident', text: speaker, choices: [] } } });
  dialogue.startDialogue('second');
  dialogue.selectChoice(dialogue.getActiveNode().choices[0]);
  assert.equal(dialogue.getActiveNode().speaker, 'second');
});

test('vehicle exits preserve parked position and transit links follow shuttle position', async () => {
  const { VehicleInteractionSystem, InteractionSystem } = await systems();
  const vehicle = VehicleInteractionSystem.getInstance();
  const interactions = InteractionSystem.getInstance();
  const parked = new Vector3(4.5, 0.45, 10);
  vehicle.registerRideable('hover', 'Hovercraft', parked, 'vehicle');
  interactions.updatePlayerPosition(parked);
  assert.equal(interactions.triggerInteract(), true);
  assert.equal(vehicle.getState().mode, 'RIDING');
  vehicle.dismount();
  assert.equal(vehicle.getState().mode, 'ON_FOOT');
  assert.equal(vehicle.getVehiclePosition().y, 0.45);
  assert.equal(vehicle.getDismountPosition().y, 0);
  assert.notEqual(vehicle.getDismountPosition().x, parked.x);
  const node = new Vector3(-7, 0.2, 10);
  vehicle.registerRideable('transit', 'Transit', node, 'transit');
  interactions.updatePlayerPosition(node);
  interactions.triggerInteract();
  vehicle.syncTransitPosition(new Vector3(32, 0.62, 10), Math.PI / 2);
  assert.equal(vehicle.getState().mode, 'TRANSIT_LINKED');
  assert.equal(vehicle.getMountedPosition().x, 32);
  assert.equal(vehicle.getState().vehicleRotationY, Math.PI / 2);
  interactions.updatePlayerPosition(vehicle.getMountedPosition());
  assert.equal(interactions.getActive().actionText, 'RELEASE TRANSIT LINK');
});

test('weather auto-cycle advances from the manually selected weather', async () => {
  const { WeatherSystem } = await systems();
  const weather = WeatherSystem.getInstance();
  weather.setWeather('HEAVY_RAIN', true);
  weather.update(90);
  assert.equal(weather.getState().currentWeather, 'FOG');
});

test('weather system tracks snow and rain intensity and syncs telemetry metrics', async () => {
  const { WeatherSystem } = await systems();
  const weather = WeatherSystem.getInstance();
  weather.setWeather('SNOW');
  const snowState = weather.getState();
  assert.equal(snowState.currentWeather, 'SNOW');
  assert.ok(snowState.snowIntensity > 0.5);
  assert.equal(snowState.rainIntensity, 0);
  assert.ok(snowState.precipitationIntensity > 0.5);
  assert.ok(snowState.temperatureC < 0);

  weather.setPrecipitationIntensity(0.9, 'SNOW');
  assert.equal(weather.getState().currentWeather, 'BLIZZARD');
  assert.equal(weather.getState().snowIntensity, 0.9);
  assert.ok(weather.getState().precipitationRateMmHr > 15);

  weather.setPrecipitationIntensity(0.45, 'RAIN');
  assert.equal(weather.getState().currentWeather, 'RAIN');
  assert.equal(weather.getState().rainIntensity, 0.45);
  assert.equal(weather.getState().snowIntensity, 0);
  weather.setWeather('CLEAR');
});

test('navigation and discovery share targets and initialize route distance immediately', async () => {
  const { NavigationSystem, DiscoverySystem } = await systems();
  const nav = NavigationSystem.getInstance();
  nav.setDestination('park_sanctuary', new Vector3(0, 0.2, 0));
  assert.equal(nav.getState().distance, 106);
  assert.ok(nav.getState().routeWaypoints.length > 1);
  const discovery = DiscoverySystem.getInstance();
  for (const trigger of discovery.triggers) assert.deepEqual(trigger.position.toArray(), nav.landmarks.find((landmark) => landmark.id === trigger.id).position.toArray());
  nav.updatePlayerPosition(new Vector3(75, 0.2, 75));
  assert.equal(nav.getState().activeLandmark, null);
  assert.equal(nav.getState().distance, 0);
});

test('saved telemetry objectives resume and replacement deactivates the old objective', async () => {
  const { SaveSystem, TerminalSystem, InteractionSystem } = await systems();
  const save = SaveSystem.getInstance();
  const original = { terminalId: 'first', objectiveId: 'scan_first', title: 'SCAN', detail: 'Telemetry', kind: 'SCAN', revealed: true, active: true, updatedAt: 1 };
  save.setTerminalObjective(original);
  const terminals = TerminalSystem.getInstance();
  assert.equal(terminals.getActiveObjective().terminalId, 'first');
  const position = new Vector3(10, 0.2, 10);
  terminals.register({ id: 'second', name: 'Second Terminal', position, district: 'CENTRAL' });
  const interaction = InteractionSystem.getInstance();
  interaction.updatePlayerPosition(position);
  interaction.triggerInteract();
  assert.equal(save.getTerminalObjectives().first.active, false);
  assert.equal(terminals.getActiveObjective().terminalId, 'second');
});

test('audio preserves a saved zero volume', async () => {
  const { AudioManager, data } = await systems();
  data.set('nexus_audio_volume', '0');
  assert.equal(AudioManager.getInstance().getSettings().masterVolume, 0);
});

test('ambient audio manager adapts traffic, wind, rain, and drone levels to time of day and weather', async () => {
  const { AudioManager, AmbientAudioManager, TimeSystem, WeatherSystem } = await systems();
  const audio = AudioManager.getInstance();
  const ambient = AmbientAudioManager.getInstance();
  const time = TimeSystem.getInstance();
  const weather = WeatherSystem.getInstance();

  // Clear daytime (13:00): high traffic hum, zero rain, low nocturnal drone, street lights OFF
  time.setTime(13.0);
  assert.equal(time.getState().streetLightsOn, false);
  time.setTime(21.5);
  assert.equal(time.getState().streetLightsOn, true);
  time.setTime(13.0);
  weather.setWeather('CLEAR');
  const dayClear = audio.updateAmbientSoundscape(0.1, time.getState(), weather.getState());
  assert.equal(dayClear.activePhase, 'DAY');
  assert.equal(dayClear.activeWeather, 'CLEAR');
  assert.ok(dayClear.trafficLevel >= 0.7);
  assert.equal(dayClear.rainLevel, 0);

  // Nocturnal monsoon storm (23:00 + HEAVY_RAIN): sparse traffic, elevated wind & rain, thunder trigger on lightning flash
  time.setTime(23.0);
  weather.setWeather('HEAVY_RAIN');
  for (let i = 0; i < 30; i++) weather.update(0.5);
  const nightStorm = audio.updateAmbientSoundscape(0.1, time.getState(), {
    ...weather.getState(),
    rainIntensity: 1.0,
    wetnessFactor: 1.0,
    lightningFlash: 0.95,
  });
  assert.equal(nightStorm.activePhase, 'NIGHT');
  assert.equal(nightStorm.activeWeather, 'HEAVY_RAIN');
  assert.ok(nightStorm.trafficLevel < dayClear.trafficLevel);
  assert.ok(nightStorm.windLevel > dayClear.windLevel);
  assert.equal(nightStorm.rainLevel, 1);
  assert.ok(nightStorm.nocturneDroneLevel > dayClear.nocturneDroneLevel);
  assert.equal(nightStorm.thunderCount, 1);

  // Individual channel toggles mute specific layers
  ambient.updateChannelSettings({ trafficEnabled: false, windEnabled: false });
  const mutedTraffic = audio.updateAmbientSoundscape(0.1, time.getState(), weather.getState());
  assert.equal(mutedTraffic.trafficLevel, 0);
  assert.equal(mutedTraffic.windLevel, 0);
});

test('quality-culled citizens cannot remain invisible interaction targets', async () => {
  const { NPCManager, InteractionSystem } = await systems();
  const npcs = NPCManager.getInstance();
  const visible = npcs.npcs[0];
  npcs.setRenderedNpcs([visible]);
  assert.deepEqual(npcs.getRenderedNpcs().map((npc) => npc.id), [visible.id]);
  const interactions = InteractionSystem.getInstance();
  const hidden = npcs.npcs.find((npc) => npc.position.distanceTo(visible.position) > 8);
  interactions.updatePlayerPosition(hidden.position);
  assert.equal(interactions.getActive(), null);
  interactions.updatePlayerPosition(visible.position);
  assert.equal(interactions.getActive().id, visible.id);
});

test('generated building footprints keep the dedicated sanctuary clear', async () => {
  const { CityGenerator } = await systems();
  const city = CityGenerator.generateDistrict();
  assert.ok(city.buildings.length > 0);
  for (const building of city.buildings) for (const box of building.collisionBounds) {
    assert.ok(box.max.x <= 39 || box.min.x >= 111 || box.max.z <= 39 || box.min.z >= 111);
  }
});

test('switching weather to FOG immediately activates high fog density and WindSystem scales wind velocity', async () => {
  const { WeatherSystem, WindSystem } = await systems();
  const weather = WeatherSystem.getInstance();
  assert.equal(weather.getState().fogDensityMultiplier, 1.0);

  weather.setWeather('FOG');
  assert.equal(weather.getState().currentWeather, 'FOG');
  assert.ok(weather.getState().fogDensityMultiplier > 5.0);

  const wind = WindSystem.getInstance();
  wind.setWindMultiplier(0.5);
  wind.update(0.1, 0);
  const calmSpeed = wind.getSpeed();

  wind.setWindMultiplier(2.5);
  wind.update(0.1, 0);
  const tempestSpeed = wind.getSpeed();
  assert.ok(tempestSpeed > calmSpeed * 3.5);
});

test('time-of-day system smoothly interpolates sun position, sky palette, and global illumination synchronized with environment settings', async () => {
  const { TimeSystem } = await systems();
  const time = TimeSystem.getInstance();

  // Dawn (06:00): sun near eastern horizon (+X), golden hour active, warm low Kelvin color temperature
  time.setTime(6.2);
  const dawn = time.getState();
  assert.equal(dawn.phase, 'SUNRISE');
  assert.ok(dawn.sunDirection.x > 0.9);
  assert.ok(Math.abs(dawn.sunElevationDeg) < 12);
  assert.ok(dawn.goldenHourFactor > 0.9);
  assert.ok(dawn.colorTemperatureK <= 2800);

  // Noon/Zenith (12:00 - 13:00): high sun elevation, bright GI bounce and hemisphere illumination
  time.setTime(12.5);
  const zenith = time.getState();
  assert.equal(zenith.phase, 'DAY');
  assert.ok(zenith.sunElevationDeg > 70);
  assert.ok(zenith.sunIntensity > dawn.sunIntensity);
  assert.ok(zenith.hemiIntensity > dawn.hemiIntensity);
  assert.ok(zenith.giBounceIntensity > dawn.giBounceIntensity);
  assert.notEqual(zenith.skyTopColor, dawn.skyTopColor);
  assert.notEqual(zenith.skyMidColor, dawn.skyMidColor);

  // Synchronizing with heavy rain & fog attenuates direct sun and shifts sky/fog palette
  const clearZenithSun = zenith.sunIntensity;
  const clearZenithTop = zenith.skyTopColor;
  time.syncEnvironment({
    rainIntensity: 0.9,
    fogDensityMultiplier: 5.2,
    districtFogColor: '#0b1326',
    cityEventLightScale: 0.85,
  });
  const stormZenith = time.getState();
  assert.ok(stormZenith.sunIntensity < clearZenithSun * 0.6);
  assert.notEqual(stormZenith.skyTopColor, clearZenithTop);
});

test('pedestrian AI spawns moving sidewalk citizens, obeys crosswalk walk signals, and pauses near player', async () => {
  const { NPCManager, TrafficLightSystem } = await systems();
  const npcs = NPCManager.getInstance();
  const lights = TrafficLightSystem.getInstance();

  assert.equal(npcs.npcs.length, 40);
  const ambient = npcs.npcs.filter((n) => !n.isStoryNpc);
  assert.equal(ambient.length, 36);

  // Verify citizens span diverse sidewalk route types
  const routeTypes = new Set(ambient.map((n) => n.routeType));
  assert.ok(routeTypes.has('NS_AVENUE'));
  assert.ok(routeTypes.has('EW_AVENUE'));
  assert.ok(routeTypes.has('BLOCK_PERIMETER'));
  assert.ok(routeTypes.has('PARK_PROMENADE'));
  assert.ok(routeTypes.has('CROSSWAY_LOOP'));

  // Verify citizens advance along their sidewalk waypoints when player is far away
  const farPlayer = new Vector3(500, 0, 500);
  const sampleCitizen = ambient.find((n) => n.routeType === 'BLOCK_PERIMETER');
  const startPos = sampleCitizen.position.clone();
  npcs.update(0.1, farPlayer);
  assert.ok(sampleCitizen.position.distanceTo(startPos) > 0.05);
  assert.equal(sampleCitizen.isWalking, true);

  // Verify crosswalk signal obedience: when ewWalk is false (t = 1.0s), a pedestrian at (-9.8, 0.2, -9.8) heading to (+9.8, 0.2, -9.8) waits at the curb
  lights.update(1.0); // nsWalk = true, ewWalk = false
  sampleCitizen.position.set(-9.8, 0.2, -9.8);
  sampleCitizen.waypoints = [new Vector3(-9.8, 0.2, -9.8), new Vector3(9.8, 0.2, -9.8)];
  sampleCitizen.currentWaypointIdx = 1;
  sampleCitizen.waitTimer = 0;
  npcs.update(0.1, farPlayer);
  assert.equal(sampleCitizen.aiState, 'WAIT_CROSSWALK');
  assert.equal(sampleCitizen.isWalking, false);

  // Advance traffic light to ewWalk = true (t = 13.0s) and verify pedestrian resumes walking across the street
  lights.update(12.0);
  assert.equal(lights.getState().ewWalk, true);
  npcs.update(0.1, farPlayer);
  assert.equal(sampleCitizen.isWalking, true);

  // Verify citizen pauses and faces player when player approaches within 2.6m
  const closePlayer = sampleCitizen.position.clone().add(new Vector3(1.2, 0, 0));
  npcs.update(0.1, closePlayer);
  assert.equal(sampleCitizen.aiState, 'CONVERSING');
  assert.equal(sampleCitizen.isWalking, false);
});

test('world road layers, central avenues, and streamed chunks stay cleanly separated and keep (0, 240) and (75, 75) parks clear', async () => {
  const { CityGenerator, ProceduralChunkGenerator } = await systems();
  const city = CityGenerator.generateDistrict();

  // Verify NS vs EW road vertical separation, widened roadway widths, and park sanctuary road exclusions
  for (const road of city.avenues) {
    const isEW = Math.abs(road.rotationY) > 0.1;
    assert.ok(Math.abs(road.position.y - (isEW ? 0.045 : 0.02)) < 1e-4, `Road Y mismatch: ${road.position.y}`);

    const isGrandBoulevard = (!isEW && Math.abs(road.position.x) < 1) || (isEW && Math.abs(road.position.z) < 1);
    assert.ok(
      road.size.x >= (isGrandBoulevard ? 22 : 18),
      `Expected wide road width >= ${isGrandBoulevard ? 22 : 18}m, got ${road.size.x}m`
    );

    const halfX = (isEW ? road.size.z : road.size.x) / 2;
    const halfZ = (isEW ? road.size.x : road.size.z) / 2;
    const minX = road.position.x - halfX;
    const maxX = road.position.x + halfX;
    const minZ = road.position.z - halfZ;
    const maxZ = road.position.z + halfZ;

    // Must not overlap (0, 240) Park Sanctuary
    const overlapsNorthPark = maxX > -35 && minX < 35 && maxZ > 205 && minZ < 275;
    assert.equal(overlapsNorthPark, false, `Road overlaps (0, 240) park: (${road.position.x}, ${road.position.z})`);

    // Must not overlap (75, 75) Park Sanctuary
    const overlapsEastPark = maxX > 40 && minX < 110 && maxZ > 40 && minZ < 110;
    assert.equal(overlapsEastPark, false, `Road overlaps (75, 75) park: (${road.position.x}, ${road.position.z})`);

    // Secondary central avenues (±75, ±165) stay bounded inside the Central District core [-174..174]
    if (!isEW && Math.abs(road.position.x) > 10) {
      assert.ok(minZ >= -174.5 && maxZ <= 174.5, `Secondary NS road leaked outside core: [${minZ}, ${maxZ}]`);
    }
    if (isEW && Math.abs(road.position.z) > 10) {
      assert.ok(minX >= -174.5 && maxX <= 174.5, `Secondary EW road leaked outside core: [${minX}, ${maxX}]`);
    }
  }

  // Verify streamed chunks near (0, 240) and along the Grand Boulevards have zero overlaps
  const sampleChunks = [
    [0, 1],
    [-1, 1],
    [0, 2],
    [-1, 2],
    [2, 2],
  ];
  for (const [cx, cz] of sampleChunks) {
    const chunk = ProceduralChunkGenerator.getChunkData(cx, cz);

    for (const r of chunk.roads) {
      const isEW = Math.abs(r.rotationY) > 0.1;
      assert.ok(Math.abs(r.position.y - (isEW ? 0.045 : 0.02)) < 1e-4);
      assert.ok(r.size.x >= (isEW ? 18 : 20), `Expected wide streamed chunk road, got ${r.size.x}m`);
    }
    for (const j of chunk.junctions) {
      assert.ok(Math.abs(j.position.y - 0.072) < 1e-4);
    }
    for (const sw of chunk.sidewalks) {
      const minX = sw.position.x - sw.size.x / 2;
      const maxX = sw.position.x + sw.size.x / 2;
      const minZ = sw.position.z - sw.size.z / 2;
      const maxZ = sw.position.z + sw.size.z / 2;

      // Sidewalks must not encroach onto the widened 22m Grand Boulevards ([-11..11])
      const overlapsGrandNS = maxX > -11 && minX < 11;
      const overlapsGrandEW = maxZ > -11 && minZ < 11;
      assert.equal(overlapsGrandNS, false, `Chunk (${cx},${cz}) sidewalk overlaps x=0 Grand Boulevard`);
      assert.equal(overlapsGrandEW, false, `Chunk (${cx},${cz}) sidewalk overlaps z=0 Grand Boulevard`);

      // Sidewalks must not intrude into the (0, 240) Park Sanctuary
      const overlapsNorthPark = maxX > -37 && minX < 37 && maxZ > 203 && minZ < 277;
      assert.equal(overlapsNorthPark, false, `Chunk (${cx},${cz}) sidewalk overlaps (0, 240) park`);
    }
  }
});

test('world physics engine computes air resistance, weather-coupled air density, and surface friction across world zones', async () => {
  const { WorldPhysicsEngine, WeatherSystem, WindSystem } = await systems();
  const physics = WorldPhysicsEngine.getInstance();
  const weather = WeatherSystem.getInstance();
  const wind = WindSystem.getInstance();

  weather.setWeather('CLEAR');
  const dryAsphalt = physics.getSurfaceAt(0, 10);
  const dryPark = physics.getSurfaceAt(75, 75);
  const clearRho = physics.getAirDensity();
  assert.equal(dryAsphalt.type, 'ASPHALT');
  assert.equal(dryPark.type, 'PARK_GRASS');
  assert.ok(dryAsphalt.frictionMu > dryPark.frictionMu);
  assert.ok(dryPark.rollingResistance > dryAsphalt.rollingResistance);

  // Heavy rain & blizzard reduce road traction and cold temperatures raise air density
  weather.setWeather('BLIZZARD');
  const snowAsphalt = physics.getSurfaceAt(0, 10);
  const coldRho = physics.getAirDensity();
  assert.ok(snowAsphalt.frictionMu < dryAsphalt.frictionMu * 0.6);
  assert.ok(coldRho > clearRho);

  // Moving body slows cleanly under quadratic air drag + ground rolling friction
  weather.setWeather('CLEAR');
  wind.setWindMultiplier(0);
  wind.update(0.1, 0);
  const vel = new Vector3(0, 0, 25);
  const profile = { massKg: 1460, dragCoefficient: 0.27, frontalAreaM2: 2.18, surfaceFrictionScale: 1.0 };
  const step = physics.applyWorldForcesToVelocity(vel, 0, 10, profile, 0.05, true, 0, true);
  assert.ok(step.dragForceN > 100, `Expected measurable aero drag at 25 m/s, got ${step.dragForceN}N`);
  assert.ok(step.frictionForceN > 100, `Expected measurable rolling friction, got ${step.frictionForceN}N`);
  assert.ok(vel.z < 25 && vel.z > 0);
});

test('experimental car drives forward, steers, brakes, engages reverse gear with backward wheel spin, and decelerates via world drag/friction', async () => {
  const { VehicleInteractionSystem, InteractionSystem, InputManager, WeatherSystem } = await systems();
  const vehicle = VehicleInteractionSystem.getInstance();
  const interactions = InteractionSystem.getInstance();
  WeatherSystem.getInstance().setWeather('CLEAR');

  const spawnPos = new Vector3(-8.8, 0.02, 5.5);
  vehicle.registerRideable('vx-01-experimental', 'VX-01 Apex Prototype', spawnPos, 'vehicle', Math.PI, 'car');
  interactions.updatePlayerPosition(spawnPos);
  assert.equal(interactions.triggerInteract(), true);
  assert.equal(vehicle.getState().mode, 'RIDING');
  assert.equal(vehicle.getState().variant, 'car');

  // 1. Accelerate forward + steer left
  InputManager.setVirtualMovement(-0.5, 1.0);
  for (let i = 0; i < 30; i++) {
    vehicle.updateMounted(0.033, 0);
  }
  const afterAccel = vehicle.getTelemetry();
  assert.ok(afterAccel.forwardSpeedMs > 5, `Expected forward speed > 5 m/s, got ${afterAccel.forwardSpeedMs}`);
  assert.ok(afterAccel.wheelSpinRad > 1.0, `Expected positive wheel spin, got ${afterAccel.wheelSpinRad}`);
  assert.ok(afterAccel.steeringAngle > 0.05, `Expected front steering angle > 0, got ${afterAccel.steeringAngle}`);
  assert.equal(afterAccel.gear, 'D');
  assert.ok(afterAccel.dragForceN > 0);

  // 2. Apply brakes from forward speed -> isBraking = true & negative longitudinalAccelG
  InputManager.setVirtualMovement(0, -1.0);
  for (let i = 0; i < 6; i++) {
    vehicle.updateMounted(0.033, 0);
  }
  const whileBraking = vehicle.getTelemetry();
  assert.equal(whileBraking.isBraking, true);
  assert.ok(whileBraking.longitudinalAccelG < 0, `Expected negative G while braking, got ${whileBraking.longitudinalAccelG}`);

  // 3. Continue holding backward -> smoothly transitions into Reverse gear with backward wheel spin
  const spinBeforeReverse = vehicle.getTelemetry().wheelSpinRad;
  for (let i = 0; i < 45; i++) {
    vehicle.updateMounted(0.033, 0);
  }
  const whileReversing = vehicle.getTelemetry();
  assert.equal(whileReversing.gear, 'R');
  assert.equal(whileReversing.isReversing, true);
  assert.ok(whileReversing.forwardSpeedMs < -2.0, `Expected negative reverse speed, got ${whileReversing.forwardSpeedMs}`);
  assert.ok(whileReversing.wheelSpinRad < spinBeforeReverse, 'Expected wheelSpinRad to decrease when reversing');

  // 4. Release pedals -> WorldPhysicsEngine air drag & rolling friction decelerates the car naturally
  const speedBeforeCoast = Math.abs(vehicle.getTelemetry().forwardSpeedMs);
  InputManager.setVirtualMovement(0, 0);
  for (let i = 0; i < 30; i++) {
    vehicle.updateMounted(0.033, 0);
  }
  const speedAfterCoast = Math.abs(vehicle.getTelemetry().forwardSpeedMs);
  assert.ok(speedAfterCoast < speedBeforeCoast, `Expected coast deceleration via drag/friction (${speedBeforeCoast} -> ${speedAfterCoast})`);

  vehicle.dismount();
});

test('sculpted experimental car geometry generates finite smooth outward normals, clear wheel arches, and compound curvature', async () => {
  const {
    createSculptedHypercarBodyGeometry,
    createTeardropCanopyGeometry,
    createSculptedTireGeometry,
    createAirfoilWingGeometry,
  } = await systems();

  const body = createSculptedHypercarBodyGeometry();
  const canopy = createTeardropCanopyGeometry();
  const tire = createSculptedTireGeometry(0.37, 0.29);
  const wing = createAirfoilWingGeometry(2.02);

  for (const geo of [body, canopy, tire, wing]) {
    const pos = geo.getAttribute('position');
    const norm = geo.getAttribute('normal');
    assert.ok(pos && pos.count > 100);
    assert.ok(norm && norm.count === pos.count);
    for (let i = 0; i < pos.count; i++) {
      assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i)));
      assert.ok(Number.isFinite(norm.getX(i)) && Number.isFinite(norm.getY(i)) && Number.isFinite(norm.getZ(i)));
    }
  }

  body.computeBoundingBox();
  assert.ok(body.boundingBox.min.y >= 0.16, `Expected clean underbody clearance >= 0.16m, got ${body.boundingBox.min.y}`);
  assert.ok(body.boundingBox.max.y >= 0.85, `Expected sculpted fender haunch height >= 0.85m, got ${body.boundingBox.max.y}`);
  assert.ok(body.boundingBox.max.z > 2.3 && body.boundingBox.min.z < -2.25);

  const canopyPos = canopy.getAttribute('position');
  const canopyNorm = canopy.getAttribute('normal');
  let maxCrownY = -Infinity;
  let crownNormalY = 0;
  for (let i = 0; i < canopyPos.count; i++) {
    if (canopyPos.getY(i) > maxCrownY) {
      maxCrownY = canopyPos.getY(i);
      crownNormalY = canopyNorm.getY(i);
    }
  }
  assert.ok(maxCrownY > 1.1 && maxCrownY < 1.25, `Expected sleek canopy height, got ${maxCrownY}`);
  assert.ok(crownNormalY > 0.8, `Expected outward upward normal on canopy crown, got ${crownNormalY}`);

  // Verify outward normals on body top centerline (+Y) and flanks (+X/-X)
  const bodyPos = body.getAttribute('position');
  const bodyNorm = body.getAttribute('normal');
  let rightFlankSamples = 0;
  let rightFlankOutward = 0;
  for (let i = 0; i < bodyPos.count; i++) {
    const x = bodyPos.getX(i);
    const y = bodyPos.getY(i);
    const z = bodyPos.getZ(i);
    if (Math.abs(z) < 0.8 && x > 0.75 && y > 0.35 && y < 0.65) {
      rightFlankSamples++;
      if (bodyNorm.getX(i) > 0.5) rightFlankOutward++;
    }
  }
  assert.ok(rightFlankSamples > 10 && rightFlankOutward === rightFlankSamples, 'Expected outward normals on sculpted body flanks');

  body.dispose();
  canopy.dispose();
  tire.dispose();
  wing.dispose();
});

test('AX-09 Solaris Formula-X geometry generates finite smooth outward normals, elongated silhouette, and zero block artifacts', async () => {
  const {
    createSolarisFormulaFuselageGeometry,
    createSolarisSidepodGeometry,
    createSolarisCanopyGeometry,
    createSolarisTireGeometry,
    createSolarisDorsalFinGeometry,
    createSolarisAirbrakeFlapGeometry,
  } = await systems();

  const body = createSolarisFormulaFuselageGeometry();
  const sidepod = createSolarisSidepodGeometry(1);
  const canopy = createSolarisCanopyGeometry();
  const tire = createSolarisTireGeometry(0.39, 0.31);
  const dorsalFin = createSolarisDorsalFinGeometry();
  const airbrake = createSolarisAirbrakeFlapGeometry(1);

  for (const geo of [body, sidepod, canopy, tire, dorsalFin, airbrake]) {
    const pos = geo.getAttribute('position');
    const norm = geo.getAttribute('normal');
    assert.ok(pos && pos.count > 40);
    assert.ok(norm && norm.count === pos.count);
    for (let i = 0; i < pos.count; i++) {
      assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i)));
      assert.ok(Number.isFinite(norm.getX(i)) && Number.isFinite(norm.getY(i)) && Number.isFinite(norm.getZ(i)));
    }
  }

  body.computeBoundingBox();
  const bodyLength = body.boundingBox.max.z - body.boundingBox.min.z;
  assert.ok(bodyLength > 5.0, `Expected elongated Formula-X fuselage > 5.0m, got ${bodyLength}`);
  assert.ok(body.boundingBox.min.y >= 0.14, `Expected clean underbody clearance >= 0.14m, got ${body.boundingBox.min.y}`);
  assert.ok(body.boundingBox.max.y >= 1.1, `Expected sculpted roll-hoop airbox >= 1.1m, got ${body.boundingBox.max.y}`);

  const canopyPos = canopy.getAttribute('position');
  const canopyNorm = canopy.getAttribute('normal');
  let maxCrownY = -Infinity;
  let crownNormalY = 0;
  for (let i = 0; i < canopyPos.count; i++) {
    if (canopyPos.getY(i) > maxCrownY) {
      maxCrownY = canopyPos.getY(i);
      crownNormalY = canopyNorm.getY(i);
    }
  }
  assert.ok(maxCrownY > 0.95 && maxCrownY < 1.28, `Expected low-slung fighter canopy height, got ${maxCrownY}`);
  assert.ok(crownNormalY > 0.75, `Expected outward upward normal on Solaris canopy crown, got ${crownNormalY}`);

  const sidepodPos = sidepod.getAttribute('position');
  const sidepodNorm = sidepod.getAttribute('normal');
  let rightFlankSamples = 0;
  let rightFlankOutward = 0;
  for (let i = 0; i < sidepodPos.count; i++) {
    const x = sidepodPos.getX(i);
    const y = sidepodPos.getY(i);
    const z = sidepodPos.getZ(i);
    if (Math.abs(z + 0.4) < 0.7 && x > 0.85 && y > 0.28 && y < 0.58) {
      rightFlankSamples++;
      if (sidepodNorm.getX(i) > 0.2) rightFlankOutward++;
    }
  }
  assert.ok(rightFlankSamples > 10 && rightFlankOutward === rightFlankSamples, 'Expected outward normals on Solaris sidepod flank');

  body.dispose();
  sidepod.dispose();
  canopy.dispose();
  tire.dispose();
  dorsalFin.dispose();
  airbrake.dispose();
});

test('AX-09 Solaris has distinct speed/acceleration/braking/reverse/telemetry from VX-01 and outer chunks emit Grand Boulevard junction pads', async () => {
  const {
    VehicleInteractionSystem,
    DEFAULT_CAR_PERFORMANCE_SPEC,
    SOLARIS_CAR_PERFORMANCE_SPEC,
    InteractionSystem,
    InputManager,
    WeatherSystem,
    ProceduralChunkGenerator,
  } = await systems();

  WeatherSystem.getInstance().setWeather('CLEAR');

  const simulateProfile = (id, label, spec, spawnX) => {
    const vehicle = VehicleInteractionSystem.getInstance();
    const interactions = InteractionSystem.getInstance();
    const spawnPos = new Vector3(spawnX, 0.02, 5.0);
    vehicle.registerRideable(id, label, spawnPos, 'vehicle', Math.PI, 'car', spec);
    interactions.updatePlayerPosition(spawnPos);
    assert.equal(interactions.triggerInteract(), true);
    const mountedState = vehicle.getState();

    // 1. Launch acceleration test (1.0s full throttle)
    InputManager.setVirtualMovement(0, 1);
    for (let i = 0; i < 30; i++) {
      vehicle.updateMounted(1 / 30, 0);
    }
    const afterLaunchMs = vehicle.getTelemetry().forwardSpeedMs;

    // 2. Cruise top speed (5.0s full throttle)
    for (let i = 0; i < 150; i++) {
      vehicle.updateMounted(1 / 30, 0);
    }
    const cruiseTopMs = vehicle.getTelemetry().forwardSpeedMs;

    // 3. Hard braking test (0.5s full brake from cruise)
    const beforeBrakeMs = cruiseTopMs;
    InputManager.setVirtualMovement(0, -1);
    for (let i = 0; i < 15; i++) {
      vehicle.updateMounted(1 / 30, 0);
    }
    const brakeDropMs = beforeBrakeMs - vehicle.getTelemetry().forwardSpeedMs;

    // 4. Reverse top speed (continue holding reverse for 3.5s)
    for (let i = 0; i < 105; i++) {
      vehicle.updateMounted(1 / 30, 0);
    }
    const reverseSpeedMs = Math.abs(vehicle.getTelemetry().forwardSpeedMs);
    const reverseGear = vehicle.getTelemetry().gear;

    InputManager.setVirtualMovement(0, 0);
    vehicle.dismount();
    vehicle.unregisterRideable(id);

    return {
      codeName: mountedState.carCodeName,
      accentColor: mountedState.carAccentColor,
      afterLaunchMs,
      cruiseTopMs,
      brakeDropMs,
      reverseSpeedMs,
      reverseGear,
    };
  };

  const vx01 = simulateProfile('vx-01-test', 'VX-01 Apex Prototype', DEFAULT_CAR_PERFORMANCE_SPEC, -8.8);
  const solaris = simulateProfile('ax-09-test', 'AX-09 Solaris Prototype', SOLARIS_CAR_PERFORMANCE_SPEC, 8.8);

  assert.equal(vx01.codeName, 'VX-01');
  assert.equal(vx01.accentColor, '#38bdf8');
  assert.equal(solaris.codeName, 'AX-09');
  assert.equal(solaris.accentColor, '#f59e0b');
  assert.equal(solaris.reverseGear, 'R');

  assert.ok(solaris.afterLaunchMs > vx01.afterLaunchMs + 3.0, `Expected Solaris faster launch (${solaris.afterLaunchMs} vs ${vx01.afterLaunchMs})`);
  assert.ok(solaris.cruiseTopMs > vx01.cruiseTopMs + 5.0, `Expected Solaris higher cruise top speed (${solaris.cruiseTopMs} vs ${vx01.cruiseTopMs})`);
  assert.ok(solaris.brakeDropMs > vx01.brakeDropMs + 2.0, `Expected Solaris stronger braking (${solaris.brakeDropMs} vs ${vx01.brakeDropMs})`);
  assert.ok(solaris.reverseSpeedMs > vx01.reverseSpeedMs + 2.0, `Expected Solaris higher reverse speed (${solaris.reverseSpeedMs} vs ${vx01.reverseSpeedMs})`);
  assert.ok(SOLARIS_CAR_PERFORMANCE_SPEC.maxBoostSpeedMs > DEFAULT_CAR_PERFORMANCE_SPEC.maxBoostSpeedMs + 10);
  assert.ok(SOLARIS_CAR_PERFORMANCE_SPEC.aeroDownforceCoeff > DEFAULT_CAR_PERFORMANCE_SPEC.aeroDownforceCoeff);

  // Verify outer streamed chunks generate junction pads over the x=0 and z=0 Grand Boulevards at y=0.072
  const northChunk = ProceduralChunkGenerator.getChunkData(0, 2);
  const eastChunk = ProceduralChunkGenerator.getChunkData(2, 0);
  const northBlvdPad = northChunk.junctions.find(
    (j) => Math.abs(j.position.x) < 0.01 && Math.abs(j.position.z - 300) < 0.01,
  );
  const eastBlvdPad = eastChunk.junctions.find(
    (j) => Math.abs(j.position.x - 300) < 0.01 && Math.abs(j.position.z) < 0.01,
  );
  assert.ok(northBlvdPad && Math.abs(northBlvdPad.position.y - 0.072) < 0.001, 'Expected outer north chunk Grand Boulevard junction pad at y=0.072');
  assert.ok(eastBlvdPad && Math.abs(eastBlvdPad.position.y - 0.072) < 0.001, 'Expected outer east chunk Grand Boulevard junction pad at y=0.072');
});

test('NPC traffic car models (SEDAN, SUV, COUPE, VAN) and sky cruiser are smooth, grounded, and distinct', async () => {
  const { createTrafficCarModelSet, createSkyCruiserGeometry } = await systems();
  const archetypes = ['SEDAN', 'SUV', 'COUPE', 'VAN'];
  const dims = {};

  for (const arch of archetypes) {
    const model = createTrafficCarModelSet(arch);
    for (const partName of ['bodyGeo', 'glassGeo', 'wheelsGeo', 'headlightGeo', 'taillightGeo']) {
      const geo = model[partName];
      const pos = geo.getAttribute('position');
      const norm = geo.getAttribute('normal');
      assert.ok(pos && pos.count > 0, `Expected vertices for ${arch}.${partName}`);
      assert.ok(norm && norm.count === pos.count, `Expected smooth normals for ${arch}.${partName}`);
      for (let i = 0; i < pos.count; i++) {
        assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i)));
        assert.ok(Number.isFinite(norm.getX(i)) && Number.isFinite(norm.getY(i)) && Number.isFinite(norm.getZ(i)));
      }
      geo.computeBoundingBox();
    }

    // Sculpted loft body must have high smooth vertex count (not a boxy 24-vertex cube)
    assert.ok(model.bodyGeo.getAttribute('position').count >= 400, `Expected smooth sculpted loft for ${arch}.bodyGeo`);

    // Wheels must sit grounded at y ≈ 0
    const wheelBox = model.wheelsGeo.boundingBox;
    assert.ok(Math.abs(wheelBox.min.y) < 0.04, `Expected ${arch} wheels grounded near y=0, got ${wheelBox.min.y}`);
    assert.ok(wheelBox.max.y > 0.5, `Expected realistic wheel diameter for ${arch}`);

    const bodyBox = model.bodyGeo.boundingBox;
    const cabinBox = model.glassGeo.boundingBox;
    dims[arch] = {
      height: Math.max(bodyBox.max.y, cabinBox.max.y),
      length: bodyBox.max.z - bodyBox.min.z,
      width: bodyBox.max.x - bodyBox.min.x,
    };

    model.bodyGeo.dispose();
    model.glassGeo.dispose();
    model.wheelsGeo.dispose();
    model.headlightGeo.dispose();
    model.taillightGeo.dispose();
  }

  // Distinct vehicle silhouettes across the 4 NPC car classes
  assert.ok(dims.VAN.height > dims.SEDAN.height + 0.25, `Expected VAN taller than SEDAN (${dims.VAN.height} vs ${dims.SEDAN.height})`);
  assert.ok(dims.SUV.height > dims.SEDAN.height + 0.12, `Expected SUV taller than SEDAN (${dims.SUV.height} vs ${dims.SEDAN.height})`);
  assert.ok(dims.SEDAN.height > dims.COUPE.height + 0.08, `Expected SEDAN taller than COUPE (${dims.SEDAN.height} vs ${dims.COUPE.height})`);
  assert.ok(dims.VAN.length > dims.COUPE.length + 0.4, `Expected VAN longer than COUPE (${dims.VAN.length} vs ${dims.COUPE.length})`);

  const cruiser = createSkyCruiserGeometry();
  assert.ok(cruiser.fuselageGeo.getAttribute('position').count >= 120, 'Expected smooth sculpted sky cruiser fuselage');
  assert.ok(cruiser.canopyGeo.getAttribute('position').count > 0);
  assert.ok(cruiser.wingGeo.getAttribute('position').count > 0);
  assert.ok(cruiser.thrusterGeo.getAttribute('position').count > 0);
  cruiser.fuselageGeo.dispose();
  cruiser.canopyGeo.dispose();
  cruiser.wingGeo.dispose();
  cruiser.thrusterGeo.dispose();
});

test('NPC traffic obeys multi-intersection traffic lights, queues cleanly, executes smooth Bezier turns, and avoids parks', async () => {
  const {
    TrafficLightSystem,
    createInitialTrafficFleet,
    stepTrafficFleet,
    getRightHandLaneOffset,
    getHeadingYaw,
  } = await systems();

  const lights = TrafficLightSystem.getInstance();

  // 1. Multi-intersection green-wave signal phases
  const plazaSig = lights.getSignalAtIntersection(0, 0);
  const northSig = lights.getSignalAtIntersection(0, 75);
  assert.equal(plazaSig.nsSignal, 'GREEN');
  assert.equal(plazaSig.ewSignal, 'RED');
  assert.equal(northSig.nsSignal, 'RED');
  assert.equal(northSig.ewSignal, 'GREEN');

  const redStop = lights.evaluateStopControl('EW', -28, 1, 0, 22, 0);
  assert.equal(redStop.shouldStop, true);
  assert.equal(redStop.signal, 'RED');
  const clearedStop = lights.evaluateStopControl('EW', -15, 1, 0, 22, 0);
  assert.equal(clearedStop.shouldStop, false);
  const greenStop = lights.evaluateStopControl('NS', -28, 1, 0, 22, 0);
  assert.equal(greenStop.shouldStop, false);

  // 2. Red-light stopping & same-lane queuing without stacking
  const laneOff = getRightHandLaneOffset('EW', 1, 0, 0);
  const lead = {
    id: 1,
    archetype: 'SEDAN',
    archetypeIndex: 0,
    axis: 'EW',
    avenueCoord: 0,
    dir: 1,
    laneIndex: 0,
    coord: -34,
    x: -34,
    z: laneOff,
    yaw: getHeadingYaw('EW', 1),
    roll: 0,
    pitch: 0,
    speed: 13,
    maxSpeed: 14,
    isBraking: false,
    bodyColor: '#cbd5e1',
    trimColor: '#f8fafc',
    length: 4.58,
    activeTurn: null,
    plannedIntersection: 0,
    plannedManeuver: 'LEFT',
    decisionSeed: 1,
  };
  const follower = {
    ...lead,
    id: 2,
    archetype: 'SUV',
    coord: -46,
    x: -46,
    length: 4.82,
    plannedManeuver: 'STRAIGHT',
  };

  const queuePair = [lead, follower];
  for (let i = 0; i < 140; i++) {
    stepTrafficFleet(queuePair, { dt: 1 / 30, lights });
  }
  assert.ok(lead.speed < 0.08, `Expected lead car stopped at RED light, got speed=${lead.speed}`);
  assert.equal(lead.isBraking, true);
  assert.ok(lead.x < -17.5 && lead.x > -24.0, `Expected lead car stopped cleanly before crosswalk stop bar, got x=${lead.x}`);
  assert.ok(follower.speed < 0.08, `Expected follower stopped behind lead car, got speed=${follower.speed}`);
  assert.equal(follower.isBraking, true);
  assert.ok(lead.x - follower.x >= (lead.length + follower.length) * 0.5 + 1.8, `Expected non-overlapping queue gap, got ${lead.x - follower.x}`);

  // 3. Switch EW signal to GREEN and verify smooth C1 Bezier LEFT turn onto NS Northbound lane
  lights.update(13.0);
  assert.equal(lights.getSignalAtIntersection(0, 0).ewSignal, 'GREEN');

  let enteredTurn = false;
  let maxYawStep = 0;
  let maxAbsRoll = 0;
  let prevYaw = lead.yaw;

  for (let i = 0; i < 200; i++) {
    stepTrafficFleet([lead], { dt: 1 / 30, lights });
    if (lead.activeTurn) enteredTurn = true;
    let dYaw = lead.yaw - prevYaw;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    maxYawStep = Math.max(maxYawStep, Math.abs(dYaw));
    maxAbsRoll = Math.max(maxAbsRoll, Math.abs(lead.roll));
    prevYaw = lead.yaw;
  }

  assert.equal(enteredTurn, true, 'Expected car to enter smooth Bezier turn after GREEN light');
  assert.equal(lead.activeTurn, null, 'Expected car to finish turn cleanly');
  assert.equal(lead.axis, 'NS', 'Expected LEFT turn from Eastbound EW to land on NS');
  assert.equal(lead.dir, -1, 'Expected LEFT turn from Eastbound EW to head North (-Z)');
  assert.ok(maxYawStep < 0.22, `Expected continuous smooth turning without heading snap, got maxYawStep=${maxYawStep}`);
  assert.ok(maxAbsRoll > 0.004, `Expected subtle suspension body roll during cornering, got maxAbsRoll=${maxAbsRoll}`);
  const expectedDestX = getRightHandLaneOffset('NS', -1, 0, 0);
  assert.ok(Math.abs(lead.x - expectedDestX) < 0.35, `Expected car aligned in destination right-hand lane x=${expectedDestX}, got ${lead.x}`);

  // 4. Full 88-car fleet diversity & park sanctuary avoidance over 10s of live cycling lights
  const fleet = createInitialTrafficFleet(88);
  const seenArchetypes = new Set(fleet.map((c) => c.archetype));
  assert.deepEqual([...seenArchetypes].sort(), ['COUPE', 'SEDAN', 'SUV', 'VAN']);

  for (let tick = 0; tick < 300; tick++) {
    lights.update(1 / 30);
    stepTrafficFleet(fleet, { dt: 1 / 30, lights });
    for (const c of fleet) {
      const inEastPark = Math.abs(c.x - 75) < 20 && Math.abs(c.z - 75) < 20;
      const inNorthPark = Math.abs(c.x) < 18 && c.z > 210 && c.z < 270;
      assert.equal(inEastPark, false, `NPC car ${c.id} entered East Park Sanctuary at (${c.x.toFixed(1)}, ${c.z.toFixed(1)})`);
      assert.equal(inNorthPark, false, `NPC car ${c.id} entered North Park Sanctuary at (${c.x.toFixed(1)}, ${c.z.toFixed(1)})`);
    }
  }
});

test('World map road clearance guarantees zero static objects on any central or streamed roadway', async () => {
  const {
    CityGenerator,
    ProceduralChunkGenerator,
    VegetationGenerator,
    TransitScheduleSystem,
    isPointOnAnyRoad,
  } = await systems();

  // 1. Sanity-check road corridor detector on known asphalt vs sidewalk points
  assert.equal(isPointOnAnyRoad(0, -40, 0), true, 'Grand Boulevard NS centerline must register as road');
  assert.equal(isPointOnAnyRoad(-5.6, -22, 0), true, 'Inner Grand Boulevard driving lane must register as road');
  assert.equal(isPointOnAnyRoad(75, -95, 0), true, 'Secondary avenue x=75 must register as road');
  assert.equal(isPointOnAnyRoad(180, 0, 0), true, 'Outer streamed NS/EW crossing at (180,0) must register as road');
  assert.equal(isPointOnAnyRoad(75, 75, 0), false, 'East Park Sanctuary interior must not register as road');
  assert.equal(isPointOnAnyRoad(0, 240, 0), false, 'North Park Sanctuary interior must not register as road');
  assert.equal(isPointOnAnyRoad(13.6, -22, 0.5), false, 'Raised sidewalk curb at x=13.6 must be clear of road');

  // 2. Central District buildings, streetlights, streetProps, avenue trees & transit stops
  const city = CityGenerator.generateDistrict(847291);
  for (const b of city.buildings) {
    assert.equal(
      isPointOnAnyRoad(b.position.x, b.position.z, 0.2),
      false,
      `Central building ${b.id} center overlaps road at (${b.position.x}, ${b.position.z})`
    );
  }
  for (const sl of city.streetlights) {
    assert.equal(
      isPointOnAnyRoad(sl.position.x, sl.position.z, 0.5),
      false,
      `Central streetlight overlaps road at (${sl.position.x}, ${sl.position.z})`
    );
  }
  for (const prop of city.streetProps) {
    assert.equal(
      isPointOnAnyRoad(prop.position.x, prop.position.z, 0.5),
      false,
      `Central street prop ${prop.id} (${prop.type}) overlaps road at (${prop.position.x}, ${prop.position.z})`
    );
  }
  const centralTrees = VegetationGenerator.generateTrees(847291);
  assert.ok(centralTrees.length >= 30, 'Expected populated central avenue tree canopy');
  for (const tree of centralTrees) {
    assert.equal(
      isPointOnAnyRoad(tree.position.x, tree.position.z, 0.8),
      false,
      `Central tree ${tree.id} overlaps road at (${tree.position.x}, ${tree.position.z})`
    );
  }
  const stops = TransitScheduleSystem.getInstance().getStops();
  for (const stop of stops) {
    assert.equal(
      isPointOnAnyRoad(stop.position[0], stop.position[2], 0.5),
      false,
      `Transit stop ${stop.id} overlaps road at (${stop.position[0]}, ${stop.position[2]})`
    );
  }

  // 3. Outer Streamed Chunks across 5x5 grid (cx, cz in [-2..2]): buildings, trees, bushes, furniture, biomeProps
  let auditedChunks = 0;
  for (let cx = -2; cx <= 2; cx++) {
    for (let cz = -2; cz <= 2; cz++) {
      if ((cx === -1 || cx === 0) && (cz === -1 || cz === 0)) continue;
      auditedChunks++;
      const chunk = ProceduralChunkGenerator.getChunkData(cx, cz, 847291);
      for (const b of chunk.buildings) {
        assert.equal(
          isPointOnAnyRoad(b.position.x, b.position.z, 0.2),
          false,
          `Streamed building ${b.id} overlaps road at (${b.position.x}, ${b.position.z})`
        );
      }
      for (const t of chunk.trees) {
        assert.equal(
          isPointOnAnyRoad(t.position.x, t.position.z, 0.8),
          false,
          `Streamed tree ${t.id} overlaps road at (${t.position.x}, ${t.position.z})`
        );
      }
      for (const bush of chunk.bushes) {
        assert.equal(
          isPointOnAnyRoad(bush.position.x, bush.position.z, 0.6),
          false,
          `Streamed bush ${bush.id} overlaps road at (${bush.position.x}, ${bush.position.z})`
        );
      }
      for (const f of chunk.furniture) {
        assert.equal(
          isPointOnAnyRoad(f.position.x, f.position.z, 0.6),
          false,
          `Streamed furniture ${f.id} (${f.type}) overlaps road at (${f.position.x}, ${f.position.z})`
        );
      }
      for (const bp of chunk.biomeProps) {
        assert.equal(
          isPointOnAnyRoad(bp.position.x, bp.position.z, 0.6),
          false,
          `Streamed biome prop ${bp.id} (${bp.type}) overlaps road at (${bp.position.x}, ${bp.position.z})`
        );
      }
    }
  }
  assert.equal(auditedChunks, 21, 'Expected all 21 outer chunks in 5x5 ring to be audited');
});

test('Smooth procedural world geometries produce finite vertices, smooth normals, UVs, and richer topology than raw cubes', async () => {
  const {
    createSmoothBeveledBoxGeometry,
    createSmoothBuildingPrismGeometry,
    createSmoothFoliageCrownGeometry,
    createSmoothHoverCoupeGeometry,
    createSmoothMagShuttleGeometry,
  } = await systems();

  const validateGeo = (label, geo, minVerts) => {
    const pos = geo.getAttribute('position');
    const norm = geo.getAttribute('normal');
    assert.ok(pos && pos.count >= minVerts, `${label} expected >= ${minVerts} vertices, got ${pos?.count}`);
    assert.ok(norm && norm.count === pos.count, `${label} must have matching vertex normals`);
    for (let i = 0; i < pos.count; i++) {
      assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i)), `${label} finite pos`);
      const nLen = Math.hypot(norm.getX(i), norm.getY(i), norm.getZ(i));
      assert.ok(Math.abs(nLen - 1) < 0.05, `${label} unit normal at ${i}, got len=${nLen}`);
    }
    geo.computeBoundingBox();
    assert.ok(geo.boundingBox && !geo.boundingBox.isEmpty(), `${label} non-empty bounding box`);
  };

  const bevelBox = createSmoothBeveledBoxGeometry(0.06, 2);
  const prism = createSmoothBuildingPrismGeometry(0.032, 2);
  const crown = createSmoothFoliageCrownGeometry();
  const hover = createSmoothHoverCoupeGeometry();
  const shuttle = createSmoothMagShuttleGeometry();

  validateGeo('BeveledBox', bevelBox, 48);
  validateGeo('BuildingPrism', prism, 40);
  validateGeo('FoliageCrown', crown, 120);
  validateGeo('HoverCoupeHull', hover.hullGeo, 200);
  validateGeo('HoverCoupeCanopy', hover.canopyGeo, 80);
  validateGeo('MagShuttleHull', shuttle.hullGeo, 200);
  validateGeo('MagShuttleCabin', shuttle.cabinGeo, 80);

  // Verify unit bounds on instanced architectural primitives ([-0.5..0.5]^3)
  assert.ok(Math.abs(bevelBox.boundingBox.max.x - 0.5) < 0.02);
  assert.ok(Math.abs(bevelBox.boundingBox.min.y + 0.5) < 0.02);
  assert.ok(Math.abs(prism.boundingBox.max.y - 0.5) < 0.01);
  assert.ok(Math.abs(prism.boundingBox.min.y + 0.5) < 0.01);
  assert.ok(prism.getAttribute('uv'), 'BuildingPrism must preserve wrap-around curtain wall UVs');

  // Verify clean disposal
  bevelBox.dispose();
  prism.dispose();
  crown.dispose();
  hover.hullGeo.dispose();
  hover.canopyGeo.dispose();
  shuttle.hullGeo.dispose();
  shuttle.cabinGeo.dispose();
});



