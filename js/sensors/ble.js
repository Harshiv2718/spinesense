// Web Bluetooth driver for SpineSense Motion sensors (Chrome and Edge on desktop and Android).

import { SERVICE_UUID, DATA_UUID, CONTROL_UUID, INFO_UUID, NAME_PREFIX, CMD, ROLE, decodeSample, parseInfo, command } from './protocol.js';

export class BleSensor extends EventTarget {
  static get supported() {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth;
  }

  /** Must be called from a click handler: the browser shows its own device picker. */
  static async request() {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }, { namePrefix: NAME_PREFIX }],
      optionalServices: [SERVICE_UUID, 'battery_service'],
    });
    return new BleSensor(device);
  }

  constructor(device) {
    super();
    this.device = device;
    this.id = device.id;
    this.name = device.name || 'SpineSense sensor';
    this.role = 'unknown';
    this.wantConnected = false;
    this.retries = 0;
    this.onDisconnect = () => this.handleDisconnect();
    device.addEventListener('gattserverdisconnected', this.onDisconnect);
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  async connect() {
    this.wantConnected = true;
    this.emit('status', 'connecting');
    const server = await this.device.gatt.connect();
    const svc = await server.getPrimaryService(SERVICE_UUID);
    this.control = await svc.getCharacteristic(CONTROL_UUID);
    try {
      const info = parseInfo(new TextDecoder().decode(await (await svc.getCharacteristic(INFO_UUID)).readValue()));
      if (info.role) this.role = info.role;
      this.emit('info', info);
    } catch (e) {
      console.warn('Sensor info unavailable', e);
    }
    const data = await svc.getCharacteristic(DATA_UUID);
    data.addEventListener('characteristicvaluechanged', (e) => {
      try {
        this.emit('sample', decodeSample(e.target.value));
      } catch (err) {
        console.warn(err);
      }
    });
    await data.startNotifications();
    await this.watchBattery(server);
    await this.control.writeValue(command(CMD.start));
    this.retries = 0;
    this.emit('status', 'connected');
  }

  async watchBattery(server) {
    try {
      const bs = await server.getPrimaryService('battery_service');
      const level = await bs.getCharacteristic('battery_level');
      this.emit('battery', (await level.readValue()).getUint8(0));
      level.addEventListener('characteristicvaluechanged', (e) => this.emit('battery', e.target.value.getUint8(0)));
      await level.startNotifications().catch(() => {});
    } catch {
      /* battery service is optional */
    }
  }

  async handleDisconnect() {
    this.emit('status', 'disconnected');
    if (!this.wantConnected || this.retries >= 5) return;
    this.retries++;
    await new Promise((r) => setTimeout(r, 1000 * this.retries));
    try {
      await this.connect();
    } catch (e) {
      console.warn('Reconnect failed', e);
    }
  }

  async send(bytes) {
    if (this.control && this.device.gatt.connected) await this.control.writeValue(bytes);
  }

  async setRole(role) {
    this.role = role;
    await this.send(command(CMD.setRole, ROLE[role] ?? 0));
  }

  identify() {
    return this.send(command(CMD.identify));
  }

  calibrateGyro() {
    return this.send(command(CMD.calibrateGyro));
  }

  disconnect() {
    this.wantConnected = false;
    this.device.removeEventListener('gattserverdisconnected', this.onDisconnect);
    if (this.device.gatt.connected) this.device.gatt.disconnect();
    this.emit('status', 'disconnected');
  }
}
