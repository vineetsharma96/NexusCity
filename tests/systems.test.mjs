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
      export { VehicleInteractionSystem } from './src/vehicle/VehicleInteractionSystem';
      export { InteractionSystem } from './src/interaction/InteractionSystem';
      export { TerminalSystem } from './src/interaction/TerminalSystem';
      export { NavigationSystem } from './src/map/NavigationSystem';
      export { DiscoverySystem } from './src/world/DiscoverySystem';
      export { AudioManager } from './src/audio/AudioManager';
      export { AmbientAudioManager } from './src/audio/AmbientAudioManager';
      export { TimeSystem } from './src/world/TimeSystem';
      export { NPCManager } from './src/npc/NPCManager';
      export { CityGenerator } from './src/city/CityGenerator';
      export { WeatherSystem } from './src/world/WeatherSystem';
      export { WindSystem } from './src/world/WindSystem';
      export { TrafficLightSystem } from './src/city/TrafficLightSystem';
    ` },
    bundle: true, platform: 'node', format: 'esm', write: false,
  });
  // Each import receives fresh singleton state, matching a fresh browser session.
  const url = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}#${Math.random()}`;
  return { ...(await import(url)), data, events };
}

test('save load rejects malformed coordinates and collection fields, caps upgrades', async () => {
  const { SaveSystem, data } = await systems();
  data.set('nexus_city_flagship_save_v2', JSON.stringify({ version: 2, player: { position: [0, 'bad', 10], rotationY: 'bad' }, discoveredDistricts: null, discoveredLandmarks: null, cityHistory: null, terminalObjectives: null, missionStates: { invalid: { id: 'invalid', status: 'BROKEN' } }, stats: { distanceTraveledMeters: 'bad' }, vehicleUpgrades: { speed: 999, handling: true, neon: -4 } }));
  const save = SaveSystem.getInstance();
  assert.deepEqual(save.getData().player.position, [0, 0.2, 10]);
  assert.equal(save.getData().player.rotationY, 0);
  assert.deepEqual(save.getData().vehicleUpgrades, { speed: 3, handling: 1, neon: 0 });
  assert.equal(save.getData().stats.distanceTraveledMeters, 0);
  assert.deepEqual(save.getData().missionStates, {});
  assert.doesNotThrow(() => save.updateDistrict('NEURAL_DISTRICT'));
  assert.doesNotThrow(() => save.recordHistory('test', 'TEST', 'Valid history after recovery'));
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
  const original = { terminalId: 'first', objectiveId: 'scan_first', title: 'SCAN', detail: 'Telemetry', kind: 'MISSION', revealed: true, active: true, updatedAt: 1 };
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

  // Clear daytime (13:00): high traffic hum, zero rain, low nocturnal drone
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



