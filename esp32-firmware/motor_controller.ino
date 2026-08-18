// =============================================================================
// EXISTING FIRMWARE — REFERENCE ONLY. DO NOT MODIFY, RESTRUCTURE, OR "CLEAN UP".
// =============================================================================
// This is the exact sketch currently flashed to the boat's ESP32 and already
// tested/working. It is included in this repo purely so the Pi bridge and app
// developers have the authoritative source for the serial protocol, pin
// assignments, and boot/arm timing. The Pi bridge (pi-bridge/) is responsible
// for its own connection-loss safety net (forcing neutral after 300ms of
// silence from the app) independently of this firmware — this file has no
// comms-loss failsafe timeout by design and should not be given one here.
//
// Serial protocol: ASCII lines of the form "L:xxxx,R:xxxx\n", xxxx = PWM
// microseconds, clamped 1000-2000 by this firmware.
// Port/baud (set on the Pi side): /dev/ttyUSB0 @ 115200.
// ESC signal pins: GPIO 25 (left / esc1), GPIO 26 (right / esc2).
// Boot/arm sequence: 1s delay -> attach ESCs -> write neutral -> hold 3s ->
// print "=== Armed and ready. Waiting for commands. ===". Opening the serial
// port typically toggles DTR and resets the ESP32, restarting this sequence.
// =============================================================================

#include <ESP32Servo.h>
Servo esc1;
Servo esc2;
const int ESC1_PIN = 25;
const int ESC2_PIN = 26;
const int NEUTRAL = 1500;
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("=== ESP32 Motor Controller Booting ===");
  esc1.attach(ESC1_PIN, 1000, 2000);
  esc2.attach(ESC2_PIN, 1000, 2000);
  Serial.println("ESC pins attached (25, 26).");
  Serial.println("Sending neutral signal, arming ESCs...");
  esc1.writeMicroseconds(NEUTRAL);
  esc2.writeMicroseconds(NEUTRAL);
  delay(3000);
  Serial.println("=== Armed and ready. Waiting for commands. ===");
}
void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    Serial.print("Raw command received: [");
    Serial.print(cmd);
    Serial.println("]");
    int lIndex = cmd.indexOf("L:");
    int rIndex = cmd.indexOf("R:");
    if (lIndex == -1 || rIndex == -1) {
      Serial.println("  -> ERROR: missing L: or R: -- ignoring.");
      return;
    }
    int commaIndex = cmd.indexOf(',');
    if (commaIndex == -1) {
      Serial.println("  -> ERROR: no comma separator -- ignoring.");
      return;
    }
    int lVal = constrain(cmd.substring(lIndex + 2, commaIndex).toInt(), 1000, 2000);
    int rVal = constrain(cmd.substring(rIndex + 2).toInt(), 1000, 2000);
    Serial.print("  -> Parsed: L=");
    Serial.print(lVal);
    Serial.print(" R=");
    Serial.println(rVal);
    esc1.writeMicroseconds(lVal);
    esc2.writeMicroseconds(rVal);
    Serial.println("  -> Sent to ESCs.");
  }
}
