// SpineSense Motion BLE protocol, v1. Shared by the firmware, the browser driver and the simulator.
// Full spec: docs/sensor-protocol.md
//
// Data packet (notify, 20 bytes, little-endian, fits the default BLE MTU):
//   [0]     flags: bits 0-1 role, bit 2 gyro calibrated, bit 3 still, bits 4-7 protocol version
//   [1]     sequence number (uint8, wraps)
//   [2..5]  device time in ms (uint32)
//   [6..13] orientation quaternion w, x, y, z (int16, value / 16384)
//   [14..19] acceleration x, y, z in the sensor frame (int16, milli-g, includes gravity)

export const SERVICE_UUID = '6e5a0001-2b1c-4f8e-9d3a-5b7c1e2f3a4b';
export const DATA_UUID = '6e5a0002-2b1c-4f8e-9d3a-5b7c1e2f3a4b';
export const CONTROL_UUID = '6e5a0003-2b1c-4f8e-9d3a-5b7c1e2f3a4b';
export const INFO_UUID = '6e5a0004-2b1c-4f8e-9d3a-5b7c1e2f3a4b';
export const NAME_PREFIX = 'SpineSense';

export const PROTOCOL_VERSION = 1;
export const PACKET_BYTES = 20;
const Q_SCALE = 16384;

export const ROLE = { unknown: 0, upper: 1, lower: 2, other: 3 };
export const ROLE_NAME = ['unknown', 'upper', 'lower', 'other'];
export const ROLE_LABEL = {
  unknown: 'Not assigned',
  upper: 'Upper back (T12/L1)',
  lower: 'Lower back (sacrum)',
  other: 'Other',
};

export const CMD = { start: 0x01, stop: 0x02, setRole: 0x03, calibrateGyro: 0x04, setRate: 0x05, identify: 0x06 };

/** Decode one data packet. Accepts a DataView, ArrayBuffer or typed array. */
export function decodeSample(input) {
  const v = input instanceof DataView ? input : new DataView(input.buffer ?? input, input.byteOffset ?? 0, input.byteLength);
  if (v.byteLength < PACKET_BYTES) throw new Error(`Packet too short: ${v.byteLength} bytes`);
  const flags = v.getUint8(0);
  const q = [0, 1, 2, 3].map((i) => v.getInt16(6 + i * 2, true) / Q_SCALE);
  const a = [0, 1, 2].map((i) => v.getInt16(14 + i * 2, true) / 1000);
  return {
    version: flags >> 4,
    role: ROLE_NAME[flags & 0b11],
    gyroOk: !!(flags & 0b100),
    still: !!(flags & 0b1000),
    seq: v.getUint8(1),
    t: v.getUint32(2, true),
    q,
    a,
  };
}

/** Encode one data packet (used by the simulator and tests; the firmware mirrors this). */
export function encodeSample({ role = 'unknown', gyroOk = true, still = false, seq = 0, t = 0, q, a }) {
  const buf = new ArrayBuffer(PACKET_BYTES);
  const v = new DataView(buf);
  const roleBits = Math.max(0, ROLE_NAME.indexOf(role)) & 0b11;
  v.setUint8(0, (PROTOCOL_VERSION << 4) | (still ? 0b1000 : 0) | (gyroOk ? 0b100 : 0) | roleBits);
  v.setUint8(1, seq & 0xff);
  v.setUint32(2, t >>> 0, true);
  const clamp16 = (x) => Math.max(-32768, Math.min(32767, Math.round(x)));
  q.forEach((x, i) => v.setInt16(6 + i * 2, clamp16(x * Q_SCALE), true));
  a.forEach((x, i) => v.setInt16(14 + i * 2, clamp16(x * 1000), true));
  return buf;
}

/** Info characteristic: "fw=1.0.0;board=m5stickc-plus2;imu=mpu6886;role=1;rate=50". */
export function parseInfo(text) {
  const out = {};
  for (const part of String(text).split(';')) {
    const [k, val] = part.split('=');
    if (k) out[k.trim()] = (val ?? '').trim();
  }
  if (out.role != null) out.role = ROLE_NAME[Number(out.role)] ?? 'unknown';
  if (out.rate != null) out.rate = Number(out.rate);
  return out;
}

export function command(cmd, arg) {
  return arg == null ? Uint8Array.of(cmd) : Uint8Array.of(cmd, arg & 0xff);
}
