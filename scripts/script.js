// Create stars background with parallax data
const starsContainer = document.getElementById("stars");
const starElements = [];
for (let i = 0; i < 100; i++) {
  const star = document.createElement("div");
  star.className = "star";
  const baseX = Math.random() * 100;
  const baseY = Math.random() * 100;
  star.style.left = baseX + "%";
  star.style.top = baseY + "%";
  star.style.width = star.style.height = Math.random() * 3 + "px";
  star.style.animationDelay = Math.random() * 3 + "s";
  starsContainer.appendChild(star);

  // Store star data for parallax
  starElements.push({
    element: star,
    baseX: baseX,
    baseY: baseY,
    depth: Math.random() * 0.5 + 0.5, // Random depth for parallax effect
  });
}

// Parallax effect on landing page
document.addEventListener("mousemove", (e) => {
  if (document.getElementById("landing").style.display !== "none") {
    const mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    const mouseY = (e.clientY / window.innerHeight - 0.5) * 2;

    starElements.forEach((star) => {
      const offsetX = mouseX * star.depth * 5;
      const offsetY = mouseY * star.depth * 5;
      star.element.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    });
  }
});

function launchDashboard() {
  document.getElementById("landing").style.display = "none";
  document.getElementById("dashboard").classList.add("active");
  document.getElementById("timeControls").classList.add("active");
  document.getElementById("addControls").classList.add("active");
  initSimulation();
  init3D();
}

// Orbital simulation
const canvas = document.getElementById("orbitCanvas");
const ctx = canvas.getContext("2d");
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const earthRadius = 50;

const satellites = [];
const debris = [];
const alerts = [];
let alertCount = 0;
let animationId;
let timeSpeed = 1.0;
let currentView = "2d";

// Three.js 3D setup
let scene,
  camera,
  renderer,
  earthMesh,
  objects3D = [];

function init3D() {
  const canvas3D = document.getElementById("orbitCanvas3D");
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({
    canvas: canvas3D,
    alpha: true,
    antialias: true,
  });
  renderer.setSize(600, 600);
  camera.position.z = 400;

  // Earth
  const earthGeometry = new THREE.SphereGeometry(50, 32, 32);
  const earthMaterial = new THREE.MeshPhongMaterial({
    color: 0x2563eb,
    emissive: 0x1e40af,
    shininess: 10,
  });
  earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
  scene.add(earthMesh);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  const pointLight = new THREE.PointLight(0xffffff, 1);
  pointLight.position.set(200, 200, 200);
  scene.add(pointLight);

  // Stars
  const starGeometry = new THREE.BufferGeometry();
  const starVertices = [];
  for (let i = 0; i < 1000; i++) {
    const x = (Math.random() - 0.5) * 2000;
    const y = (Math.random() - 0.5) * 2000;
    const z = (Math.random() - 0.5) * 2000;
    starVertices.push(x, y, z);
  }
  starGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(starVertices, 3),
  );
  const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 2 });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);
}

function switchView(view) {
  currentView = view;
  document
    .querySelectorAll(".view-btn")
    .forEach((btn) => btn.classList.remove("active"));
  event.target.classList.add("active");

  if (view === "2d") {
    document.getElementById("orbitCanvas").style.display = "block";
    document.getElementById("orbitCanvas3D").style.display = "none";
  } else {
    document.getElementById("orbitCanvas").style.display = "none";
    document.getElementById("orbitCanvas3D").style.display = "block";
  }
}

// Update sliders display
document.getElementById("distance").addEventListener("input", (e) => {
  document.getElementById("distanceValue").textContent = e.target.value + " km";
});
document.getElementById("speed").addEventListener("input", (e) => {
  document.getElementById("speedValue").textContent = parseFloat(
    e.target.value,
  ).toFixed(3);
});
document.getElementById("angle").addEventListener("input", (e) => {
  document.getElementById("angleValue").textContent = e.target.value + "°";
});

function addObject() {
  const type = document.getElementById("objectType").value;
  const distance = parseInt(document.getElementById("distance").value);
  const speed = parseFloat(document.getElementById("speed").value);
  const angle =
    parseInt(document.getElementById("angle").value) * (Math.PI / 180);

  const obj = new OrbitalObject(type, distance, speed, angle);

  if (type === "satellite") {
    satellites.push(obj);
  } else {
    debris.push(obj);
  }

  // Add to 3D scene
  const geometry = new THREE.SphereGeometry(
    type === "satellite" ? 5 : 3,
    16,
    16,
  );
  const material = new THREE.MeshPhongMaterial({
    color: type === "satellite" ? 0x4ade80 : 0xff4444,
    emissive: type === "satellite" ? 0x22c55e : 0xcc0000,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  objects3D.push({ obj, mesh });

  updateStats();
}

function clearAll() {
  satellites.length = 0;
  debris.length = 0;
  alertCount = 0;
  alerts.length = 0;

  // Clear 3D objects
  objects3D.forEach(({ mesh }) => scene.remove(mesh));
  objects3D = [];

  document.getElementById("alertList").innerHTML = "";
  updateStats();
  updateRiskLevel();
}

function setTimeSpeed(speed) {
  timeSpeed = speed;
  document.getElementById("speedIndicator").textContent =
    `Speed: ${speed}x ${speed < 1 ? "(Slow Motion)" : speed === 1 ? "(Normal)" : "(Fast Forward)"}`;

  // Update button states
  document.querySelectorAll(".speed-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.textContent === speed + "x") {
      btn.classList.add("active");
    }
  });
}

class OrbitalObject {
  constructor(type, distance, speed, angle) {
    this.type = type;
    this.distance = distance;
    this.speed = speed;
    this.angle = angle;
    this.id = Math.random().toString(36).substr(2, 9);
  }

  update() {
    this.angle += this.speed * timeSpeed;
    if (this.angle > Math.PI * 2) this.angle -= Math.PI * 2;
  }

  getPosition() {
    return {
      x: centerX + Math.cos(this.angle) * this.distance,
      y: centerY + Math.sin(this.angle) * this.distance,
    };
  }

  draw() {
    const pos = this.getPosition();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, this.type === "satellite" ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = this.type === "satellite" ? "#4ade80" : "#ff4444";
    ctx.fill();

    // Draw orbit path
    ctx.beginPath();
    ctx.arc(centerX, centerY, this.distance, 0, Math.PI * 2);
    ctx.strokeStyle =
      this.type === "satellite"
        ? "rgba(74, 222, 128, 0.1)"
        : "rgba(255, 68, 68, 0.1)";
    ctx.stroke();
  }
}

function initSimulation() {
  // Create satellites
  for (let i = 0; i < 8; i++) {
    satellites.push(
      new OrbitalObject(
        "satellite",
        100 + Math.random() * 150,
        0.01 + Math.random() * 0.02,
        Math.random() * Math.PI * 2,
      ),
    );
  }

  // Create debris
  for (let i = 0; i < 15; i++) {
    debris.push(
      new OrbitalObject(
        "debris",
        80 + Math.random() * 180,
        0.015 + Math.random() * 0.025,
        Math.random() * Math.PI * 2,
      ),
    );
  }

  updateStats();
  animate();
}

function updateStats() {
  document.getElementById("satelliteCount").textContent = satellites.length;
  document.getElementById("debrisCount").textContent = debris.length;
}

function checkCollisions() {
  satellites.forEach((sat) => {
    debris.forEach((deb) => {
      const satPos = sat.getPosition();
      const debPos = deb.getPosition();
      const distance = Math.sqrt(
        Math.pow(satPos.x - debPos.x, 2) + Math.pow(satPos.y - debPos.y, 2),
      );

      if (distance < 30) {
        addAlert(sat, deb, distance);
        drawWarningLine(satPos, debPos);
      }
    });
  });
}

function drawWarningLine(pos1, pos2) {
  ctx.beginPath();
  ctx.moveTo(pos1.x, pos1.y);
  ctx.lineTo(pos2.x, pos2.y);
  ctx.strokeStyle = "rgba(255, 68, 68, 0.8)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineWidth = 1;
}

function addAlert(sat, deb, distance) {
  const existingAlert = alerts.find(
    (a) => a.satId === sat.id && a.debId === deb.id,
  );
  if (!existingAlert) {
    const alert = {
      satId: sat.id,
      debId: deb.id,
      time: new Date().toLocaleTimeString(),
      distance: distance.toFixed(1),
    };
    alerts.push(alert);
    alertCount++;

    const alertList = document.getElementById("alertList");
    const alertDiv = document.createElement("div");
    alertDiv.className = distance < 20 ? "alert-item" : "alert-item warning";
    alertDiv.innerHTML = `
             <div class="alert-time">${alert.time}</div>
             <strong>${distance < 20 ? "🚨 CRITICAL" : "⚠️ WARNING"}</strong><br>
             Satellite-Debris proximity: ${alert.distance}km
         `;
    alertList.insertBefore(alertDiv, alertList.firstChild);

    document.getElementById("alertCount").textContent = alertCount;
    updateRiskLevel();

    // Remove from tracking after a while
    setTimeout(() => {
      const index = alerts.findIndex(
        (a) => a.satId === sat.id && a.debId === deb.id,
      );
      if (index > -1) alerts.splice(index, 1);
    }, 5000);
  }
}

function updateRiskLevel() {
  const riskEl = document.getElementById("riskLevel");
  if (alertCount > 10) {
    riskEl.textContent = "HIGH";
    riskEl.style.color = "#ff4444";
  } else if (alertCount > 5) {
    riskEl.textContent = "MEDIUM";
    riskEl.style.color = "#ffa500";
  } else {
    riskEl.textContent = "LOW";
    riskEl.style.color = "#4ade80";
  }
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw Earth
  ctx.beginPath();
  ctx.arc(centerX, centerY, earthRadius, 0, Math.PI * 2);
  const gradient = ctx.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    earthRadius,
  );
  gradient.addColorStop(0, "#60a5fa");
  gradient.addColorStop(1, "#1e40af");
  ctx.fillStyle = gradient;
  ctx.fill();

  // Update and draw satellites
  satellites.forEach((sat) => {
    sat.update();
    sat.draw();
  });

  // Update and draw debris
  debris.forEach((deb) => {
    deb.update();
    deb.draw();
  });

  // Check for collisions
  checkCollisions();

  // 3D rendering
  if (currentView === "3d") {
    // Update 3D positions
    objects3D.forEach(({ obj, mesh }) => {
      const pos = obj.getPosition();
      // Convert 2D to 3D coordinates
      mesh.position.x = pos.x - centerX;
      mesh.position.z = pos.y - centerY;
      mesh.position.y = 0;
    });

    earthMesh.rotation.y += 0.001 * timeSpeed;
    camera.position.x = Math.sin(Date.now() * 0.0001) * 50;
    camera.position.y = Math.sin(Date.now() * 0.00015) * 30 + 50;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  animationId = requestAnimationFrame(animate);
}
