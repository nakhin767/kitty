/**
 * SabaiCare - Assistive Caregiver & Patient Platform Logic
 * Contains: 
 * 1. Web Audio API cough/choke detector
 * 2. MediaPipe Face Mesh & Head Pose pointer tracking
 * 3. MediaPipe Pose bed escape / fall prediction & position timer
 * 4. LAN Tab Communication via BroadcastChannel
 * 5. Smart Room simulated controls & Webhook execution
 * 6. Fallback simulation engine
 */

// Tab Management
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const activeTab = document.getElementById(tabId);
    if (activeTab) {
        activeTab.classList.add('active');
    }

    // Highlight button
    if (tabId === 'patient-station') {
        document.getElementById('tab-patient').classList.add('active');
    } else if (tabId === 'nurse-monitor') {
        document.getElementById('tab-nurse').classList.add('active');
        // Clear alert badge count on opening nurse monitor
        clearNurseBadge();
    } else if (tabId === 'system-settings') {
        document.getElementById('tab-settings').classList.add('active');
    }
}

// -------------------------------------------------------------
// LAN Communication via BroadcastChannel (No Internet Required)
// -------------------------------------------------------------
const lanChannel = new BroadcastChannel('sabaicare-lan');

// Broadcast an alert or state change
function broadcastState(type, data) {
    lanChannel.postMessage({
        sender: 'Bed-A1',
        timestamp: new Date().toISOString(),
        type: type,
        data: data
    });
}

// Handle incoming messages
lanChannel.onmessage = function(event) {
    const msg = event.data;
    console.log("LAN Msg Received:", msg);
    handleIncomingLANData(msg);
};

function handleIncomingLANData(msg) {
    const timeStr = new Date(msg.timestamp).toLocaleTimeString();
    
    // Add to Nurse Logs
    if (msg.type === 'aac_alert') {
        addLogEntry('info', `[${timeStr}] ${msg.sender}: ร้องขอ [${msg.data.text}] ${msg.data.icon}`);
        updateNurseBedRequest(msg.sender, `ล่าสุด: ร้องขอ ${msg.data.text}`);
        triggerNurseAlertBell();
    } 
    else if (msg.type === 'fall_alert') {
        addLogEntry('danger', `[${timeStr}] ${msg.sender}: 🚨 แจ้งเตือน! ${msg.data.warning}`);
        updateNurseBedSafety(msg.sender, msg.data.warning, 'red');
        triggerNurseAlertBell(true);
        triggerGlobalEmergencyBanner(`${msg.sender} ${msg.data.warning}`);
    } 
    else if (msg.type === 'choke_alert') {
        addLogEntry('danger', `[${timeStr}] ${msg.sender}: 🚨 ฉุกเฉิน! ตรวจพบเสียงสำลักหรือหายใจติดขัดสะสม`);
        updateNurseBedSafety(msg.sender, 'ตรวจพบการสำลักไอ!', 'red');
        triggerNurseAlertBell(true);
        triggerGlobalEmergencyBanner(`${msg.sender}: ตรวจพบการสำลักไอติดต่อกัน!`);
    } 
    else if (msg.type === 'pose_change') {
        updateNurseBedPose(msg.sender, msg.data.pose);
        if (msg.data.pose.includes('ตะแคง') || msg.data.pose.includes('หงาย') || msg.data.pose.includes('นั่ง')) {
            addLogEntry('system', `[${timeStr}] ${msg.sender}: เปลี่ยนท่านอนเป็น [${msg.data.pose}]`);
        }
    } 
    else if (msg.type === 'bedsore_warning') {
        addLogEntry('danger', `[${timeStr}] ${msg.sender}: ⚠️ นอนท่าเดิมนานเกิน 2 ชม. (เสี่ยงแผลกดทับ)`);
        updateNurseBedSafety(msg.sender, 'เสี่ยงแผลกดทับ', 'red');
        triggerNurseAlertBell();
    }
}

// -------------------------------------------------------------
// Voice Synthesis (Thai Text-To-Speech)
// -------------------------------------------------------------
function speakThai(text) {
    if ('speechSynthesis' in window) {
        // Cancel any active speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'th-TH';
        utterance.rate = 0.85; // Slightly slower for clarity
        utterance.pitch = 1.0;
        
        // Find Thai voice if available
        const voices = window.speechSynthesis.getVoices();
        const thaiVoice = voices.find(voice => voice.lang.includes('th') || voice.lang.includes('TH'));
        if (thaiVoice) {
            utterance.voice = thaiVoice;
        }
        
        window.speechSynthesis.speak(utterance);
    }
}

// Pre-load voices
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {};
}

// -------------------------------------------------------------
// AAC Communication Board Actions
// -------------------------------------------------------------
function triggerAAC(actionId, text, icon) {
    playAudioFeedback('click-sound');
    
    // 1. Voice Speech in Thai
    const card = document.getElementById(`btn-aac-${actionId}`);
    const speechText = card ? card.getAttribute('data-speech') : text;
    speakThai(speechText);
    
    // 2. Add locally to spelling box
    const customInput = document.getElementById('custom-message-input');
    customInput.value = text;
    
    // 3. Broadcast to Nurse Station via LAN
    broadcastState('aac_alert', { action: actionId, text: text, icon: icon });
    
    // 4. Update local log just in case
    console.log(`AAC Triggered: ${text}`);

    // If SOS, trigger flashing siren
    if (actionId === 'sos') {
        triggerGlobalEmergencyBanner("เตียง A1: ร้องขอความช่วยเหลือฉุกเฉิน (SOS)!");
    }
}

function speakCustomMessage() {
    const customInput = document.getElementById('custom-message-input');
    if (customInput.value.trim() !== '') {
        speakThai(customInput.value);
        broadcastState('aac_alert', { action: 'custom', text: customInput.value, icon: '💬' });
    }
}

function clearCustomMessage() {
    document.getElementById('custom-message-input').value = '';
}

// -------------------------------------------------------------
// Smart Room Controls & Webhook API
// -------------------------------------------------------------
const smartHomeState = {
    light: false,
    fan: false,
    plug: false
};

function triggerSmartDevice(device) {
    playAudioFeedback('click-sound');
    smartHomeState[device] = !smartHomeState[device];
    
    // 1. Update UI buttons
    const btn = document.getElementById(`btn-aac-${device}`);
    if (btn) {
        if (smartHomeState[device]) {
            btn.classList.add('iot-active');
            if (device === 'light') btn.querySelector('.card-text').innerText = "ไฟห้อง: เปิดอยู่";
            if (device === 'fan') btn.querySelector('.card-text').innerText = "พัดลม: เปิดอยู่";
        } else {
            btn.classList.remove('iot-active');
            if (device === 'light') btn.querySelector('.card-text').innerText = "เปิด/ปิด ไฟห้อง";
            if (device === 'fan') btn.querySelector('.card-text').innerText = "เปิด/ปิด พัดลม";
        }
    }
    
    // 2. Update Smart Room Simulation Widget
    const simBulb = document.getElementById('sim-light-bulb');
    const simFan = document.getElementById('sim-fan');
    const simPlug = document.getElementById('sim-plug');
    
    if (device === 'light') {
        if (smartHomeState[device]) {
            simBulb.classList.add('active-light');
            simBulb.querySelector('span').innerText = "ไฟเพดาน (On)";
            simPlug.classList.add('active-plug');
            executeWebhook('light-on');
        } else {
            simBulb.classList.remove('active-light');
            simBulb.querySelector('span').innerText = "ไฟเพดาน (Off)";
            if (!smartHomeState.fan) simPlug.classList.remove('active-plug');
            executeWebhook('light-off');
        }
    } else if (device === 'fan') {
        if (smartHomeState[device]) {
            simFan.classList.add('active-fan');
            simFan.querySelector('span').innerText = "พัดลมระบาย (On)";
            simPlug.classList.add('active-plug');
            executeWebhook('fan-on');
        } else {
            simFan.classList.remove('active-fan');
            simFan.querySelector('span').innerText = "พัดลมระบาย (Off)";
            if (!smartHomeState.light) simPlug.classList.remove('active-plug');
            executeWebhook('fan-off');
        }
    }
    
    // Broadcast status change
    broadcastState('iot_change', { device: device, state: smartHomeState[device] });
    speakThai(smartHomeState[device] ? `เปิด${device === 'light' ? 'ไฟ' : 'พัดลม'}` : `ปิด${device === 'light' ? 'ไฟ' : 'พัดลม'}`);
}

function executeWebhook(actionType) {
    let url = "";
    if (actionType === 'light-on') url = document.getElementById('url-light-on').value;
    else if (actionType === 'light-off') url = document.getElementById('url-light-off').value;
    else if (actionType === 'fan-on') url = document.getElementById('url-fan-on').value;
    else if (actionType === 'fan-off') url = document.getElementById('url-fan-off').value;
    
    if (!url) return;
    
    console.log(`Executing IoT Webhook: ${actionType} -> ${url}`);
    
    // Issue non-blocking HTTP fetch (no-cors prevents cross-origin blocks for simple smart switches)
    fetch(url, { method: 'GET', mode: 'no-cors' })
        .then(() => console.log(`IoT Webhook trigger sent successfully.`))
        .catch(err => console.warn(`Webhook failed or CORS blocked:`, err.message));
}

// -------------------------------------------------------------
// Audio Threshold Alert & Cough/Choke Detection
// -------------------------------------------------------------
let audioContext = null;
let analyser = null;
let microphoneStream = null;
let micCheckInterval = null;
let isMicActive = false;

// Audio detection configuration
let audioThresholdDb = -30; // Configured in settings
let coughCount = 0;
let coughResetTimer = null;

function toggleMicrophone() {
    if (isMicActive) {
        stopMicrophone();
    } else {
        startMicrophone();
    }
}

function startMicrophone() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(stream => {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                
                const source = audioContext.createMediaStreamSource(stream);
                source.connect(analyser);
                
                microphoneStream = stream;
                isMicActive = true;
                document.getElementById('btn-toggle-mic').innerHTML = '<i class="fa-solid fa-microphone"></i> ปิดไมโครโฟน';
                document.getElementById('btn-toggle-mic').classList.add('btn-primary');
                document.getElementById('mic-status-text').innerText = "กำลังรับฟังเสียงสำลักไอ...";
                
                monitorAudioThreshold();
            })
            .catch(err => {
                alert("ไม่สามารถเข้าถึงไมโครโฟนได้: " + err.message);
                console.error(err);
            });
    } else {
        alert("เบราว์เซอร์ไม่รองรับการดึงสัญญาณไมโครโฟน");
    }
}

function stopMicrophone() {
    if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => track.stop());
    }
    if (audioContext) {
        audioContext.close();
    }
    if (micCheckInterval) {
        clearInterval(micCheckInterval);
    }
    
    isMicActive = false;
    document.getElementById('btn-toggle-mic').innerHTML = '<i class="fa-solid fa-microphone-slash"></i> เปิดไมโครโฟน';
    document.getElementById('btn-toggle-mic').classList.remove('btn-primary');
    document.getElementById('mic-status-text').innerText = "ปิดระบบดักเสียงสำลัก";
    document.getElementById('audio-level-bar').style.width = '0%';
    document.getElementById('audio-db-value').innerText = '-∞ dB';
    
    // Clear counts
    coughCount = 0;
    document.getElementById('cough-count-badge').innerText = '0';
}

function monitorAudioThreshold() {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const dbThreshold = parseFloat(document.getElementById('set-audio-sens').value);
    
    let lastSpikeTime = 0;
    
    micCheckInterval = setInterval(() => {
        if (!isMicActive) return;
        
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume (RMS-like estimation in decibels)
        let total = 0;
        for (let i = 0; i < bufferLength; i++) {
            total += dataArray[i];
        }
        const average = total / bufferLength;
        
        // Convert to dB scale (-100 to 0)
        // 0 average maps to -100dB, 255 average maps to 0dB
        const db = Math.round((average / 255) * 100 - 100);
        
        // Update Meter UI
        const percent = Math.min(100, Math.max(0, Math.round((db + 100))));
        document.getElementById('audio-level-bar').style.width = percent + '%';
        document.getElementById('audio-db-value').innerText = (db === -100 ? '-∞' : db) + ' dB';
        
        // Check for cough spike
        if (db > dbThreshold) {
            const now = Date.now();
            // Debounce spikes to represent individual cough bursts (at least 350ms apart)
            if (now - lastSpikeTime > 400) {
                lastSpikeTime = now;
                registerCoughSpike();
            }
        }
    }, 50);
}

function registerCoughSpike() {
    coughCount++;
    document.getElementById('cough-count-badge').innerText = coughCount;
    playAudioFeedback('warning-sound');
    
    console.log(`Cough spike detected! Count: ${coughCount}`);
    
    // Auto reset count if no more coughs within 6 seconds
    if (coughResetTimer) clearTimeout(coughResetTimer);
    coughResetTimer = setTimeout(() => {
        coughCount = 0;
        document.getElementById('cough-count-badge').innerText = '0';
        console.log("Cough detection count reset (Timeout).");
    }, 6000);
    
    // If 3 spikes occur, trigger Choking Alert!
    if (coughCount >= 3) {
        coughCount = 0;
        document.getElementById('cough-count-badge').innerText = '0';
        if (coughResetTimer) clearTimeout(coughResetTimer);
        
        // Trigger Emergency Alert
        broadcastState('choke_alert', {});
        triggerGlobalEmergencyBanner("เตียง A1: ตรวจพบพฤติกรรมสำลักและหายใจติดขัด! (ไอ 3 ครั้งซ้อน)");
    }
}

// -------------------------------------------------------------
// Face Mesh & Pose tracking (MediaPipe Engine)
// -------------------------------------------------------------
let cameraActive = false;
let cameraObj = null;
let faceMeshModel = null;
let poseModel = null;

// Settings values
let dwellDelay = 1500; // ms
let sensitivity = 15; // cursor speed

// State parameters for calibration
let centerYaw = 0;
let centerPitch = 0;

// Current cursor positions
let currentCursorX = window.innerWidth / 2;
let currentCursorY = window.innerHeight / 2;

// Dwell selection state
let hoveredElement = null;
let hoverStartTime = 0;
let dwellProgressCircle = null;

// Pose analysis variables
let bedBoundingBox = { top: 0.25, left: 0.1, bottom: 0.85, right: 0.9 }; // normalized coords relative to canvas
let isLayingBedsoreTimer = null;
let bedsoreSecondsLeft = 7200; // 2 hours
let bedsoreActiveState = "นอนหงาย";

function startCamera() {
    const video = document.getElementById('video-input');
    const canvas = document.getElementById('canvas-output');
    
    if (cameraActive) return;
    
    document.getElementById('btn-start-camera').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด AI...';
    document.getElementById('btn-start-camera').disabled = true;

    // Load MediaPipe Models
    try {
        // Initialize FaceMesh
        faceMeshModel = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });
        
        faceMeshModel.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6
        });
        
        faceMeshModel.onResults(onFaceMeshResults);

        // Initialize Pose
        poseModel = new Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        });
        
        poseModel.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        poseModel.onResults(onPoseResults);

        // Access WebRTC Camera
        navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
            .then(stream => {
                video.srcObject = stream;
                
                cameraObj = new Camera(video, {
                    onFrame: async () => {
                        if (faceMeshModel) await faceMeshModel.send({ image: video });
                        if (poseModel) await poseModel.send({ image: video });
                    },
                    width: 640,
                    height: 480
                });
                
                cameraObj.start();
                cameraActive = true;
                
                // Hide Simulated View
                document.getElementById('simulated-patient-overlay').classList.add('hidden');
                document.getElementById('btn-calibrate').disabled = false;
                
                document.getElementById('btn-start-camera').innerHTML = '<i class="fa-solid fa-video-slash"></i> ปิดกล้องจริง';
                document.getElementById('btn-start-camera').disabled = false;
                document.getElementById('btn-start-camera').onclick = stopCamera;
                
                document.getElementById('pose-label').innerText = "ตรวจจับท่าทาง: รันเรียลไทม์";
                document.getElementById('pose-label').className = "badge-status pose-status-active";
                document.getElementById('face-cursor').classList.remove('hidden');
                
                // Clear any simulated timers and align to real camera mode
                initBedsoreTimer('นอนหงาย');
            })
            .catch(err => {
                alert("กล้องขัดข้อง: " + err.message);
                resetCameraBtn();
            });

    } catch (e) {
        alert("ไม่สามารถรันโมเดล AI ในเว็บบนเครื่องนี้ได้: " + e.message);
        resetCameraBtn();
    }
}

function stopCamera() {
    if (cameraObj) {
        cameraObj.stop();
    }
    const video = document.getElementById('video-input');
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
    
    cameraActive = false;
    resetCameraBtn();
    
    // Show simulated screen again
    document.getElementById('simulated-patient-overlay').classList.remove('hidden');
    document.getElementById('btn-calibrate').disabled = true;
    document.getElementById('face-cursor').classList.add('hidden');
    
    const canvas = document.getElementById('canvas-output');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function resetCameraBtn() {
    document.getElementById('btn-start-camera').innerHTML = '<i class="fa-solid fa-camera"></i> เปิดกล้องจริง';
    document.getElementById('btn-start-camera').disabled = false;
    document.getElementById('btn-start-camera').onclick = startCamera;
    document.getElementById('pose-label').innerText = "ตรวจจับท่าทาง: รอกล้อง...";
    document.getElementById('pose-label').className = "badge-status pose-status-idle";
}

function calibrateFaceCenter() {
    centerYaw = currentYaw;
    centerPitch = currentPitch;
    console.log(`Calibrated! Center Yaw: ${centerYaw}, Center Pitch: ${centerPitch}`);
    speakThai("คาริเบรตทิศทางสำเร็จ");
}

// -------------------------------------------------------------
// Face Mesh Results Parser (Eye / Head Tracking)
// -------------------------------------------------------------
let currentYaw = 0;
let currentPitch = 0;

function onFaceMeshResults(results) {
    const canvas = document.getElementById('canvas-output');
    const ctx = canvas.getContext('2d');
    
    // Match dimensions
    if (canvas.width !== results.image.width) {
        canvas.width = results.image.width;
        canvas.height = results.image.height;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        
        // Draw MediaPipe face grid (mesh points)
        drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, { color: '#00f0ff33', lineWidth: 1 });
        
        // Nose tip is landmark 1
        const nose = landmarks[1];
        // Cheek boundaries
        const leftCheek = landmarks[234];
        const rightCheek = landmarks[454];
        // Forehead and Chin
        const forehead = landmarks[10];
        const chin = landmarks[152];
        
        // Calculate head orientation
        // Yaw: Left/Right rotation
        const noseXRelative = (nose.x - leftCheek.x) / (rightCheek.x - leftCheek.x);
        currentYaw = noseXRelative - 0.5; // Centers around 0
        
        // Pitch: Up/Down tilt
        const noseYRelative = (nose.y - forehead.y) / (chin.y - forehead.y);
        currentPitch = noseYRelative - 0.45; // Centers around 0
        
        // Calculate offset from calibrated center
        const yawOffset = currentYaw - centerYaw;
        const pitchOffset = currentPitch - centerPitch;
        
        // Sensitivity multipliers
        const sensVal = parseInt(document.getElementById('set-head-sensitivity').value);
        
        // Target screen coordinate mapping
        // We smooth the pointer position using linear interpolation (LERP)
        const targetX = window.innerWidth / 2 - (yawOffset * window.innerWidth * (sensVal / 10));
        const targetY = window.innerHeight / 2 + (pitchOffset * window.innerHeight * (sensVal / 10));
        
        currentCursorX = currentCursorX * 0.7 + targetX * 0.3;
        currentCursorY = currentCursorY * 0.7 + targetY * 0.3;
        
        // Clamp cursor within screen boundaries
        currentCursorX = Math.max(10, Math.min(window.innerWidth - 10, currentCursorX));
        currentCursorY = Math.max(10, Math.min(window.innerHeight - 10, currentCursorY));
        
        // Move visual dot cursor
        const cursorDot = document.getElementById('face-cursor');
        if (cursorDot) {
            cursorDot.style.left = currentCursorX + 'px';
            cursorDot.style.top = currentCursorY + 'px';
        }
        
        // Run collision check with AAC buttons for dwell clicking
        checkCursorDwellSelection(currentCursorX, currentCursorY);
        
        // Check for eyes blink trigger
        detectBlinkClick(landmarks);
    }
}

// Check if face cursor overlaps with any buttons
function checkCursorDwellSelection(x, y) {
    const dwellDelayVal = parseFloat(document.getElementById('set-dwell-time').value) * 1000;
    const progressCircle = document.getElementById('cursor-progress');
    
    // Find element under cursor coordinate
    const element = document.elementFromPoint(x, y);
    if (!element) {
        resetDwellProgress();
        return;
    }
    
    // Traverse upwards to check if it's a scan-item
    const card = element.closest('.scan-item');
    
    if (card) {
        if (hoveredElement !== card) {
            // Entered new card
            hoveredElement = card;
            hoverStartTime = Date.now();
            card.classList.add('scanning-focus');
        } else {
            // Still on the same card, compute elapsed time
            const elapsed = Date.now() - hoverStartTime;
            const percentage = Math.min(100, (elapsed / dwellDelayVal) * 100);
            
            // Update circular progress bar (stroke-dashoffset from 113 to 0)
            const offset = 113 - (percentage / 100) * 113;
            if (progressCircle) {
                progressCircle.style.strokeDashoffset = offset;
            }
            
            // Dwell trigger limit reached!
            if (elapsed >= dwellDelayVal) {
                card.click();
                resetDwellProgress();
            }
        }
    } else {
        resetDwellProgress();
    }
}

function resetDwellProgress() {
    const progressCircle = document.getElementById('cursor-progress');
    if (progressCircle) {
        progressCircle.style.strokeDashoffset = 113;
    }
    
    if (hoveredElement) {
        hoveredElement.classList.remove('scanning-focus');
        hoveredElement = null;
    }
    hoverStartTime = 0;
}

// Detect blink based on eyelids coordinates
let isLeftBlinking = false;
let blinkStartTime = 0;

function detectBlinkClick(landmarks) {
    // Left eye mesh indexes: 159 (upper), 145 (lower)
    const upperY = landmarks[159].y;
    const lowerY = landmarks[145].y;
    const height = Math.abs(lowerY - upperY);
    
    // Right eye indexes for scale calibration: 33 (corner), 133 (corner)
    const scale = Math.abs(landmarks[33].x - landmarks[133].x);
    const ratio = height / scale; // Normalized EAR
    
    if (ratio < 0.12) { // Blink threshold
        if (!isLeftBlinking) {
            isLeftBlinking = true;
            blinkStartTime = Date.now();
        } else {
            const duration = Date.now() - blinkStartTime;
            // Blink click duration threshold (between 400ms and 1500ms is intentional click)
            if (duration >= 400 && duration < 1200) {
                if (hoveredElement) {
                    hoveredElement.click();
                    resetDwellProgress();
                    isLeftBlinking = false;
                    console.log("Eye blink click triggered!");
                }
            }
        }
    } else {
        isLeftBlinking = false;
    }
}

// -------------------------------------------------------------
// Pose Estimation Results Parser (Fall Alert & Sleep Posture)
// -------------------------------------------------------------
let alertDebounceTimer = null;
let lastRiskState = "";

function onPoseResults(results) {
    if (!cameraActive) return;
    
    const canvas = document.getElementById('canvas-output');
    const ctx = canvas.getContext('2d');
    
    if (results.poseLandmarks) {
        const landmarks = results.poseLandmarks;
        
        // Draw basic skeleton joints
        drawConnectors(ctx, landmarks, POSE_CONNECTIONS, { color: '#00e67688', lineWidth: 2 });
        drawLandmarks(ctx, landmarks, { color: '#00f0ff', lineWidth: 1, radius: 3 });
        
        // 1. Get joints for sit-up fall prediction
        const nose = landmarks[0];
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        const leftAnkle = landmarks[27];
        const rightAnkle = landmarks[28];
        
        // Compute average Y for shoulders & hips
        const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
        const avgHipY = (leftHip.y + rightHip.y) / 2;
        
        // 2. Perform Fall Risk Assessments
        let riskDetected = false;
        let warningMessage = "";
        
        // Sit-up logic: If shoulders rise significantly above hip level (Y is lower towards top)
        // Normalized Y coordinates: 0 is top, 1 is bottom
        const verticalDistance = avgHipY - avgShoulderY;
        
        if (verticalDistance > 0.35) {
            riskDetected = true;
            warningMessage = "พยายามลุกนั่ง! เสี่ยงตกเตียง";
        }
        // Legs escape bed logic: check if ankles fall below 80% boundary of the screen
        else if (leftAnkle.y > 0.8 || rightAnkle.y > 0.8) {
            riskDetected = true;
            warningMessage = "ขาเลยขอบเตียง! เสี่ยงพลัดตก";
        }
        
        // Trigger alerts
        const label = document.getElementById('pose-label');
        if (riskDetected) {
            label.innerText = `เฝ้าระวัง: ${warningMessage}`;
            label.className = "badge-status pose-status-alert";
            document.getElementById('bed-bound-guide').classList.add('alert-triggered');
            
            if (lastRiskState !== warningMessage) {
                lastRiskState = warningMessage;
                triggerFallAlert(warningMessage);
            }
        } else {
            label.innerText = "ตรวจจับท่าทาง: นอนพักปกติ";
            label.className = "badge-status pose-status-active";
            document.getElementById('bed-bound-guide').classList.remove('alert-triggered');
            lastRiskState = "";
        }
        
        // 3. Sleep Posture detection for Bedsore prevention
        // Compare horizontal offset of Nose vs Shoulder boundaries
        const shWidth = Math.abs(leftShoulder.x - rightShoulder.x);
        const noseXRelative = (nose.x - leftShoulder.x) / shWidth; // Should be ~0.5 if centered
        
        let sleepingPosture = "นอนหงาย";
        if (noseXRelative < 0.25) {
            sleepingPosture = "นอนตะแคงขวา"; // Mirrored
        } else if (noseXRelative > 0.75) {
            sleepingPosture = "นอนตะแคงซ้าย";
        }
        
        if (bedsoreActiveState !== sleepingPosture) {
            bedsoreActiveState = sleepingPosture;
            broadcastState('pose_change', { pose: sleepingPosture });
            initBedsoreTimer(sleepingPosture);
        }
    }
}

function triggerFallAlert(warningText) {
    broadcastState('fall_alert', { warning: warningText });
    triggerGlobalEmergencyBanner("เตียง A1: " + warningText);
}

// -------------------------------------------------------------
// Bedsore prevention Position Timer (2 hours)
// -------------------------------------------------------------
function initBedsoreTimer(pose) {
    if (isLayingBedsoreTimer) clearInterval(isLayingBedsoreTimer);
    
    // Reset back to 2 hours (for quick demo testing, we can let it tick down, or simulate fast)
    bedsoreSecondsLeft = 7200; // 2 hours
    
    // Update local patient sidebar/status
    updateNurseBedPose('Bed-A1', pose);
    
    isLayingBedsoreTimer = setInterval(() => {
        if (bedsoreSecondsLeft > 0) {
            bedsoreSecondsLeft--;
            updateTimerDisplay('A1', bedsoreSecondsLeft);
        } else {
            // Trigger timer expired alert
            clearInterval(isLayingBedsoreTimer);
            broadcastState('bedsore_warning', { pose: pose });
        }
    }, 1000);
}

function updateTimerDisplay(bedId, seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const formatted = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    
    if (bedId === 'A1') {
        const timerEl = document.getElementById('nurse-bed1-timer');
        if (timerEl) {
            timerEl.innerText = formatted;
            
            // Turn timer red if less than 5 minutes remain
            if (seconds < 300) {
                timerEl.classList.add('text-danger');
            } else {
                timerEl.classList.remove('text-danger');
            }
        }
    }
}

function resetBedsoreTimer(bedId) {
    playAudioFeedback('click-sound');
    if (bedId === 'A1') {
        initBedsoreTimer(bedsoreActiveState);
        addLogEntry('system', `[${new Date().toLocaleTimeString()}] พยาบาลกดยืนยันการพลิกตัวของ เตียง A1 สำเร็จ`);
        updateNurseBedSafety('Bed-A1', 'ปกติ', 'green');
    } else {
        // Mock bed
        const timerEl = document.querySelector(`#bed-card-${bedId.toLowerCase()} .timer-countdown`);
        const safetyEl = document.querySelector(`#bed-card-${bedId.toLowerCase()} .safe-badge`);
        if (timerEl) {
            timerEl.innerText = "02:00:00";
            timerEl.classList.remove('text-danger');
        }
        if (safetyEl) {
            safetyEl.innerText = "ปกติ";
            safetyEl.className = "safe-badge green";
        }
        addLogEntry('system', `[${new Date().toLocaleTimeString()}] พยาบาลกดยืนยันการพลิกตัวของ เตียง ${bedId} สำเร็จ`);
    }
}

// -------------------------------------------------------------
// Auto-scanning Keyboard / Grid System
// -------------------------------------------------------------
let isAutoScanning = false;
let scanIndex = -1;
let scanTimer = null;
let scanSpeedMs = 2000;

function toggleAutoScan(enabled) {
    isAutoScanning = enabled;
    if (scanTimer) clearInterval(scanTimer);
    
    if (isAutoScanning) {
        console.log("Auto scan activated.");
        speakThai("เปิดระบบสแกนอัตโนมัติ");
        // Start scanning cycle
        runScanningCycle();
        scanTimer = setInterval(runScanningCycle, scanSpeedMs);
    } else {
        console.log("Auto scan deactivated.");
        if (scanIndex >= 0) {
            const cards = document.querySelectorAll('.aac-grid .scan-item');
            if (cards[scanIndex]) cards[scanIndex].classList.remove('scanning-focus');
        }
        scanIndex = -1;
    }
}

function runScanningCycle() {
    const cards = document.querySelectorAll('.aac-grid .scan-item');
    if (cards.length === 0) return;
    
    // Clear previous focus
    if (scanIndex >= 0 && cards[scanIndex]) {
        cards[scanIndex].classList.remove('scanning-focus');
    }
    
    // Advance index
    scanIndex = (scanIndex + 1) % cards.length;
    
    // Highlight active card
    const activeCard = cards[scanIndex];
    if (activeCard) {
        activeCard.classList.add('scanning-focus');
        
        // Auditory feedback: Speak the phrase of highlighted button softly
        const txt = activeCard.querySelector('.card-text').innerText;
        speakThaiSoftly(txt);
    }
}

// Soft TTS feedback for auto-scanning helper
function speakThaiSoftly(text) {
    if ('speechSynthesis' in window && isAutoScanning) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'th-TH';
        utterance.rate = 1.0;
        utterance.volume = 0.4; // Soft volume for guide
        window.speechSynthesis.speak(utterance);
    }
}

// Keyboard input mapping (Spacebar triggers clicking the scanned item)
window.addEventListener('keydown', function(event) {
    if (event.code === 'Space' || event.key === ' ' || event.keyCode === 32) {
        // Prevent default screen scrolling
        event.preventDefault();
        
        if (isAutoScanning && scanIndex >= 0) {
            const cards = document.querySelectorAll('.aac-grid .scan-item');
            const activeCard = cards[scanIndex];
            if (activeCard) {
                console.log(`Switch Trigger: clicked scanned item index ${scanIndex}`);
                activeCard.click();
                
                // Stop and restart scan interval to hold visual feedback
                clearInterval(scanTimer);
                setTimeout(() => {
                    if (isAutoScanning) {
                        scanTimer = setInterval(runScanningCycle, scanSpeedMs);
                    }
                }, 1000);
            }
        } else {
            // General page click on Space when scan is off (helpful for calibration)
            console.log("Space pressed (Scan is OFF)");
        }
    }
});

// Single screen tap switch access
document.getElementById('aac-grid-container').addEventListener('click', function(e) {
    // If scanning is active and clicked background, trigger active scan item
    if (isAutoScanning && e.target === this && scanIndex >= 0) {
        e.preventDefault();
        e.stopPropagation();
        const cards = document.querySelectorAll('.aac-grid .scan-item');
        if (cards[scanIndex]) cards[scanIndex].click();
    }
}, true);

// -------------------------------------------------------------
// Fallback Simulator Engine (Mocking Camera AI behaviors)
// -------------------------------------------------------------
function simulatePatientAction(actionType) {
    const poseLabel = document.getElementById('pose-label');
    const bedBox = document.getElementById('bed-bound-guide');
    
    // Clear timer
    if (isLayingBedsoreTimer) {
        // Keep counting down but we can change labels
    }
    
    console.log(`Simulation Action: ${actionType}`);
    
    if (actionType === 'sit-up') {
        poseLabel.innerText = "เฝ้าระวัง: พยายามลุกนั่ง! เสี่ยงตกเตียง";
        poseLabel.className = "badge-status pose-status-alert";
        bedBox.classList.add('alert-triggered');
        
        triggerFallAlert("พยายามพยุงตัวลุกนั่ง (ระบบจำลอง)");
    } 
    else if (actionType === 'out-of-bed') {
        poseLabel.innerText = "เฝ้าระวัง: ขาเลยขอบเตียง! เสี่ยงตกเตียง";
        poseLabel.className = "badge-status pose-status-alert";
        bedBox.classList.add('alert-triggered');
        
        triggerFallAlert("ขาพ้นขอบเตียงผู้ป่วย (ระบบจำลอง)");
    } 
    else if (actionType === 'normal') {
        poseLabel.innerText = "ตรวจจับท่าทาง: นอนพักปกติ (จำลอง)";
        poseLabel.className = "badge-status pose-status-active";
        bedBox.classList.remove('alert-triggered');
        
        updateNurseBedSafety('Bed-A1', 'ปกติ', 'green');
        broadcastState('pose_change', { pose: 'นอนหงาย' });
        initBedsoreTimer('นอนหงาย');
    }
    else if (actionType === 'turn-left') {
        poseLabel.innerText = "ตรวจจับท่าทาง: นอนตะแคงซ้าย (จำลอง)";
        poseLabel.className = "badge-status pose-status-active";
        bedBox.classList.remove('alert-triggered');
        
        updateNurseBedSafety('Bed-A1', 'ปกติ', 'green');
        broadcastState('pose_change', { pose: 'นอนตะแคงซ้าย' });
        initBedsoreTimer('นอนตะแคงซ้าย');
    }
    else if (actionType === 'turn-right') {
        poseLabel.innerText = "ตรวจจับท่าทาง: นอนตะแคงขวา (จำลอง)";
        poseLabel.className = "badge-status pose-status-active";
        bedBox.classList.remove('alert-triggered');
        
        updateNurseBedSafety('Bed-A1', 'ปกติ', 'green');
        broadcastState('pose_change', { pose: 'นอนตะแคงขวา' });
        initBedsoreTimer('นอนตะแคงขวา');
    }
}

// -------------------------------------------------------------
// Nurse Central Monitor Updates
// -------------------------------------------------------------
let nurseBadgeCount = 0;

function updateNurseBedPose(bedSender, poseName) {
    if (bedSender.includes('A1') || bedSender.includes('Bed-A1')) {
        const el = document.getElementById('nurse-bed1-pose');
        if (el) el.innerText = poseName;
    }
}

function updateNurseBedRequest(bedSender, requestText) {
    if (bedSender.includes('A1') || bedSender.includes('Bed-A1')) {
        const el = document.getElementById('nurse-bed1-request');
        if (el) el.innerText = `สถานะล่าสุด: ${requestText}`;
    }
}

function updateNurseBedSafety(bedSender, safetyText, colorClass) {
    const isA1 = bedSender.includes('A1') || bedSender.includes('Bed-A1');
    const bedId = isA1 ? 'a1' : bedSender.toLowerCase();
    
    const card = document.getElementById(`bed-card-${bedId}`);
    const badge = document.querySelector(`#bed-card-${bedId} .safe-badge`);
    
    if (badge) {
        badge.innerText = safetyText;
        badge.className = `safe-badge ${colorClass}`;
        
        if (colorClass === 'red') {
            badge.classList.add('animate-flash');
            if (card) card.classList.add('danger-flashing');
        } else {
            if (card) card.classList.remove('danger-flashing');
        }
    }
}

function triggerNurseAlertBell(loopSiren = false) {
    playAudioFeedback('warning-sound');
    
    // Increment tabs warning badge if not active
    const activeTabButton = document.querySelector('.nav-btn.active');
    if (activeTabButton && activeTabButton.id !== 'tab-nurse') {
        nurseBadgeCount++;
        const badge = document.getElementById('nurse-alert-badge');
        badge.innerText = nurseBadgeCount;
        badge.classList.remove('hidden');
    }
    
    // Ring Siren loop if major emergency (e.g. choking / fall risk)
    if (loopSiren) {
        const siren = document.getElementById('siren-sound');
        if (siren) {
            siren.volume = 0.5;
            siren.play().catch(e => console.log("Sound play blocked:", e.message));
        }
    }
}

function clearNurseBadge() {
    nurseBadgeCount = 0;
    const badge = document.getElementById('nurse-alert-badge');
    badge.innerText = '0';
    badge.classList.add('hidden');
}

// -------------------------------------------------------------
// Emergency Alert Banners UI
// -------------------------------------------------------------
function triggerGlobalEmergencyBanner(text) {
    const banner = document.getElementById('global-emergency-banner');
    const textEl = document.getElementById('emergency-banner-text');
    
    if (banner && textEl) {
        textEl.innerText = `เตือนภัยวิกฤต: ${text}`;
        banner.classList.remove('hidden');
    }
}

document.getElementById('btn-dismiss-global-alert').addEventListener('click', function() {
    const banner = document.getElementById('global-emergency-banner');
    if (banner) {
        banner.classList.add('hidden');
    }
    
    // Silence Siren
    const siren = document.getElementById('siren-sound');
    if (siren) {
        siren.pause();
        siren.currentTime = 0;
    }
    
    // Resolve safety badges to normal
    updateNurseBedSafety('Bed-A1', 'ปกติ', 'green');
    addLogEntry('system', `[${new Date().toLocaleTimeString()}] พยาบาลเข้าระงับเหตุฉุกเฉิน เตียง A1 และปิดเสียงไซเรนเตือนภัยแล้ว`);
});

// -------------------------------------------------------------
// Settings and Logging Utilities
// -------------------------------------------------------------
function saveSettings() {
    playAudioFeedback('click-sound');
    
    dwellDelay = parseFloat(document.getElementById('set-dwell-time').value) * 1000;
    sensitivity = parseInt(document.getElementById('set-head-sensitivity').value);
    audioThresholdDb = parseFloat(document.getElementById('set-audio-sens').value);
    
    // Update visual thresholds line dynamically (maps -50dB to -10dB to 0%-100% position)
    const sensRange = -10 - (-50); // 40dB span
    const pct = ((audioThresholdDb - (-50)) / sensRange) * 100;
    document.getElementById('audio-threshold-indicator').style.left = Math.min(100, Math.max(0, pct)) + '%';
    
    speakThai("บันทึกการตั้งค่าแล้ว");
    addLogEntry('system', `[${new Date().toLocaleTimeString()}] ปรับเปลี่ยนพารามิเตอร์ระบบสำเร็จ`);
}

function addLogEntry(type, text) {
    const container = document.getElementById('nurse-event-logs');
    if (!container) return;
    
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'time';
    timeSpan.innerText = `[${new Date().toLocaleTimeString()}]`;
    
    const textSpan = document.createElement('span');
    textSpan.className = 'text';
    textSpan.innerText = text.replace(/\[\d{2}:\d{2}:\d{2}\]\s*/, ""); // remove duplicate times
    
    entry.appendChild(timeSpan);
    entry.appendChild(textSpan);
    
    container.insertBefore(entry, container.firstChild);
    
    // Cap logs at 50 entries
    if (container.children.length > 50) {
        container.removeChild(container.lastChild);
    }
}

function clearEventLogs() {
    document.getElementById('nurse-event-logs').innerHTML = "";
    addLogEntry('system', 'ล้างประวัติการแจ้งเตือนสำเร็จ');
}

function playAudioFeedback(id) {
    const audio = document.getElementById(id);
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log("Audio feedback play blocked: " + e.message));
    }
}

// -------------------------------------------------------------
// App Initialization
// -------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
    // 1. Map range sliders values update display or run logic
    document.getElementById('set-audio-sens').addEventListener('input', (e) => {
        const val = e.target.value;
        const sensRange = -10 - (-50);
        const pct = ((val - (-50)) / sensRange) * 100;
        document.getElementById('audio-threshold-indicator').style.left = Math.min(100, Math.max(0, pct)) + '%';
    });
    
    // 2. Start Bedsore Simulated Timer for local Bed-A1
    initBedsoreTimer('นอนหงาย');
    
    // 3. Setup mock speed-run countdown intervals for simulated Bed A2
    let bed2Time = 7965; // ~2h 12m
    setInterval(() => {
        if (bed2Time > 0) {
            bed2Time--;
            const hrs = Math.floor(bed2Time / 3600);
            const mins = Math.floor((bed2Time % 3600) / 60);
            const secs = bed2Time % 60;
            const formatted = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            const timeEl = document.querySelector('#bed-card-a2 .timer-countdown');
            if (timeEl) timeEl.innerText = formatted;
        }
    }, 1000);
    
    // Bed A3 count down
    let bed3Time = 1935; // ~32 mins
    setInterval(() => {
        if (bed3Time > 0) {
            bed3Time--;
            const hrs = Math.floor(bed3Time / 3600);
            const mins = Math.floor((bed3Time % 3600) / 60);
            const secs = bed3Time % 60;
            const formatted = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            const timeEl = document.querySelector('#bed-card-a3 .timer-countdown');
            if (timeEl) timeEl.innerText = formatted;
        }
    }, 1000);

    // Bed A4 count down
    let bed4Time = 3900; // ~1h 5m
    setInterval(() => {
        if (bed4Time > 0) {
            bed4Time--;
            const hrs = Math.floor(bed4Time / 3600);
            const mins = Math.floor((bed4Time % 3600) / 60);
            const secs = bed4Time % 60;
            const formatted = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            const timeEl = document.querySelector('#bed-card-a4 .timer-countdown');
            if (timeEl) timeEl.innerText = formatted;
        }
    }, 1000);
});
