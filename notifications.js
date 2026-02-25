// ============================================
// 📱 MOBILE NOTIFICATION MODULE
// ============================================
// This module sends alerts to your mobile device when unsafe conditions are detected

const https = require('https');
const http = require('http');

// ============================================
// 📋 CONFIGURATION
// ============================================
const NOTIFICATION_CONFIG = {
    // Telegram Bot Configuration
    telegram: {
        enabled: false,  // Set to true to enable Telegram notifications
        botToken: 'YOUR_BOT_TOKEN',  // Get from @BotFather on Telegram
        chatId: 'YOUR_CHAT_ID'       // Get from @userinfobot on Telegram
    },
    
    // Email Configuration (ENABLED - Configure your email below)
    email: {
        enabled: true,  // Set to true to enable email notifications
        service: 'gmail', // gmail, outlook, yahoo
        user: 'sharunandha21@gmail.com',
        password: 'ixtj pnrl ztng qxaa',  // Gmail App Password (not regular password)
        recipient: 'sharmilavigneshwaran16@gmail.com'
    },
    
    // Pushover Configuration (Alternative - requires paid app)
    pushover: {
        enabled: false,
        userKey: 'YOUR_USER_KEY',
        appToken: 'YOUR_APP_TOKEN'
    },
    
    // Alert cooldown (prevent spam) - minutes
    alertCooldown: 5,
    
    // Periodic status report (in minutes)
    statusReportInterval: 60,  // Send status email every 60 minutes (1 hour)
    
    // Safety thresholds
    SAFE_LIMITS: {
        CH4: 5000,      // Methane (PPM)
        H2S: 10,        // Hydrogen Sulfide (PPM)
        CO: 35,         // Carbon Monoxide (PPM)
        O2_MIN: 19.5,   // Oxygen minimum (%)
        O2_MAX: 23.5,   // Oxygen maximum (%)
        RISK_INDEX: 50  // Risk index threshold (%)
    }
};

// Track last alert time to prevent spam
let lastAlertTime = 0;
let lastStatusReportTime = 0;

// ============================================
// 📡 TELEGRAM NOTIFICATION
// ============================================

/**
 * Send alert via Telegram Bot
 * @param {string} message - Alert message to send
 * @param {string} level - Alert level: 'CRITICAL', 'WARNING', 'INFO'
 */
function sendTelegramAlert(message, level = 'WARNING') {
    if (!NOTIFICATION_CONFIG.telegram.enabled) {
        console.log('⚠️ Telegram notifications are disabled');
        return Promise.resolve();
    }
    
    const { botToken, chatId } = NOTIFICATION_CONFIG.telegram;
    
    if (botToken === 'YOUR_BOT_TOKEN' || chatId === 'YOUR_CHAT_ID') {
        console.log('⚠️ Please configure Telegram credentials in notifications.js');
        return Promise.resolve();
    }
    
    // Format message with emoji based on level
    let emoji = '⚠️';
    if (level === 'CRITICAL') emoji = '🚨';
    if (level === 'INFO') emoji = 'ℹ️';
    
    const formattedMessage = `${emoji} *SEWAGE GAS ALERT ${emoji}*\n\n${message}\n\n_Timestamp: ${new Date().toLocaleString()}_`;
    
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const data = JSON.stringify({
        chat_id: chatId,
        text: formattedMessage,
        parse_mode: 'Markdown'
    });
    
    return new Promise((resolve, reject) => {
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };
        
        const req = https.request(url, options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('✅ Telegram alert sent successfully');
                    resolve(responseData);
                } else {
                    console.error('❌ Telegram alert failed:', res.statusCode);
                    reject(new Error(`Telegram API error: ${res.statusCode}`));
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('❌ Telegram request error:', error.message);
            reject(error);
        });
        
        req.write(data);
        req.end();
    });
}

// ============================================
// 📧 EMAIL NOTIFICATION (Using Nodemailer)
// ============================================

/**
 * Send alert via Email
 * NOTE: This requires 'nodemailer' package. Install with: npm install nodemailer
 */
function sendEmailAlert(message, level = 'WARNING') {
    if (!NOTIFICATION_CONFIG.email.enabled) {
        console.log('⚠️ Email notifications are disabled');
        return Promise.resolve();
    }
    
    try {
        const nodemailer = require('nodemailer');
        
        const transporter = nodemailer.createTransport({
            service: NOTIFICATION_CONFIG.email.service,
            auth: {
                user: NOTIFICATION_CONFIG.email.user,
                pass: NOTIFICATION_CONFIG.email.password
            }
        });
        
        const mailOptions = {
            from: NOTIFICATION_CONFIG.email.user,
            to: NOTIFICATION_CONFIG.email.recipient,
            subject: `[${level}] Sewage Gas Safety Alert`,
            html: `
                <h2 style="color: ${level === 'CRITICAL' ? 'red' : 'orange'}">⚠️ SEWAGE GAS ALERT</h2>
                <p>${message.replace(/\n/g, '<br>')}</p>
                <hr>
                <small>Timestamp: ${new Date().toLocaleString()}</small>
            `
        };
        
        return transporter.sendMail(mailOptions)
            .then(() => console.log('✅ Email alert sent successfully'))
            .catch((error) => console.error('❌ Email send error:', error.message));
    } catch (error) {
        console.error('❌ Email module not found. Install with: npm install nodemailer');
        return Promise.resolve();
    }
}

// ============================================
// 📢 PUSHOVER NOTIFICATION
// ============================================

/**
 * Send alert via Pushover (requires Pushover app on mobile - $5 one-time)
 */
function sendPushoverAlert(message, level = 'WARNING') {
    if (!NOTIFICATION_CONFIG.pushover.enabled) {
        return Promise.resolve();
    }
    
    const { userKey, appToken } = NOTIFICATION_CONFIG.pushover;
    
    const priority = level === 'CRITICAL' ? 2 : 0; // 2 = Emergency, 0 = Normal
    
    const data = new URLSearchParams({
        token: appToken,
        user: userKey,
        title: 'Sewage Gas Alert',
        message: message,
        priority: priority
    }).toString();
    
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.pushover.net',
            path: '/1/messages.json',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': data.length
            }
        };
        
        const req = https.request(options, (res) => {
            if (res.statusCode === 200) {
                console.log('✅ Pushover alert sent');
                resolve();
            } else {
                reject(new Error(`Pushover error: ${res.statusCode}`));
            }
        });
        
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// ============================================
// 🔍 SAFETY CONDITION CHECKER
// ============================================

/**
 * Check if current conditions are unsafe and send alert
 * @param {Object} sensorData - Sensor readings
 */
function checkAndAlert(sensorData) {
    const { ch4, h2s, co, o2, temperature, riskIndex } = sensorData;
    
    // Check cooldown to prevent alert spam
    const now = Date.now();
    const cooldownMs = NOTIFICATION_CONFIG.alertCooldown * 60 * 1000;
    
    if (now - lastAlertTime < cooldownMs) {
        console.log('⏳ Alert cooldown active, skipping...');
        return;
    }
    
    // Determine alert level and conditions
    let alertNeeded = false;
    let alertLevel = 'INFO';
    let alertMessages = [];
    
    // Check critical conditions
    if (h2s > NOTIFICATION_CONFIG.SAFE_LIMITS.H2S * 2) {
        alertNeeded = true;
        alertLevel = 'CRITICAL';
        alertMessages.push(`🔴 CRITICAL: H2S level at ${h2s.toFixed(2)} PPM (Limit: ${NOTIFICATION_CONFIG.SAFE_LIMITS.H2S} PPM)`);
    }
    
    if (ch4 > NOTIFICATION_CONFIG.SAFE_LIMITS.CH4) {
        alertNeeded = true;
        alertLevel = alertLevel === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
        alertMessages.push(`🟠 WARNING: CH4 (Methane) at ${ch4.toFixed(0)} PPM (Limit: ${NOTIFICATION_CONFIG.SAFE_LIMITS.CH4} PPM)`);
    }
    
    if (co > NOTIFICATION_CONFIG.SAFE_LIMITS.CO) {
        alertNeeded = true;
        alertLevel = alertLevel === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
        alertMessages.push(`🟠 WARNING: CO level at ${co.toFixed(2)} PPM (Limit: ${NOTIFICATION_CONFIG.SAFE_LIMITS.CO} PPM)`);
    }
    
    if (o2 < NOTIFICATION_CONFIG.SAFE_LIMITS.O2_MIN || o2 > NOTIFICATION_CONFIG.SAFE_LIMITS.O2_MAX) {
        alertNeeded = true;
        alertLevel = 'WARNING';
        alertMessages.push(`🟡 WARNING: O2 level at ${o2.toFixed(2)}% (Safe: ${NOTIFICATION_CONFIG.SAFE_LIMITS.O2_MIN}-${NOTIFICATION_CONFIG.SAFE_LIMITS.O2_MAX}%)`);
    }
    
    if (riskIndex > NOTIFICATION_CONFIG.SAFE_LIMITS.RISK_INDEX) {
        alertNeeded = true;
        if (riskIndex > 75) alertLevel = 'CRITICAL';
        alertMessages.push(`⚠️ Risk Index: ${riskIndex.toFixed(1)}% (Safe: <${NOTIFICATION_CONFIG.SAFE_LIMITS.RISK_INDEX}%)`);
    }
    
    // Send alert if needed
    if (alertNeeded) {
        lastAlertTime = now;
        
        const message = `*UNSAFE CONDITIONS DETECTED*\n\n${alertMessages.join('\n')}\n\n` +
                       `📊 Current Readings:\n` +
                       `• CH4: ${ch4.toFixed(0)} PPM\n` +
                       `• H2S: ${h2s.toFixed(2)} PPM\n` +
                       `• CO: ${co.toFixed(2)} PPM\n` +
                       `• O2: ${o2.toFixed(2)}%\n` +
                       `• Temp: ${temperature.toFixed(1)}°C\n` +
                       `• Risk: ${riskIndex.toFixed(1)}%\n\n` +
                       `⚡ *ACTION REQUIRED:*\n` +
                       (alertLevel === 'CRITICAL' 
                           ? '🚨 EVACUATE IMMEDIATELY! Critical gas levels detected!' 
                           : '⚠️ Increase ventilation and do not enter until levels normalize.');
        
        console.log(`\n🚨 ${alertLevel} ALERT TRIGGERED:`);
        console.log(alertMessages.join('\n'));
        
        // Send via all enabled channels
        const promises = [];
        
        if (NOTIFICATION_CONFIG.telegram.enabled) {
            promises.push(sendTelegramAlert(message, alertLevel));
        }
        
        if (NOTIFICATION_CONFIG.email.enabled) {
            promises.push(sendEmailAlert(message, alertLevel));
        }
        
        if (NOTIFICATION_CONFIG.pushover.enabled) {
            promises.push(sendPushoverAlert(message, alertLevel));
        }
        
        Promise.all(promises)
            .then(() => console.log('✅ All alerts sent successfully'))
            .catch((error) => console.error('❌ Alert error:', error.message));
    } else {
        console.log('✅ Conditions safe - no alerts needed');
    }
}

// ============================================
// � PERIODIC STATUS REPORT
// ============================================

/**
 * Send periodic status email with current sensor readings
 * Sends every hour, regardless of whether conditions are safe or not
 * @param {Object} sensorData - Current sensor readings
 * @param {boolean} forceImmediate - Force immediate send (for startup)
 */
function sendStatusReport(sensorData, forceImmediate = false) {
    if (!NOTIFICATION_CONFIG.email.enabled) {
        console.log('⚠️ Email notifications are disabled - skipping status report');
        return Promise.resolve();
    }
    
    const { ch4, h2s, co, o2, temperature, riskIndex } = sensorData;
    const now = Date.now();
    const intervalMs = NOTIFICATION_CONFIG.statusReportInterval * 60 * 1000;
    
    // Check if enough time has passed since last status report
    if (!forceImmediate && (now - lastStatusReportTime < intervalMs)) {
        const remainingMinutes = Math.ceil((intervalMs - (now - lastStatusReportTime)) / 60000);
        console.log(`⏳ Next status report in ${remainingMinutes} minutes`);
        return Promise.resolve();
    }
    
    lastStatusReportTime = now;
    
    // Determine safety status
    let statusIcon = '🟢';
    let statusText = 'SAFE';
    let statusColor = 'green';
    
    if (riskIndex > 75) {
        statusIcon = '🔴';
        statusText = 'CRITICAL';
        statusColor = 'red';
    } else if (riskIndex > 50) {
        statusIcon = '🟠';
        statusText = 'WARNING';
        statusColor = 'orange';
    } else if (riskIndex > 30) {
        statusIcon = '🟡';
        statusText = 'CAUTION';
        statusColor = '#DAA520';
    }
    
    // Check individual parameters
    const ch4Status = ch4 > NOTIFICATION_CONFIG.SAFE_LIMITS.CH4 ? '❌' : '✅';
    const h2sStatus = h2s > NOTIFICATION_CONFIG.SAFE_LIMITS.H2S ? '❌' : '✅';
    const coStatus = co > NOTIFICATION_CONFIG.SAFE_LIMITS.CO ? '❌' : '✅';
    const o2Status = (o2 < NOTIFICATION_CONFIG.SAFE_LIMITS.O2_MIN || o2 > NOTIFICATION_CONFIG.SAFE_LIMITS.O2_MAX) ? '❌' : '✅';
    
    try {
        const nodemailer = require('nodemailer');
        
        const transporter = nodemailer.createTransport({
            service: NOTIFICATION_CONFIG.email.service,
            auth: {
                user: NOTIFICATION_CONFIG.email.user,
                pass: NOTIFICATION_CONFIG.email.password
            }
        });
        
        const mailOptions = {
            from: NOTIFICATION_CONFIG.email.user,
            to: NOTIFICATION_CONFIG.email.recipient,
            subject: `${statusIcon} Sewage Gas Status Report - ${statusText}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            line-height: 1.6; 
                            color: #333; 
                            margin: 0; 
                            padding: 0;
                        }
                        .container { 
                            max-width: 600px; 
                            margin: 0 auto; 
                            padding: 10px; 
                        }
                        .header { 
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                            color: white; 
                            padding: 20px 15px; 
                            border-radius: 10px 10px 0 0; 
                            text-align: center; 
                        }
                        .header h1 {
                            margin: 10px 0;
                            font-size: 22px;
                        }
                        .status-badge { 
                            display: inline-block; 
                            padding: 10px 20px; 
                            background: ${statusColor}; 
                            color: white; 
                            border-radius: 20px; 
                            font-size: 16px; 
                            font-weight: bold; 
                            margin: 10px 0; 
                        }
                        .readings { 
                            background: #f4f4f4; 
                            padding: 15px; 
                            border-radius: 10px; 
                            margin: 15px 0; 
                        }
                        .readings h2 {
                            margin-top: 0; 
                            color: #667eea;
                            font-size: 18px;
                        }
                        .reading-item { 
                            display: flex; 
                            justify-content: space-between; 
                            align-items: center; 
                            padding: 12px 10px; 
                            margin: 8px 0; 
                            background: white; 
                            border-radius: 8px; 
                            border-left: 4px solid #667eea;
                            flex-wrap: nowrap;
                        }
                        .reading-label { 
                            font-weight: bold; 
                            color: #555;
                            font-size: 14px;
                            flex: 1;
                            min-width: 0;
                            margin-right: 10px;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                        }
                        .reading-value { 
                            font-size: 16px; 
                            color: #333;
                            font-weight: bold;
                            white-space: nowrap;
                            flex-shrink: 0;
                        }
                        .footer { 
                            text-align: center; 
                            color: #999; 
                            font-size: 11px; 
                            margin-top: 20px; 
                            padding-top: 15px; 
                            border-top: 1px solid #ddd; 
                        }
                        .timestamp { 
                            background: #e3f2fd; 
                            padding: 10px; 
                            border-radius: 5px; 
                            text-align: center; 
                            margin: 15px 0;
                            font-size: 13px;
                        }
                        .limits-info { 
                            background: #fff3cd; 
                            padding: 12px; 
                            border-radius: 8px; 
                            margin: 15px 0; 
                            border-left: 4px solid #ffc107;
                            font-size: 13px;
                        }
                        .limits-info h3 {
                            margin-top: 0;
                            color: #856404;
                            font-size: 16px;
                        }
                        .limits-info ul {
                            margin: 10px 0;
                            padding-left: 20px;
                        }
                        .limits-info li {
                            margin: 5px 0;
                        }
                        .risk-meter { 
                            width: 100%; 
                            height: 25px; 
                            background: #e0e0e0; 
                            border-radius: 15px; 
                            overflow: hidden; 
                            margin: 15px 0; 
                        }
                        .risk-fill { 
                            height: 100%; 
                            background: linear-gradient(90deg, #4caf50 0%, #ff9800 50%, #f44336 100%); 
                            width: ${riskIndex}%; 
                            transition: width 0.3s; 
                        }
                        
                        /* Mobile Responsive Styles */
                        @media only screen and (max-width: 600px) {
                            .container {
                                padding: 5px;
                            }
                            .header h1 {
                                font-size: 18px;
                            }
                            .header p {
                                font-size: 12px;
                            }
                            .status-badge {
                                padding: 8px 15px;
                                font-size: 14px;
                            }
                            .readings {
                                padding: 10px;
                            }
                            .readings h2 {
                                font-size: 16px;
                            }
                            .reading-item {
                                padding: 10px 8px;
                                margin: 6px 0;
                            }
                            .reading-label {
                                font-size: 12px;
                                margin-right: 8px;
                            }
                            .reading-value {
                                font-size: 14px;
                            }
                            .timestamp {
                                font-size: 11px;
                                padding: 8px;
                            }
                            .limits-info {
                                font-size: 12px;
                                padding: 10px;
                            }
                            .limits-info h3 {
                                font-size: 14px;
                            }
                        }
                        
                        /* Extra small mobile devices */
                        @media only screen and (max-width: 400px) {
                            .reading-label {
                                font-size: 11px;
                            }
                            .reading-value {
                                font-size: 13px;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🏭 Sewage Gas Monitoring System</h1>
                            <p style="margin: 5px 0; font-size: 14px;">Hourly Status Report</p>
                        </div>
                        
                        <div class="timestamp">
                            <strong>📅 Report Time:</strong> ${new Date().toLocaleString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric', 
                                hour: '2-digit', 
                                minute: '2-digit', 
                                second: '2-digit' 
                            })}
                        </div>
                        
                        <div style="text-align: center; margin: 20px 0;">
                            <div class="status-badge">${statusIcon} ${statusText}</div>
                            <div style="margin-top: 15px;">
                                <strong>Risk Index:</strong> ${riskIndex.toFixed(1)}%
                            </div>
                            <div class="risk-meter">
                                <div class="risk-fill"></div>
                            </div>
                        </div>
                        
                        <div class="readings">
                            <h2>📊 Current Readings</h2>
                            
                            <div class="reading-item">
                                <span class="reading-label">${ch4Status} CH₄ (Methane)</span>
                                <span class="reading-value">${ch4.toFixed(0)} PPM</span>
                            </div>
                            
                            <div class="reading-item">
                                <span class="reading-label">${h2sStatus} H₂S (Hydrogen Sulfide)</span>
                                <span class="reading-value">${h2s.toFixed(2)} PPM</span>
                            </div>
                            
                            <div class="reading-item">
                                <span class="reading-label">${coStatus} CO (Carbon Monoxide)</span>
                                <span class="reading-value">${co.toFixed(2)} PPM</span>
                            </div>
                            
                            <div class="reading-item">
                                <span class="reading-label">${o2Status} O₂ (Oxygen)</span>
                                <span class="reading-value">${o2.toFixed(2)} %</span>
                            </div>
                            
                            <div class="reading-item">
                                <span class="reading-label">🌡️ Temperature</span>
                                <span class="reading-value">${temperature.toFixed(1)} °C</span>
                            </div>
                        </div>
                        
                        <div class="limits-info">
                            <h3>⚠️ Safety Limits Reference</h3>
                            <ul>
                                <li><strong>CH₄:</strong> &lt; ${NOTIFICATION_CONFIG.SAFE_LIMITS.CH4} PPM</li>
                                <li><strong>H₂S:</strong> &lt; ${NOTIFICATION_CONFIG.SAFE_LIMITS.H2S} PPM</li>
                                <li><strong>CO:</strong> &lt; ${NOTIFICATION_CONFIG.SAFE_LIMITS.CO} PPM</li>
                                <li><strong>O₂:</strong> ${NOTIFICATION_CONFIG.SAFE_LIMITS.O2_MIN}% - ${NOTIFICATION_CONFIG.SAFE_LIMITS.O2_MAX}%</li>
                                <li><strong>Risk Index:</strong> &lt; ${NOTIFICATION_CONFIG.SAFE_LIMITS.RISK_INDEX}%</li>
                            </ul>
                        </div>
                        
                        ${riskIndex > 50 ? `
                        <div style="background: #ffebee; padding: 12px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f44336; font-size: 13px;">
                            <h3 style="margin-top: 0; color: #c62828; font-size: 16px;">⚡ Action Required</h3>
                            <p style="margin: 5px 0;">
                                ${riskIndex > 75 
                                    ? '🚨 <strong>CRITICAL!</strong> Evacuate immediately and activate ventilation!' 
                                    : '⚠️ <strong>WARNING!</strong> Increase ventilation and monitor closely.'}
                            </p>
                        </div>
                        ` : `
                        <div style="background: #e8f5e9; padding: 12px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #4caf50; font-size: 13px;">
                            <p style="margin: 5px 0; color: #2e7d32;">
                                ✅ <strong>All systems normal.</strong> Conditions are within safe limits.
                            </p>
                        </div>
                        `}
                        
                        <div class="footer">
                            <p>🤖 <strong>Automated Status Report</strong></p>
                            <p>This report is sent every ${NOTIFICATION_CONFIG.statusReportInterval} minutes</p>
                            <p style="margin-top: 10px;">Sewage Gas Safety Monitoring System © 2026</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
        
        return transporter.sendMail(mailOptions)
            .then(() => {
                console.log(`✅ Status report email sent successfully (Risk: ${riskIndex.toFixed(1)}%, Status: ${statusText})`);
            })
            .catch((error) => {
                console.error('❌ Status report email error:', error.message);
            });
    } catch (error) {
        console.error('❌ Email module not found. Install with: npm install nodemailer');
        return Promise.resolve();
    }
}

// ============================================
// 📤 EXPORTS
// ============================================

module.exports = {
    sendTelegramAlert,
    sendEmailAlert,
    sendPushoverAlert,
    checkAndAlert,
    sendStatusReport,
    NOTIFICATION_CONFIG
};
