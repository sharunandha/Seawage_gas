/*
 * ESP8266 Sewage Gas Sensor - IoT Monitoring System
 * 
 * Hardware: ESP8266 (NodeMCU) + MQ2 Gas Sensor
 * Cloud: ThingSpeak IoT Platform
 * 
 * This sketch reads gas sensor data and sends it to ThingSpeak
 * every 30 seconds for real-time monitoring via web dashboard.
 * 
 * Setup Instructions:
 * 1. Replace WiFi credentials (ssid, password)
 * 2. Replace ThingSpeak credentials (writeApiKey, channelID)
 * 3. Connect MQ2 sensor A0 pin to ESP8266 A0
 * 4. Upload to ESP8266
 * 5. Open Serial Monitor (115200 baud) to verify
 */

#include <ESP8266WiFi.h>

// ===== WiFi Settings =====
const char* ssid = "YOUR_WIFI_NAME";          // Replace with your WiFi network name
const char* password = "YOUR_WIFI_PASSWORD";   // Replace with your WiFi password

// ===== ThingSpeak Settings =====
const char* server = "api.thingspeak.com";
const String writeApiKey = "YOUR_WRITE_API_KEY";  // Replace with your Write API Key from ThingSpeak
const int channelID = 12345;                      // Replace with your Channel ID

// ===== Sensor Configuration =====
const int MQ2_PIN = A0;  // Analog pin for MQ2 gas sensor

// ===== System Variables =====
WiFiClient client;
unsigned long lastUpdateTime = 0;
const unsigned long updateInterval = 30000; // 30 seconds (ThingSpeak free tier limit)

void setup() {
    Serial.begin(115200);
    delay(100);
    
    Serial.println("\n\n╔════════════════════════════════════════╗");
    Serial.println("║  ESP8266 Sewage Gas Sensor System     ║");
    Serial.println("║  IoT Minor Project                    ║");
    Serial.println("╚════════════════════════════════════════╝");
    
    Serial.println("\n[WIFI] Connecting to WiFi...");
    Serial.print("[WIFI] SSID: ");
    Serial.println(ssid);
    
    WiFi.begin(ssid, password);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n[WIFI] ✓ Connected!");
        Serial.print("[WIFI] IP Address: ");
        Serial.println(WiFi.localIP());
        Serial.print("[WIFI] Signal Strength: ");
        Serial.print(WiFi.RSSI());
        Serial.println(" dBm");
    } else {
        Serial.println("\n[WIFI] ✗ Connection Failed!");
        Serial.println("[WIFI] Please check your credentials and try again");
    }
    
    Serial.println("\n[SYSTEM] Initialization complete");
    Serial.println("[SYSTEM] Waiting for first reading...\n");
}

void loop() {
    // Check if it's time to send data (30 second interval)
    if (millis() - lastUpdateTime >= updateInterval) {
        lastUpdateTime = millis();
        
        // Read MQ2 sensor
        int rawValue = analogRead(MQ2_PIN);
        
        // Convert to voltage (0-1023 → 0-3.3V for ESP8266)
        float voltage = rawValue * 3.3 / 1023.0;
        
        // Calculate gas levels
        // NOTE: These are approximations - proper calibration is needed for accurate readings
        // Calibrate these formulas based on your specific MQ2 sensor and environment
        float ch4_ppm = voltage * 1000;      // Methane
        float h2s_ppm = voltage * 10;        // Hydrogen Sulfide  
        float co_ppm = voltage * 50;         // Carbon Monoxide
        float o2_percent = 21.0;             // Default oxygen level (requires separate O2 sensor)
        float temperature = 25.0;            // Default temperature (requires separate temp sensor)
        
        // Display readings on Serial Monitor
        Serial.println("╔════════════════════════════════════════╗");
        Serial.println("║        SENSOR READING                  ║");
        Serial.println("╚════════════════════════════════════════╝");
        Serial.print("  Raw ADC Value: ");
        Serial.println(rawValue);
        Serial.print("  Voltage: ");
        Serial.print(voltage, 3);
        Serial.println(" V");
        Serial.println("  ─────────────────────────────────────");
        Serial.print("  CH4 (Methane):         ");
        Serial.print(ch4_ppm, 2);
        Serial.println(" PPM");
        Serial.print("  H2S (Hydrogen Sulfide): ");
        Serial.print(h2s_ppm, 2);
        Serial.println(" PPM");
        Serial.print("  CO (Carbon Monoxide):  ");
        Serial.print(co_ppm, 2);
        Serial.println(" PPM");
        Serial.print("  O2 (Oxygen):           ");
        Serial.print(o2_percent, 2);
        Serial.println(" %");
        Serial.print("  Temperature:           ");
        Serial.print(temperature, 2);
        Serial.println(" °C");
        Serial.println("  ─────────────────────────────────────\n");
        
        // Send to ThingSpeak
        if (WiFi.status() == WL_CONNECTED) {
            sendToThingSpeak(ch4_ppm, h2s_ppm, co_ppm, o2_percent, temperature);
        } else {
            Serial.println("[WIFI] ✗ WiFi disconnected - attempting reconnect");
            WiFi.begin(ssid, password);
        }
    }
}

/**
 * Send sensor data to ThingSpeak cloud platform
 */
void sendToThingSpeak(float ch4, float h2s, float co, float o2, float temp) {
    Serial.println("[THINGSPEAK] → Sending data...");
    
    if (client.connect(server, 80)) {
        // Build the HTTP GET request URL
        String url = "/update?api_key=" + writeApiKey;
        url += "&field1=" + String(ch4, 2);   // Field 1: CH4 (Methane)
        url += "&field2=" + String(h2s, 2);   // Field 2: H2S (Hydrogen Sulfide)
        url += "&field3=" + String(co, 2);    // Field 3: CO (Carbon Monoxide)
        url += "&field4=" + String(o2, 2);    // Field 4: O2 (Oxygen)
        url += "&field5=" + String(temp, 2);  // Field 5: Temperature
        
        // Send HTTP request
        client.print("GET " + url + " HTTP/1.1\r\n");
        client.print("Host: api.thingspeak.com\r\n");
        client.print("Connection: close\r\n\r\n");
        
        delay(500);
        
        // Read response
        bool success = false;
        while (client.connected()) {
            if (client.available()) {
                String line = client.readStringUntil('\n');
                if (line.indexOf("200") >= 0 || line.indexOf("OK") >= 0) {
                    success = true;
                }
            }
        }
        
        client.stop();
        
        if (success) {
            Serial.println("[THINGSPEAK] ✓ Data sent successfully!");
        } else {
            Serial.println("[THINGSPEAK] ⚠ Data sent but no confirmation received");
        }
    } else {
        Serial.println("[THINGSPEAK] ✗ Failed to connect to server");
        Serial.println("[THINGSPEAK] Check your internet connection");
    }
    
    Serial.println();
}
