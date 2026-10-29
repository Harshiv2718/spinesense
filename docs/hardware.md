# SpineSense Motion: hardware guide

A small motion sensor strapped to your back gives SpineSense accurate lower-back angles, which a webcam can't measure well. One sensor gives trunk angle; two give the true lower-back (lumbar) angle, using the same dual-inclinometer method clinicians use.

No hardware yet? A phone strapped to your upper back can stand in for the upper sensor when checking the camera: see [validation.md, section 4](validation.md#4-no-sensor-yet-use-a-phone). It records to a file rather than streaming live, so it doesn't drive the live hip-hinge feedback.

> Status: the firmware **compiles in CI for both boards** (ESP32 core 3.3.12, M5Unified 0.2.27, arduino-cli 1.5.1), but **has not yet run on real hardware**. The browser side is fully tested with simulated sensors that send identical packets. If you flash a board, the first thing to check is that the Sensors page shows a steady ~50 Hz stream for 10 minutes.

## Pick your parts

| Option | You need | Approx. cost | Soldering |
|---|---|---|---|
| **A. Easiest** | 1–2 × M5StickC Plus2 (ESP32 + IMU + battery + screen) | $20 each | None |
| **B. Cheapest** | 1–2 × ESP32 dev board + MPU6050 module + small LiPo or USB power bank | $6–10 each | 4 wires |

Also: kinesiology tape or a snug elastic belt, and a USB-C cable.

Two sensors are worth it: the second one is what separates "bending from the hips" from "rounding the lower back".

## Wiring (option B only)

| MPU6050 | ESP32 (classic) | ESP32-C3 boards |
|---|---|---|
| VCC | 3V3 | 3V3 |
| GND | GND | GND |
| SDA | GPIO 21 | GPIO 8 |
| SCL | GPIO 22 | GPIO 9 |

For ESP32-C3, change `I2C_SDA` / `I2C_SCL` at the top of the sketch.

## Flash the firmware

1. Install the [Arduino IDE](https://www.arduino.cc/en/software).
2. In **Boards Manager**, install **esp32 by Espressif Systems**.
3. Option A only: in **Library Manager**, install **M5Unified**.
4. Open `firmware/spinesense-motion/spinesense-motion.ino`.
5. At the top, keep `#define BOARD_M5STICKC_PLUS2`, or switch to `#define BOARD_ESP32_MPU6050`.
6. Select your board (M5StickCPlus2, or your ESP32 model) and port, then **Upload**.
7. Leave the sensor still for 2 seconds after power-on while it calibrates the gyroscope.

On the M5StickC Plus2, **button A** cycles the body position (UPPER → LOWER → none) and **button B** recalibrates the gyroscope. The screen shows the name, position, connection and battery.

## Put them on

- **Upper sensor:** on the spine at the level of your lowest ribs (T12/L1).
- **Lower sensor:** flat on the sacrum, the bony triangle at the base of the spine, between the two dimples.
- Which way round doesn't matter: the 15-second calibration learns each sensor's orientation. Redo it every time you re-strap them.

## Connect

1. Open SpineSense in **Chrome or Edge** (desktop or Android; Safari doesn't support Web Bluetooth).
2. Turn on **Settings → Back-sensor hardware → Show hardware sensor options** (it's off by default, so testers without hardware never see it). Then go to **Sensors → Connect a sensor**, pick `SpineSense-XXXX`, and set its body position.
3. Repeat for the second sensor, then **Calibrate now**: stand still, bend forward and back, bend right and back.
4. Start a session. The panel shows trunk, pelvis and lower-back angles, and five exercises gain sensor-based form checks.

## What the sensors add

| Exercise | Sensor check | Needs |
|---|---|---|
| Standing hip hinge | Lower back rounding instead of hinging at the hips; more accurate bend angle | 2 sensors (angle: 1) |
| Glute bridge | Over-arching the lower back | 2 sensors |
| Bird dog | Back tilting or rotating when it should stay still (±8°) | 1 sensor |
| Overhead arm raise | Leaning back to get the arms higher (invisible to a front camera) | 1 sensor |
| Standing side bend | Bending forward instead of sideways; more accurate side-bend angle | 1 sensor |

## Troubleshooting

| Problem | Fix |
|---|---|
| Sensor not in the picker | Make sure it's powered and advertising (screen says "Waiting"). Only Chrome/Edge show it. |
| "Lower sensor barely moved" during calibration | It's probably on the lower back muscles instead of the sacrum. Move it lower and flatter. |
| Angles drift or wobble | Re-run gyro calibration (button B, or power-cycle) with the sensor flat and still. |
| "Signal lost" | Keep the sensor within a few metres and avoid a phone or body blocking it. |
| MPU6050 "IMU not found" | Check the 4 wires and the SDA/SCL pin numbers. |

## Data and privacy

Sensor data stays in the browser like everything else. The **Record a training clip** option in a session saves body landmarks plus sensor angles (no video) to a file on your computer, for building training datasets: the sensor gives accurate labels for training better camera-only models.
