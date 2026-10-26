// SpineSense Motion firmware v1.0.0
// A back-mounted motion sensor that streams orientation over Bluetooth LE to the SpineSense web app.
//
// Boards (pick one below):
//   - M5StickC Plus2: ESP32 + MPU6886 IMU + battery + screen. No soldering. Needs the M5Unified library.
//   - Any ESP32 dev board + an MPU6050 module (I2C). Cheapest option.
//
// Arduino IDE setup: Boards Manager -> "esp32" by Espressif Systems (2.x or 3.x).
// For M5StickC Plus2 also install the "M5Unified" library and select the board "M5StickCPlus2"
// (or "ESP32 PICO-D4"). Protocol: docs/sensor-protocol.md
//
// Status: compiles in CI for both boards (.github/workflows/ci.yml); not yet run on real hardware.

// ----------------------------------------------------------------- choose your board
// Change the default below, or pass -DBOARD_ESP32_MPU6050 when compiling. CI builds both.
#if !defined(BOARD_M5STICKC_PLUS2) && !defined(BOARD_ESP32_MPU6050)
  #define BOARD_M5STICKC_PLUS2  // default board
#endif
#if defined(BOARD_M5STICKC_PLUS2) && defined(BOARD_ESP32_MPU6050)
  #error "Choose one board: BOARD_M5STICKC_PLUS2 or BOARD_ESP32_MPU6050"
#endif

#include <Arduino.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#if __has_include(<esp_mac.h>)
  #include <esp_mac.h>  // esp_read_mac on ESP32 core 3.x
#endif

#ifdef BOARD_M5STICKC_PLUS2
  #include <M5Unified.h>
  #define BOARD_NAME "m5stickc-plus2"
  #define IMU_NAME "mpu6886"
#else
  #include <Wire.h>
  #define BOARD_NAME "esp32"
  #define IMU_NAME "mpu6050"
  #define I2C_SDA 21  // classic ESP32 defaults; ESP32-C3 boards often use SDA 8 / SCL 9
  #define I2C_SCL 22
  #define LED_PIN 2
#endif

#define FW_VERSION "1.0.0"
#define SERVICE_UUID "6e5a0001-2b1c-4f8e-9d3a-5b7c1e2f3a4b"
#define DATA_UUID    "6e5a0002-2b1c-4f8e-9d3a-5b7c1e2f3a4b"
#define CONTROL_UUID "6e5a0003-2b1c-4f8e-9d3a-5b7c1e2f3a4b"
#define INFO_UUID    "6e5a0004-2b1c-4f8e-9d3a-5b7c1e2f3a4b"

enum Role : uint8_t { ROLE_UNKNOWN = 0, ROLE_UPPER = 1, ROLE_LOWER = 2, ROLE_OTHER = 3 };
enum Cmd : uint8_t { CMD_START = 1, CMD_STOP = 2, CMD_SET_ROLE = 3, CMD_CAL_GYRO = 4, CMD_SET_RATE = 5, CMD_IDENTIFY = 6 };

const uint32_t SAMPLE_HZ = 100;      // IMU read + fusion rate
const float MADGWICK_BETA = 0.08f;   // lower = smoother, higher = faster gravity correction
const float STILL_DPS = 3.0f;        // gyro magnitude below this counts as still

// ----------------------------------------------------------------- state
Preferences prefs;
BLECharacteristic *dataChar, *controlChar, *infoChar, *battChar;
volatile bool bleConnected = false;
volatile bool streaming = false;
volatile uint8_t role = ROLE_UNKNOWN;
volatile uint8_t streamHz = 50;
volatile bool wantGyroCal = true;    // calibrate on boot
volatile uint32_t identifyUntil = 0;
char deviceName[20];

float q0 = 1, q1 = 0, q2 = 0, q3 = 0;   // fused orientation
float gyroBias[3] = {0, 0, 0};
bool gyroOk = false;
bool still = false;
uint32_t stillSinceMs = 0;
float ax = 0, ay = 0, az = 1;            // last accel, g
uint8_t seq = 0;

// ----------------------------------------------------------------- IMU
struct ImuReading { float ax, ay, az, gx, gy, gz; };  // g and deg/s

#ifdef BOARD_M5STICKC_PLUS2
bool imuBegin() { return M5.Imu.isEnabled(); }
bool imuRead(ImuReading &r) {
  M5.Imu.update();
  bool okA = M5.Imu.getAccel(&r.ax, &r.ay, &r.az);
  bool okG = M5.Imu.getGyro(&r.gx, &r.gy, &r.gz);
  return okA && okG;
}
#else
const uint8_t MPU_ADDR = 0x68;
void mpuWrite(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}
bool imuBegin() {
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(400000);
  mpuWrite(0x6B, 0x00);  // wake up
  delay(50);
  mpuWrite(0x1A, 0x03);  // DLPF ~44 Hz
  mpuWrite(0x1B, 0x08);  // gyro +-500 dps
  mpuWrite(0x1C, 0x08);  // accel +-4 g
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x75);      // WHO_AM_I
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, (uint8_t)1);
  return Wire.available() && Wire.read() != 0xFF;
}
bool imuRead(ImuReading &r) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(MPU_ADDR, (uint8_t)14) != 14) return false;
  int16_t raw[7];
  for (int i = 0; i < 7; i++) raw[i] = (int16_t)((Wire.read() << 8) | Wire.read());
  r.ax = raw[0] / 8192.0f; r.ay = raw[1] / 8192.0f; r.az = raw[2] / 8192.0f;
  r.gx = raw[4] / 65.5f;   r.gy = raw[5] / 65.5f;   r.gz = raw[6] / 65.5f;
  return true;
}
#endif

// ----------------------------------------------------------------- Madgwick IMU fusion (gyro in rad/s)
void madgwickUpdate(float gx, float gy, float gz, float axv, float ayv, float azv, float dt) {
  float qDot1 = 0.5f * (-q1 * gx - q2 * gy - q3 * gz);
  float qDot2 = 0.5f * (q0 * gx + q2 * gz - q3 * gy);
  float qDot3 = 0.5f * (q0 * gy - q1 * gz + q3 * gx);
  float qDot4 = 0.5f * (q0 * gz + q1 * gy - q2 * gx);
  float n = sqrtf(axv * axv + ayv * ayv + azv * azv);
  if (n > 0.0f) {
    axv /= n; ayv /= n; azv /= n;
    float _2q0 = 2 * q0, _2q1 = 2 * q1, _2q2 = 2 * q2, _2q3 = 2 * q3;
    float _4q0 = 4 * q0, _4q1 = 4 * q1, _4q2 = 4 * q2;
    float _8q1 = 8 * q1, _8q2 = 8 * q2;
    float q0q0 = q0 * q0, q1q1 = q1 * q1, q2q2 = q2 * q2, q3q3 = q3 * q3;
    float s0 = _4q0 * q2q2 + _2q2 * axv + _4q0 * q1q1 - _2q1 * ayv;
    float s1 = _4q1 * q3q3 - _2q3 * axv + 4 * q0q0 * q1 - _2q0 * ayv - _4q1 + _8q1 * q1q1 + _8q1 * q2q2 + _4q1 * azv;
    float s2 = 4 * q0q0 * q2 + _2q0 * axv + _4q2 * q3q3 - _2q3 * ayv - _4q2 + _8q2 * q1q1 + _8q2 * q2q2 + _4q2 * azv;
    float s3 = 4 * q1q1 * q3 - _2q1 * axv + 4 * q2q2 * q3 - _2q2 * ayv;
    float sn = sqrtf(s0 * s0 + s1 * s1 + s2 * s2 + s3 * s3);
    if (sn > 0.0f) {
      s0 /= sn; s1 /= sn; s2 /= sn; s3 /= sn;
      qDot1 -= MADGWICK_BETA * s0; qDot2 -= MADGWICK_BETA * s1;
      qDot3 -= MADGWICK_BETA * s2; qDot4 -= MADGWICK_BETA * s3;
    }
  }
  q0 += qDot1 * dt; q1 += qDot2 * dt; q2 += qDot3 * dt; q3 += qDot4 * dt;
  float qn = sqrtf(q0 * q0 + q1 * q1 + q2 * q2 + q3 * q3);
  q0 /= qn; q1 /= qn; q2 /= qn; q3 /= qn;
}

// ----------------------------------------------------------------- gyro bias calibration (hold still ~2 s)
struct GyroCal {
  bool active;
  int n;
  float sum[3];
  float amin, amax;
  void reset(bool start) {
    active = start;
    n = 0;
    sum[0] = sum[1] = sum[2] = 0;
    amin = 9;
    amax = 0;
  }
} gcal = {false, 0, {0, 0, 0}, 9, 0};

void gyroCalFeed(const ImuReading &r) {
  float amag = sqrtf(r.ax * r.ax + r.ay * r.ay + r.az * r.az);
  gcal.amin = min(gcal.amin, amag);
  gcal.amax = max(gcal.amax, amag);
  gcal.sum[0] += r.gx; gcal.sum[1] += r.gy; gcal.sum[2] += r.gz;
  if (++gcal.n < (int)(SAMPLE_HZ * 2)) return;
  if (gcal.amax - gcal.amin < 0.05f) {  // stayed still: accept
    for (int i = 0; i < 3; i++) gyroBias[i] = gcal.sum[i] / gcal.n;
    gyroOk = true;
    gcal.active = false;
  } else {                               // moved: try again
    gcal.reset(true);
  }
}

// ----------------------------------------------------------------- BLE
void updateInfo() {
  char buf[96];
  snprintf(buf, sizeof(buf), "fw=%s;board=%s;imu=%s;role=%u;rate=%u", FW_VERSION, BOARD_NAME, IMU_NAME, role, streamHz);
  infoChar->setValue((uint8_t *)buf, strlen(buf));
}

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *s) override { bleConnected = true; }
  void onDisconnect(BLEServer *s) override {
    bleConnected = false;
    streaming = false;
    BLEDevice::startAdvertising();
  }
};

class ControlCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *c) override {
    uint8_t *d = c->getData();
    size_t n = c->getLength();
    if (!n) return;
    switch (d[0]) {
      case CMD_START: streaming = true; break;
      case CMD_STOP: streaming = false; break;
      case CMD_SET_ROLE:
        if (n > 1 && d[1] <= ROLE_OTHER) {
          role = d[1];
          prefs.putUChar("role", role);
          updateInfo();
        }
        break;
      case CMD_CAL_GYRO: wantGyroCal = true; break;
      case CMD_SET_RATE:
        if (n > 1 && d[1] >= 10 && d[1] <= 100) { streamHz = d[1]; updateInfo(); }
        break;
      case CMD_IDENTIFY: identifyUntil = millis() + 2000; break;
    }
  }
};

void bleBegin() {
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_BT);
  snprintf(deviceName, sizeof(deviceName), "SpineSense-%02X%02X", mac[4], mac[5]);
  BLEDevice::init(deviceName);
  BLEDevice::setMTU(64);
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  BLEService *svc = server->createService(SERVICE_UUID);
  dataChar = svc->createCharacteristic(DATA_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  dataChar->addDescriptor(new BLE2902());
  controlChar = svc->createCharacteristic(CONTROL_UUID, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  controlChar->setCallbacks(new ControlCallbacks());
  infoChar = svc->createCharacteristic(INFO_UUID, BLECharacteristic::PROPERTY_READ);
  updateInfo();
  svc->start();

  BLEService *batt = server->createService(BLEUUID((uint16_t)0x180F));
  battChar = batt->createCharacteristic(BLEUUID((uint16_t)0x2A19), BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  battChar->addDescriptor(new BLE2902());
  batt->start();

  // 128-bit service UUID in the advertisement, name in the scan response (both are filters in the app).
  BLEAdvertising *adv = BLEDevice::getAdvertising();
  BLEAdvertisementData advData, scanData;
  advData.setFlags(0x06);
  advData.setCompleteServices(BLEUUID(SERVICE_UUID));
  scanData.setName(deviceName);
  adv->setAdvertisementData(advData);
  adv->setScanResponseData(scanData);
  BLEDevice::startAdvertising();
}

void putI16(uint8_t *p, float v) {
  int32_t x = lroundf(v);
  x = x > 32767 ? 32767 : (x < -32768 ? -32768 : x);
  p[0] = x & 0xFF;
  p[1] = (x >> 8) & 0xFF;
}

void sendSample() {
  uint8_t p[20];
  p[0] = (1 << 4) | (still ? 0x08 : 0) | (gyroOk ? 0x04 : 0) | (role & 0x03);
  p[1] = seq++;
  uint32_t t = millis();
  memcpy(p + 2, &t, 4);  // ESP32 is little-endian
  putI16(p + 6, q0 * 16384.0f);
  putI16(p + 8, q1 * 16384.0f);
  putI16(p + 10, q2 * 16384.0f);
  putI16(p + 12, q3 * 16384.0f);
  putI16(p + 14, ax * 1000.0f);
  putI16(p + 16, ay * 1000.0f);
  putI16(p + 18, az * 1000.0f);
  dataChar->setValue(p, sizeof(p));
  dataChar->notify();
}

uint8_t batteryLevel() {
#ifdef BOARD_M5STICKC_PLUS2
  int lvl = M5.Power.getBatteryLevel();
  return lvl < 0 ? 0 : (uint8_t)min(lvl, 100);
#else
  return 100;  // no battery sensing on a bare dev board
#endif
}

// ----------------------------------------------------------------- display / LED
const char *roleText() {
  switch (role) {
    case ROLE_UPPER: return "UPPER";
    case ROLE_LOWER: return "LOWER";
    case ROLE_OTHER: return "OTHER";
    default: return "NO ROLE";
  }
}

void showStatus() {
#ifdef BOARD_M5STICKC_PLUS2
  M5.Display.startWrite();
  M5.Display.fillScreen(identifyUntil > millis() ? TFT_BLUE : TFT_BLACK);
  M5.Display.setTextColor(TFT_WHITE);
  M5.Display.setTextSize(2);
  M5.Display.setCursor(8, 8);
  M5.Display.print(deviceName);
  M5.Display.setTextSize(3);
  M5.Display.setCursor(8, 40);
  M5.Display.print(roleText());
  M5.Display.setTextSize(2);
  M5.Display.setCursor(8, 82);
  M5.Display.printf("%s %s", bleConnected ? "Connected" : "Waiting", gyroOk ? "" : "(hold still)");
  M5.Display.setCursor(8, 108);
  M5.Display.printf("Battery %u%%  A: role", batteryLevel());
  M5.Display.endWrite();
#else
  bool blink = (millis() / (bleConnected ? 1000 : 250)) % 2;
  digitalWrite(LED_PIN, identifyUntil > millis() ? (millis() / 100) % 2 : blink);
#endif
}

// ----------------------------------------------------------------- setup / loop
void setup() {
#ifdef BOARD_M5STICKC_PLUS2
  auto cfg = M5.config();
  M5.begin(cfg);
  M5.Display.setRotation(1);
#else
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
#endif
  prefs.begin("spinesense", false);
  role = prefs.getUChar("role", ROLE_UNKNOWN);
  if (!imuBegin()) {
#ifdef BOARD_M5STICKC_PLUS2
    M5.Display.fillScreen(TFT_RED);
    M5.Display.setCursor(8, 40);
    M5.Display.print("IMU not found");
#else
    Serial.println("IMU not found: check wiring (VCC 3V3, GND, SDA, SCL)");
#endif
  }
  bleBegin();
}

void loop() {
  static uint32_t lastUs = micros(), lastUiMs = 0, lastBattMs = 0;
  static uint8_t divider = 0;
#ifdef BOARD_M5STICKC_PLUS2
  M5.update();
  if (M5.BtnA.wasPressed()) {  // cycle role: upper -> lower -> unassigned
    role = role == ROLE_UPPER ? ROLE_LOWER : role == ROLE_LOWER ? ROLE_UNKNOWN : ROLE_UPPER;
    prefs.putUChar("role", role);
    updateInfo();
  }
  if (M5.BtnB.wasPressed()) wantGyroCal = true;
#endif

  uint32_t nowUs = micros();
  if (nowUs - lastUs >= 1000000UL / SAMPLE_HZ) {
    float dt = (nowUs - lastUs) / 1e6f;
    lastUs = nowUs;
    ImuReading r;
    if (imuRead(r)) {
      if (wantGyroCal) {
        wantGyroCal = false;
        gcal.reset(true);
        gyroOk = false;
      }
      if (gcal.active) gyroCalFeed(r);
      float gx = r.gx - gyroBias[0], gy = r.gy - gyroBias[1], gz = r.gz - gyroBias[2];
      ax = r.ax; ay = r.ay; az = r.az;
      const float D2R = 0.0174532925f;
      madgwickUpdate(gx * D2R, gy * D2R, gz * D2R, r.ax, r.ay, r.az, dt);
      bool calmNow = sqrtf(gx * gx + gy * gy + gz * gz) < STILL_DPS;
      if (!calmNow) stillSinceMs = millis();
      still = calmNow && millis() - stillSinceMs > 500;
      if (bleConnected && streaming && ++divider >= SAMPLE_HZ / streamHz) {
        divider = 0;
        sendSample();
      }
    }
  }

  uint32_t nowMs = millis();
  if (nowMs - lastUiMs > 250) {
    lastUiMs = nowMs;
    showStatus();
  }
  if (nowMs - lastBattMs > 30000 || lastBattMs == 0) {
    lastBattMs = nowMs;
    uint8_t b = batteryLevel();
    battChar->setValue(&b, 1);
    if (bleConnected) battChar->notify();
  }
}
