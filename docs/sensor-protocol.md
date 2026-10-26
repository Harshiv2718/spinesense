# SpineSense Motion BLE protocol (v1)

Any board can be a SpineSense sensor if it implements this GATT profile. Reference implementations: `firmware/spinesense-motion/` (ESP32) and `js/sensors/sim.js` (simulator). Parsing: `js/sensors/protocol.js`.

## Advertising

- Name: `SpineSense-XXXX` (last two bytes of the BT MAC), in the scan response.
- Service UUID `6e5a0001-2b1c-4f8e-9d3a-5b7c1e2f3a4b` in the advertisement.

The web app filters on either.

## Service `6e5a0001-2b1c-4f8e-9d3a-5b7c1e2f3a4b`

| Characteristic | UUID | Properties | Content |
|---|---|---|---|
| Data | `6e5a0002-…` | Notify | 20-byte sample (below), at the stream rate (default 50 Hz) |
| Control | `6e5a0003-…` | Write | Command bytes (below) |
| Info | `6e5a0004-…` | Read | UTF-8 `fw=1.0.0;board=m5stickc-plus2;imu=mpu6886;role=1;rate=50` |

Plus the standard **Battery Service** (`0x180F`, Battery Level `0x2A19`, read + notify).

## Data packet (20 bytes, little-endian)

It fits the default 23-byte ATT MTU, so no MTU negotiation is needed.

| Offset | Type | Field |
|---|---|---|
| 0 | uint8 | Flags: bits 0–1 role (0 unknown, 1 upper, 2 lower, 3 other); bit 2 gyro calibrated; bit 3 still; bits 4–7 protocol version (1) |
| 1 | uint8 | Sequence number (wraps) |
| 2 | uint32 | Device time, ms |
| 6 | 4 × int16 | Orientation quaternion w, x, y, z; value / 16384 |
| 14 | 3 × int16 | Acceleration x, y, z in the sensor frame, milli-g, gravity included |

The browser does **not** assume a quaternion convention (sensor→world or world→sensor, Z-up or Y-up). During calibration it picks whichever reading of the quaternion matches the accelerometer while still. If none matches, it falls back to the accelerometer alone.

## Commands (Control characteristic)

| Bytes | Meaning |
|---|---|
| `01` | Start streaming (sent by the app on connect) |
| `02` | Stop streaming |
| `03 rr` | Set role `rr` (0–3); persisted on the device |
| `04` | Recalibrate gyroscope bias (hold still ~2 s) |
| `05 hz` | Set stream rate (10–100 Hz) |
| `06` | Identify (flash screen or LED for 2 s) |

## How the app turns samples into angles

1. **Up vector:** gravity direction in the sensor frame, from the quaternion (or accelerometer).
2. **Calibration** (`js/sensors/posture.js`):
   - Standing still gives `u0`.
   - The deepest point of a forward bend gives the flexion direction `f`.
   - A right side-bend fixes the sign of `s = u0 × f`.
3. **Angles:** `flex = atan2(u·f, u·u0)` and `side = atan2(±u·s, u·u0)`. Both are gravity-referenced, so there's no yaw drift.
4. **Two sensors:** lumbar = upper − lower (the dual-inclinometer method).
