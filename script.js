const canvas = document.querySelector("#galaxyCanvas");
const ctx = canvas.getContext("2d");

const profileForm = document.querySelector("#profileForm");
const usernameInput = document.querySelector("#usernameInput");
const galaxyTitle = document.querySelector("#galaxyTitle");
const repoCount = document.querySelector("#repoCount");
const starCount = document.querySelector("#starCount");
const activityCount = document.querySelector("#activityCount");
const repoCommitCount = document.querySelector("#repoCommitCount");
const statusText = document.querySelector("#statusText");
const selectedName = document.querySelector("#selectedName");
const selectedDescription = document.querySelector("#selectedDescription");
const selectedLink = document.querySelector("#selectedLink");
const repoList = document.querySelector("#repoList");
const demoButton = document.querySelector("#demoButton");
const pauseButton = document.querySelector("#pauseButton");
const shuffleButton = document.querySelector("#shuffleButton");
const zoomInButton = document.querySelector("#zoomInButton");
const zoomOutButton = document.querySelector("#zoomOutButton");
const zoomResetButton = document.querySelector("#zoomResetButton");
const exportButton = document.querySelector("#exportButton");

let width = 0;
let height = 0;
let center = { x: 0, y: 0 };
let planets = [];
let sparks = [];
let starfield = [];
let contributionStars = [];
let currentEvents = [];
let pointer = { x: -9999, y: -9999 };
let pointerWorld = { x: -9999, y: -9999 };
let selectedPlanet = null;
let paused = false;
let zoom = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let panStartPointer = { x: 0, y: 0 };
let panStartOffset = { x: 0, y: 0 };
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_LABEL_THRESHOLD = 2.2;
let lastFrame = performance.now();
let currentUsername = null;
const contributorCache = new Map();
const profileCache = new Map();

// Leave as-is for direct GitHub API (60 requests/hour per visitor IP).
// After deploying the Cloudflare Worker below, set this to your worker URL:
// const GITHUB_API_BASE = "https://github-galaxy-proxy.YOUR_SUBDOMAIN.workers.dev";
const GITHUB_API_BASE = "https://api.github.com";
const PROFILE_CACHE_TTL_MS = 1000 * 60 * 60;
const PROFILE_CACHE_STORAGE_KEY = "github-galaxy-profiles-v1";

const palette = ["#7dd3fc", "#f9a8d4", "#fde68a", "#86efac", "#c4b5fd", "#fca5a5"];
const githubHeaders = { Accept: "application/vnd.github+json" };
const orbitYScale = 0.58;

const demoRepos = [
  {
    name: "portfolio-nebula",
    description: "A personal site with animated case studies and polished project pages.",
    html_url: "https://github.com/",
    stargazers_count: 24,
    forks_count: 5,
    language: "JavaScript",
    updated_at: new Date().toISOString(),
  },
  {
    name: "pixel-quest",
    description: "A small canvas game with enemies, coins, and a boss wave.",
    html_url: "https://github.com/",
    stargazers_count: 12,
    forks_count: 2,
    language: "HTML",
    updated_at: new Date().toISOString(),
  },
  {
    name: "weather-lab",
    description: "Clean dashboard for checking forecasts and saving favorite cities.",
    html_url: "https://github.com/",
    stargazers_count: 7,
    forks_count: 1,
    language: "CSS",
    updated_at: new Date().toISOString(),
  },
  {
    name: "task-orbit",
    description: "A tiny productivity app with drag and drop lists.",
    html_url: "https://github.com/",
    stargazers_count: 18,
    forks_count: 4,
    language: "TypeScript",
    updated_at: new Date().toISOString(),
  },
];

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = rect.width;
  height = rect.height;
  center = { x: width / 2, y: height / 2 };
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildStarfield();
  if (currentEvents.length || contributionStars.length) makeContributionStars(currentEvents);
  placePlanets();
}

function buildStarfield() {
  starfield = Array.from({ length: Math.max(90, Math.floor(width * height / 8500)) }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 1.8 + 0.3,
    alpha: Math.random() * 0.7 + 0.2,
    pulse: Math.random() * Math.PI * 2,
  }));
}

function makePlanets(repos) {
  const visibleRepos = repos
    .filter((repo) => !repo.fork)
    .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
    .slice(0, 12);

  planets = visibleRepos.map((repo, index) => ({
    repo,
    color: palette[index % palette.length],
    angle: Math.random() * Math.PI * 2,
    speed: 0.05 + Math.random() * 0.12,
    orbit: 90,
    radius: 14,
    x: center.x,
    y: center.y,
  }));

  placePlanets();
  renderRepoList();
  selectPlanet(planets[0] || null);
}

function placePlanets() {
  const maxOrbit = Math.max(120, Math.min(width, height) * 0.38);
  planets.forEach((planet, index) => {
    planet.orbit = 70 + (maxOrbit * (index + 1)) / Math.max(planets.length, 1);
    planet.radius = 12 + Math.sqrt((planet.repo.stargazers_count || 0) + 1) * 3;
    planet.radius = Math.min(34, planet.radius);
    updatePlanetPosition(planet);
  });
}

function toWorld(point) {
  return {
    x: center.x + (point.x - panX - center.x) / zoom,
    y: center.y + (point.y - panY - center.y) / zoom,
  };
}

function zoomAt(screenX, screenY, factor) {
  const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
  const world = toWorld({ x: screenX, y: screenY });
  zoom = newZoom;
  panX = screenX - center.x - (world.x - center.x) * zoom;
  panY = screenY - center.y - (world.y - center.y) * zoom;
}

function resetView() {
  zoom = 1;
  panX = 0;
  panY = 0;
}

function updatePlanetPosition(planet) {
  planet.x = center.x + Math.cos(planet.angle) * planet.orbit;
  planet.y = center.y + Math.sin(planet.angle) * planet.orbit * orbitYScale;
}

function makeSparks(events) {
  const count = Math.max(10, Math.min(events.length || 18, 50));
  sparks = Array.from({ length: count }, (_, index) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 120,
    vy: (Math.random() - 0.5) * 120,
    life: Math.random() * 1,
    color: palette[index % palette.length],
  }));
}

function makeContributionStars(events) {
  currentEvents = events;
  const sourceEvents = events.length
    ? events
    : Array.from({ length: 28 }, (_, index) => ({
        type: ["PushEvent", "CreateEvent", "PullRequestEvent", "IssuesEvent"][index % 4],
        repo: { name: `demo/repo-${index + 1}` },
      }));

  const stars = sourceEvents.slice(0, 80);
  const angleStep = (Math.PI * 2) / Math.max(stars.length, 1);

  contributionStars = stars.map((event, index) => {
    const ring = Math.sqrt(Math.random()) * Math.min(width, height) * 0.46;
    const angle = angleStep * index + (Math.random() - 0.5) * angleStep * 0.7;
    return {
      event,
      x: center.x + Math.cos(angle) * ring + (Math.random() - 0.5) * 30,
      y: center.y + Math.sin(angle) * ring * 0.62 + (Math.random() - 0.5) * 30,
      radius: 1.4 + Math.random() * 2.8,
      pulse: Math.random() * Math.PI * 2,
      color: palette[index % palette.length],
    };
  });
}

function setRepoCommitCount(value) {
  if (repoCommitCount) repoCommitCount.textContent = value;
}

function readStoredProfile(cacheKey) {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_STORAGE_KEY);
    if (!raw) return null;

    const entries = JSON.parse(raw);
    const entry = entries[cacheKey];
    if (!entry || Date.now() - entry.savedAt > PROFILE_CACHE_TTL_MS) return null;

    return entry.data;
  } catch {
    return null;
  }
}

function writeStoredProfile(cacheKey, data) {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_STORAGE_KEY);
    const entries = raw ? JSON.parse(raw) : {};
    entries[cacheKey] = { savedAt: Date.now(), data };
    localStorage.setItem(PROFILE_CACHE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

function githubApiUrl(path) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${GITHUB_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

async function githubFetch(path) {
  const response = await fetch(githubApiUrl(path), { headers: githubHeaders });
  let body = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { response, body };
}

function githubErrorMessage(response, body, fallback) {
  if (response.status === 403 && body?.message?.toLowerCase().includes("rate limit")) {
    return "GitHub API rate limit reached. Wait about an hour, then try again. Demo mode still works.";
  }
  if (response.status === 404) {
    return "That GitHub profile was not found. Check the username and try again.";
  }
  if (body?.message) return body.message;
  return fallback;
}

function applyProfileData(user, repos, events) {
  currentUsername = user.login;
  contributorCache.clear();
  galaxyTitle.textContent = `${user.login}'s code galaxy`;
  galaxyTitle.classList.add("is-loaded");
  repoCount.textContent = user.public_repos ?? repos.length;
  starCount.textContent = repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
  activityCount.textContent = events.length;
  makePlanets(repos.length ? repos : demoRepos);
  makeContributionStars(events);
  makeSparks(events);
  setStatus(`${repos.length} public repositories loaded.`);
}

async function loadProfile(username) {
  const cleanName = username.trim();
  if (!cleanName) return;

  const cacheKey = cleanName.toLowerCase();
  if (profileCache.has(cacheKey)) {
    const cached = profileCache.get(cacheKey);
    applyProfileData(...cached);
    setStatus(`${cached[1].length} public repositories loaded (cached).`);
    return;
  }

  const storedProfile = readStoredProfile(cacheKey);
  if (storedProfile) {
    profileCache.set(cacheKey, storedProfile);
    applyProfileData(...storedProfile);
    setStatus(`${storedProfile[1].length} public repositories loaded (cached).`);
    return;
  }

  setStatus(`Launching ${cleanName}'s galaxy...`);
  profileForm.classList.add("is-loading");

  try {
    const userResult = await githubFetch(`/users/${encodeURIComponent(cleanName)}`);
    if (!userResult.response.ok) {
      throw new Error(githubErrorMessage(userResult.response, userResult.body, "Could not load that GitHub profile."));
    }

    const [reposResult, eventsResult] = await Promise.all([
      githubFetch(`/users/${encodeURIComponent(cleanName)}/repos?sort=updated&per_page=100`),
      githubFetch(`/users/${encodeURIComponent(cleanName)}/events/public?per_page=50`),
    ]);

    if (!reposResult.response.ok) {
      throw new Error(
        githubErrorMessage(reposResult.response, reposResult.body, "GitHub did not return repository data."),
      );
    }

    const user = userResult.body;
    const repos = Array.isArray(reposResult.body) ? reposResult.body : [];
    const events = eventsResult.response.ok && Array.isArray(eventsResult.body) ? eventsResult.body : [];
    const profileData = [user, repos, events];

    profileCache.set(cacheKey, profileData);
    writeStoredProfile(cacheKey, profileData);
    applyProfileData(user, repos, events);
  } catch (error) {
    setStatus(error.message || "Could not load that GitHub profile.");
  } finally {
    profileForm.classList.remove("is-loading");
  }
}

function loadDemo() {
  currentUsername = "demo";
  contributorCache.clear();
  galaxyTitle.textContent = "Demo code galaxy";
  galaxyTitle.classList.add("is-loaded");
  repoCount.textContent = demoRepos.length;
  starCount.textContent = demoRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  activityCount.textContent = 28;
  makePlanets(demoRepos);
  makeContributionStars([]);
  makeSparks(Array.from({ length: 28 }));
  setStatus("Demo galaxy loaded.");
}

function setStatus(message) {
  statusText.textContent = message;
}

function demoCommitCount(repo) {
  const seed = repo.name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 8 + (seed % 40) + (repo.forks_count || 0) * 3;
}

async function updateRepoCommitCount(planet) {
  if (!planet) {
    setRepoCommitCount("—");
    return;
  }

  if (currentUsername === "demo") {
    setRepoCommitCount(demoCommitCount(planet.repo));
    return;
  }

  const fullName = planet.repo.full_name;
  if (!fullName || !currentUsername) {
    setRepoCommitCount("—");
    return;
  }

  if (contributorCache.has(fullName)) {
    setRepoCommitCount(contributorCache.get(fullName));
    return;
  }

  setRepoCommitCount("…");

  const [owner, repoName] = fullName.split("/");
  if (!owner || !repoName) {
    setRepoCommitCount("—");
    return;
  }

  try {
    const { response, body } = await githubFetch(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/contributors?per_page=100`,
    );
    if (!response.ok) throw new Error("Could not load commit count.");

    const contributors = Array.isArray(body) ? body : [];
    const match = contributors.find(
      (contributor) => contributor.login.toLowerCase() === currentUsername.toLowerCase(),
    );
    const count = match?.contributions ?? 0;
    contributorCache.set(fullName, count);

    if (selectedPlanet === planet) {
      setRepoCommitCount(count);
    }
  } catch {
    if (selectedPlanet === planet) {
      setRepoCommitCount("—");
    }
  }
}

function selectPlanet(planet) {
  if (planet === selectedPlanet) return;
  selectedPlanet = planet;
  if (!planet) {
    selectedName.textContent = "Hover a planet";
    selectedDescription.textContent = "Repositories become planets. Your public contributions become stars around the galaxy.";
    selectedLink.href = "#";
    selectedLink.setAttribute("aria-disabled", "true");
    setRepoCommitCount("—");
    return;
  }

  selectedName.textContent = planet.repo.name;
  selectedDescription.textContent = planet.repo.description || "No description yet.";
  selectedLink.href = planet.repo.html_url;
  selectedLink.removeAttribute("aria-disabled");
  updateRepoCommitCount(planet);
}

function renderRepoList() {
  repoList.innerHTML = "";
  planets.forEach((planet) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "repo-chip";
    button.innerHTML = `
      <span style="--chip-color:${planet.color}"></span>
      <strong>${planet.repo.name}</strong>
      <small>${planet.repo.language || "Code"} · ${planet.repo.stargazers_count || 0} stars</small>
    `;
    button.addEventListener("click", () => selectPlanet(planet));
    repoList.appendChild(button);
  });
}

function drawBackground(time) {
  const gradient = ctx.createRadialGradient(center.x, center.y, 30, center.x, center.y, Math.max(width, height) * 0.75);
  gradient.addColorStop(0, "#20344f");
  gradient.addColorStop(0.5, "#111827");
  gradient.addColorStop(1, "#050816");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  starfield.forEach((star) => {
    const glow = star.alpha + Math.sin(time * 0.002 + star.pulse) * 0.18;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, glow)})`;
    ctx.fill();
  });
}

function drawOrbit(planet) {
  ctx.beginPath();
  ctx.ellipse(center.x, center.y, planet.orbit, planet.orbit * orbitYScale, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawPlanet(planet) {
  const isSelected = selectedPlanet === planet;
  const hoverDistance = Math.hypot(pointerWorld.x - planet.x, pointerWorld.y - planet.y);
  const isHovered = hoverDistance < planet.radius + 10;
  if (isHovered) selectPlanet(planet);

  const glow = ctx.createRadialGradient(planet.x, planet.y, 2, planet.x, planet.y, planet.radius * 2.8);
  glow.addColorStop(0, planet.color);
  glow.addColorStop(0.42, `${planet.color}99`);
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(planet.x, planet.y, planet.radius * (isSelected ? 3.2 : 2.4), 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(planet.x, planet.y, planet.radius, 0, Math.PI * 2);
  ctx.fillStyle = planet.color;
  ctx.fill();
  ctx.lineWidth = isSelected ? 3 : 1;
  ctx.strokeStyle = isSelected ? "#ffffff" : "rgba(255,255,255,0.65)";
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "600 12px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(planet.repo.name.slice(0, 18), planet.x, planet.y + planet.radius + 18);
}

function drawSpark(spark, delta) {
  spark.life += delta * 0.8;
  spark.x += spark.vx * delta;
  spark.y += spark.vy * delta;

  if (spark.x < -40 || spark.x > width + 40 || spark.y < -40 || spark.y > height + 40 || spark.life > 1.8) {
    spark.x = Math.random() * width;
    spark.y = Math.random() * height;
    spark.vx = (Math.random() - 0.5) * 140;
    spark.vy = (Math.random() - 0.5) * 140;
    spark.life = 0;
  }

  ctx.beginPath();
  ctx.arc(spark.x, spark.y, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = spark.color;
  ctx.fill();
}

function drawContributionStar(star, time) {
  const twinkle = 0.55 + Math.sin(time * 0.004 + star.pulse) * 0.35;
  const hoverDistance = Math.hypot(pointerWorld.x - star.x, pointerWorld.y - star.y);
  const isHovered = hoverDistance < 14;
  const showLabel = isHovered || zoom >= ZOOM_LABEL_THRESHOLD;

  ctx.beginPath();
  ctx.arc(star.x, star.y, star.radius * (isHovered ? 2.4 : 1), 0, Math.PI * 2);
  ctx.fillStyle = star.color;
  ctx.globalAlpha = Math.max(0.25, twinkle);
  ctx.shadowColor = star.color;
  ctx.shadowBlur = isHovered ? 22 : 10;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  if (showLabel) {
    const repoName = star.event.repo?.name || "Contribution";
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 12px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(star.event.type || "Contribution", star.x, star.y - 15);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "600 11px Inter, system-ui, sans-serif";
    ctx.fillText(repoName.split("/").pop().slice(0, 18), star.x, star.y + 22);
  }
}

function animate(now) {
  const delta = Math.min((now - lastFrame) / 1000, 0.04);
  lastFrame = now;
  pointerWorld = toWorld(pointer);

  ctx.save();
  ctx.translate(panX, panY);
  ctx.translate(center.x, center.y);
  ctx.scale(zoom, zoom);
  ctx.translate(-center.x, -center.y);

  drawBackground(now);

  planets.forEach(drawOrbit);

  if (!paused) {
    planets.forEach((planet) => {
      planet.angle += planet.speed * delta;
      updatePlanetPosition(planet);
    });
  }

  contributionStars.forEach((star) => drawContributionStar(star, now));
  sparks.forEach((spark) => drawSpark(spark, paused ? 0 : delta));
  planets.forEach(drawPlanet);

  ctx.restore();

  requestAnimationFrame(animate);
}

profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadProfile(usernameInput.value);
});

function exportGalaxyImage() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentUsername || "github"}-galaxy.png`;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

demoButton.addEventListener("click", loadDemo);
exportButton.addEventListener("click", exportGalaxyImage);

pauseButton.addEventListener("click", () => {
  paused = !paused;
  pauseButton.textContent = paused ? "Play" : "Pause";
});

shuffleButton.addEventListener("click", () => {
  planets.forEach((planet) => {
    planet.angle = Math.random() * Math.PI * 2;
    planet.speed = 0.05 + Math.random() * 0.12;
  });
  makeContributionStars(currentEvents);
  makeSparks(sparks);
});

canvas.addEventListener("pointermove", (event) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = event.clientX - rect.left;
  pointer.y = event.clientY - rect.top;

  if (isPanning) {
    panX = panStartOffset.x + (pointer.x - panStartPointer.x);
    panY = panStartOffset.y + (pointer.y - panStartPointer.y);
  }
});

canvas.addEventListener("pointerleave", () => {
  pointer = { x: -9999, y: -9999 };
});

canvas.addEventListener("pointerdown", (event) => {
  isPanning = true;
  canvas.setPointerCapture(event.pointerId);
  panStartPointer = { x: pointer.x, y: pointer.y };
  panStartOffset = { x: panX, y: panY };
  canvas.classList.add("is-panning");
});

canvas.addEventListener("pointerup", (event) => {
  isPanning = false;
  canvas.releasePointerCapture(event.pointerId);
  canvas.classList.remove("is-panning");
});

canvas.addEventListener("pointercancel", () => {
  isPanning = false;
  canvas.classList.remove("is-panning");
});

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const factor = Math.exp(-event.deltaY * 0.0015);
    zoomAt(screenX, screenY, factor);
  },
  { passive: false },
);

canvas.addEventListener("dblclick", () => {
  resetView();
});

zoomInButton.addEventListener("click", () => zoomAt(center.x, center.y, 1.3));
zoomOutButton.addEventListener("click", () => zoomAt(center.x, center.y, 1 / 1.3));
zoomResetButton.addEventListener("click", resetView);

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
loadDemo();
requestAnimationFrame(animate);
