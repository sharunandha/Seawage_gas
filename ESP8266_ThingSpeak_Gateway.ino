/*
 * ESP8266 ThingSpeak Gateway for Arduino Uno Sewer Gas Node
 *
 * Role:
 * - Receives CSV sensor packets from Arduino Uno over serial
 * - Uploads sensor values to ThingSpeak
 *
 * Packet format from Uno:
 * - mq2_ppm,mq3_ppm,ch4_ppm,warnScore
 *
 * ThingSpeak mapping:
 * - field1: MQ-4 methane (PPM)
 * - field2: MQ-2 toxic gas index (PPM)
 * - field3: MQ-3 VOC vapor (PPM)
 * - field5: warning score (0-100)
 *
 * Wiring:
 * - Uno TX (SoftwareSerial pin 3) -> ESP8266 RX (D6 / GPIO12) through level shifting
 * - Common GND required
 * - ESP8266 RX is 3.3V only
 */

#include <ESP8266WiFi.h>
#include <SoftwareSerial.h>

// ===== WiFi Settings =====
const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";

// ===== ThingSpeak Settings =====
const char* server = "api.thingspeak.com";
const String writeApiKey = "7T87BYDB4F00FF24";

// ===== Uno Serial Link =====
const int UNO_RX_PIN = D6; // ESP8266 RX reads Uno TX
const int UNO_TX_PIN = D5; // optional debug/ack line
SoftwareSerial unoLink(UNO_RX_PIN, UNO_TX_PIN);

WiFiClient client;

String incomingLine;
unsigned long lastUploadTime = 0;
const unsigned long minUploadInterval = 16000;

float pendingMq2 = 0.0;
float pendingMq3 = 0.0;
float pendingCh4 = 0.0;
int pendingWarnScore = 0;
bool pendingHasWarnScore = false;
bool hasPendingReading = false;

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("[WIFI] Connecting to ");
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    Serial.print('.');
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected");
    Serial.print("[WIFI] IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WIFI] Connection failed");
  }
}

bool parsePacket(const String& line, float& mq2, float& mq3, float& ch4, int& warnScore, bool& hasWarnScore) {
  int firstComma = line.indexOf(',');
  int secondComma = line.indexOf(',', firstComma + 1);
  if (firstComma < 0 || secondComma < 0) return false;

  mq2 = line.substring(0, firstComma).toFloat();
  mq3 = line.substring(firstComma + 1, secondComma).toFloat();
  int thirdComma = line.indexOf(',', secondComma + 1);

  if (thirdComma < 0) {
    ch4 = line.substring(secondComma + 1).toFloat();
    warnScore = 0;
    hasWarnScore = false;
    return true;
  }

  ch4 = line.substring(secondComma + 1, thirdComma).toFloat();
  warnScore = line.substring(thirdComma + 1).toInt();
  hasWarnScore = true;
  return true;
}

bool sendToThingSpeak(float mq2, float mq3, float ch4, int warnScore, bool hasWarnScore) {
  connectWiFi();
  if (WiFi.status() != WL_CONNECTED) return false;

  if (millis() - lastUploadTime < minUploadInterval) {
    Serial.println("[THINGSPEAK] Upload skipped due to interval limit");
    return false;
  }

  if (!client.connect(server, 80)) {
    Serial.println("[THINGSPEAK] Connection failed");
    return false;
  }

  client.setTimeout(5000);

  String url = "/update?api_key=" + writeApiKey;
  url += "&field1=" + String(ch4, 2);
  url += "&field2=" + String(mq2, 2);
  url += "&field3=" + String(mq3, 2);
  if (hasWarnScore) {
    url += "&field5=" + String(warnScore);
  }

  client.print(String("GET ") + url + " HTTP/1.1\r\n" +
               "Host: api.thingspeak.com\r\n" +
               "Connection: close\r\n\r\n");

  bool sawHttpOk = false;
  String responseBody;
  unsigned long timeout = millis();
  while (client.connected() && millis() - timeout < 5000) {
    while (client.available()) {
      String line = client.readStringUntil('\n');
      line.trim();

      if (line.startsWith("HTTP/1.1 200") || line.indexOf(" 200 ") >= 0) {
        sawHttpOk = true;
      }

      if (line.length() > 0) {
        responseBody = line;
      }
    }
  }

  client.stop();
  responseBody.trim();

  if (responseBody == "0" || responseBody == "-1" || !sawHttpOk) {
    Serial.print("[THINGSPEAK] Write failed, response: ");
    Serial.println(responseBody.length() ? responseBody : "<no body>");
    return false;
  }

  Serial.print("[THINGSPEAK] Entry ID: ");
  Serial.println(responseBody);
  lastUploadTime = millis();
  return true;
}

void queueReading(float mq2, float mq3, float ch4, int warnScore, bool hasWarnScore) {
  pendingMq2 = mq2;
  pendingMq3 = mq3;
  pendingCh4 = ch4;
  pendingWarnScore = warnScore;
  pendingHasWarnScore = hasWarnScore;
  hasPendingReading = true;
}

void processPendingReading() {
  if (!hasPendingReading) return;
  if (millis() - lastUploadTime < minUploadInterval) return;

  if (sendToThingSpeak(pendingMq2, pendingMq3, pendingCh4, pendingWarnScore, pendingHasWarnScore)) {
    hasPendingReading = false;
  }
}

void setup() {
  Serial.begin(115200);
  unoLink.begin(9600);
  delay(1000);

  Serial.println();
  Serial.println("ESP8266 ThingSpeak Gateway ready");
  connectWiFi();
}

void loop() {
  while (unoLink.available()) {
    char c = unoLink.read();
    if (c == '\n') {
      incomingLine.trim();
      if (incomingLine.length() > 0) {
        float mq2 = 0.0;
        float mq3 = 0.0;
        float ch4 = 0.0;
        int warnScore = 0;
        bool hasWarnScore = false;

        if (parsePacket(incomingLine, mq2, mq3, ch4, warnScore, hasWarnScore)) {
          Serial.print("[UNO] ");
          Serial.println(incomingLine);
          queueReading(mq2, mq3, ch4, warnScore, hasWarnScore);
        } else {
          Serial.print("[PARSE] Invalid packet: ");
          Serial.println(incomingLine);
        }
      }
      incomingLine = "";
    } else if (c != '\r') {
      incomingLine += c;
      if (incomingLine.length() > 80) {
        incomingLine = "";
      }
    }
  }

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  processPendingReading();
}
