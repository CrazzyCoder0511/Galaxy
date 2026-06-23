const canvas = document.querySelector("#galaxyCanvas");
const ctx = canvas.getContext("2d");

const profileForm = document.querySelector("#profileForm");
const usernameLabel = document.querySelector("#usernameLabel");
const usernameInput = document.querySelector("#usernameInput");
const galaxyTitle = document.querySelector("#galaxyTitle");
const repoCount = document.querySelector("#repoCount");
const starCount = document.querySelector("#starCount");
const activityCount = document.querySelector("#activityCount");
const statusText = document.querySelector("#statusText");
const selectedName = document.querySelector("#selectedName");
const selectedDescription = document.querySelector("#selectedDescription");
const selectedLink = document.querySelector("#selectedLink");
const repoList = document.querySelector("#repoList");
const demoButton = document.querySelector("#demoButton");
const modeButton = document.querySelector("#modeButton");
const pauseButton = document.querySelector("#pauseButton");
const shuffleButton = document.querySelector("#shuffleButton");

let width = 0;
let height = 0;
let center = { x: 0, y: 0 };
let planets = [];
let sparks = [];
let starfield = [];
let contributionStars = [];
let currentEvents = [];
let currentProfiles = [];
let pointer = { x: -9999, y: -9999 };
let selectedPlanet = null;
let searchMode = "single";
let paused = false;
let lastFrame = performance.now();

const palette = ["#7dd3fc", "#f9a8d4", "#fde68a", "#86efac", "#c4b5fd", "#fca5a5"];
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

const demoProfile = {
  user: { login: "demo" },
  repos: demoRepos,
  events: Array.from({ length: 28 }),
};

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

function makePlanets(repos, owner = "demo") {
  makeGalaxies([{ user: { login: owner }, repos, events: [] }]);
}

function makeGalaxies(profiles) {
  currentProfiles = profiles;
  planets = profiles.flatMap((profile, galaxyIndex) => {
    const visibleRepos = profile.repos
      .filter((repo) => !repo.fork)
      .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
      .slice(0, 12);

    return visibleRepos.map((repo, repoIndex) => ({
      repo,
      owner: profile.user.login,
      galaxyIndex,
      galaxyTotal: profiles.length,
      isMain: repoIndex === 0,
      color: palette[(galaxyIndex + repoIndex) % palette.length],
      angle: Math.random() * Math.PI * 2,
      speed: 0.05 + Math.random() * 0.12,
      orbit: 90,
      radius: 14,
      x: center.x,
      y: center.y,
      home: { x: center.x, y: center.y },
    }));
  });

  placePlanets();
  renderRepoList();
  selectPlanet(planets[0] || null);
}

function getGalaxyCenter(index, total) {
  if (total <= 1) return center;

  const compact = width < 720;
  const radiusX = Math.min(width * (compact ? 0.28 : 0.3), compact ? 130 : 260);
  const radiusY = Math.min(height * 0.24, compact ? 120 : 190);
  const angle = total === 2 ? index * Math.PI : -Math.PI / 2 + (index * Math.PI * 2) / total;

  return {
    x: center.x + Math.cos(angle) * radiusX,
    y: center.y + Math.sin(angle) * radiusY,
  };
}

function placePlanets() {
  const totalGalaxies = Math.max(1, currentProfiles.length || 1);
  const clusterScale = totalGalaxies > 1 ? 0.24 : 0.38;
  const maxOrbit = Math.max(68, Math.min(width, height) * clusterScale);
  const groupedCounts = planets.reduce((counts, planet) => {
    counts[planet.galaxyIndex] = (counts[planet.galaxyIndex] || 0) + (planet.isMain ? 0 : 1);
    return counts;
  }, {});
  const seenOrbiters = {};

  planets.forEach((planet) => {
    planet.home = getGalaxyCenter(planet.galaxyIndex, totalGalaxies);
    planet.radius = 12 + Math.sqrt((planet.repo.stargazers_count || 0) + 1) * (planet.isMain ? 4 : 3);
    planet.radius = Math.min(planet.isMain ? 42 : 30, planet.radius);

    if (planet.isMain) {
      planet.x = planet.home.x;
      planet.y = planet.home.y;
      return;
    }

    const orbitIndex = seenOrbiters[planet.galaxyIndex] || 0;
    const orbitCount = Math.max(groupedCounts[planet.galaxyIndex] || 1, 1);
    seenOrbiters[planet.galaxyIndex] = orbitIndex + 1;
    planet.orbit = 48 + (maxOrbit * (orbitIndex + 1)) / orbitCount;
    updatePlanetPosition(planet);
  });
}

function updatePlanetPosition(planet) {
  planet.x = planet.home.x + Math.cos(planet.angle) * planet.orbit;
  planet.y = planet.home.y + Math.sin(planet.angle) * planet.orbit * orbitYScale;
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

  contributionStars = sourceEvents.slice(0, 80).map((event, index) => {
    const ring = Math.random() * Math.min(width, height) * 0.42;
    const angle = Math.random() * Math.PI * 2;
    return {
      event,
      x: center.x + Math.cos(angle) * ring + (Math.random() - 0.5) * 80,
      y: center.y + Math.sin(angle) * ring * 0.62 + (Math.random() - 0.5) * 80,
      radius: 1.4 + Math.random() * 2.8,
      pulse: Math.random() * Math.PI * 2,
      color: palette[index % palette.length],
    };
  });
}

function parseUsernames(value) {
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 4);
}

async function fetchGithubProfile(username) {
  const [userResponse, reposResponse, eventsResponse] = await Promise.all([
    fetch(`https://api.github.com/users/${encodeURIComponent(username)}`),
    fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100`),
    fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=50`),
  ]);

  if (!userResponse.ok) throw new Error(`${username} was not found.`);
  if (!reposResponse.ok) throw new Error(`GitHub did not return repository data for ${username}.`);

  const user = await userResponse.json();
  const repos = await reposResponse.json();
  const events = eventsResponse.ok ? await eventsResponse.json() : [];
  return { user, repos, events };
}

async function loadProfile(value) {
  const usernames = parseUsernames(searchMode === "multi" ? value : value.split(",")[0] || "");
  if (!usernames.length) return;

  const label = searchMode === "multi" ? usernames.join(", ") : usernames[0];
  setStatus(`Launching ${label}...`);
  profileForm.classList.add("is-loading");

  try {
    const results = await Promise.allSettled(usernames.map(fetchGithubProfile));
    const profiles = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
    const failed = results.filter((result) => result.status === "rejected").map((result) => result.reason.message);

    if (!profiles.length) throw new Error(failed[0] || "No GitHub profiles were found.");

    const totalRepos = profiles.reduce((sum, profile) => sum + (profile.user.public_repos ?? profile.repos.length), 0);
    const totalStars = profiles.reduce(
      (sum, profile) => sum + profile.repos.reduce((repoSum, repo) => repoSum + (repo.stargazers_count || 0), 0),
      0
    );
    const totalEvents = profiles.reduce((sum, profile) => sum + profile.events.length, 0);
    const allEvents = profiles.flatMap((profile) =>
      profile.events.map((event) => ({ ...event, owner: profile.user.login }))
    );

    galaxyTitle.textContent =
      profiles.length > 1
        ? `${profiles.map((profile) => profile.user.login).join(" vs ")}`
        : `${profiles[0].user.login}'s code galaxy`;
    repoCount.textContent = totalRepos;
    starCount.textContent = totalStars;
    activityCount.textContent = totalEvents;
    makeGalaxies(profiles);
    makeContributionStars(allEvents);
    makeSparks(allEvents);

    const loadedText =
      profiles.length > 1
        ? `${profiles.length} galaxies loaded for comparison.`
        : `${profiles[0].repos.length} public repositories loaded.`;
    setStatus(failed.length ? `${loadedText} ${failed.join(" ")}` : loadedText);
  } catch (error) {
    setStatus(error.message);
  } finally {
    profileForm.classList.remove("is-loading");
  }
}

function loadDemo() {
  galaxyTitle.textContent = "Demo code galaxy";
  repoCount.textContent = demoRepos.length;
  starCount.textContent = demoRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  activityCount.textContent = 28;
  makeGalaxies([demoProfile]);
  makeContributionStars([]);
  makeSparks(Array.from({ length: 28 }));
  setStatus("Demo galaxy loaded.");
}

function setStatus(message) {
  statusText.textContent = message;
}

function selectPlanet(planet) {
  selectedPlanet = planet;
  if (!planet) {
    selectedName.textContent = "Hover a planet";
    selectedDescription.textContent = "Repositories become planets. Your public contributions become stars around the galaxy.";
    selectedLink.href = "#";
    selectedLink.setAttribute("aria-disabled", "true");
    return;
  }

  selectedName.textContent = planet.repo.name;
  selectedDescription.textContent = `${planet.owner}${planet.isMain ? "'s main repository" : "'s repository"}: ${
    planet.repo.description || "No description yet."
  }`;
  selectedLink.href = planet.repo.html_url;
  selectedLink.removeAttribute("aria-disabled");
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
      <small>${planet.owner} · ${planet.isMain ? "main repo" : planet.repo.language || "Code"} · ${
      planet.repo.stargazers_count || 0
    } stars</small>
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
  if (planet.isMain) return;
  ctx.beginPath();
  ctx.ellipse(planet.home.x, planet.home.y, planet.orbit, planet.orbit * orbitYScale, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawPlanet(planet) {
  const isSelected = selectedPlanet === planet;
  const hoverDistance = Math.hypot(pointer.x - planet.x, pointer.y - planet.y);
  const isHovered = hoverDistance < planet.radius + 10;
  if (isHovered) selectPlanet(planet);

  const glow = ctx.createRadialGradient(planet.x, planet.y, 2, planet.x, planet.y, planet.radius * 2.8);
  glow.addColorStop(0, planet.color);
  glow.addColorStop(0.42, `${planet.color}99`);
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(planet.x, planet.y, planet.radius * (planet.isMain ? 3.5 : isSelected ? 3.2 : 2.4), 0, Math.PI * 2);
  ctx.fill();

  if (planet.isMain) {
    ctx.save();
    ctx.translate(planet.x, planet.y);
    ctx.rotate(planet.angle * 0.25);
    ctx.beginPath();
    for (let point = 0; point < 16; point += 1) {
      const radius = point % 2 === 0 ? planet.radius * 1.45 : planet.radius * 0.82;
      const angle = (point / 16) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (point === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = planet.color;
    ctx.fill();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(planet.x, planet.y, planet.radius, 0, Math.PI * 2);
  ctx.fillStyle = planet.isMain ? "#fff7cc" : planet.color;
  ctx.fill();
  ctx.lineWidth = isSelected ? 3 : 1;
  ctx.strokeStyle = isSelected ? "#ffffff" : "rgba(255,255,255,0.65)";
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "600 12px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(planet.repo.name.slice(0, 18), planet.x, planet.y + planet.radius + (planet.isMain ? 24 : 18));
  if (currentProfiles.length > 1) {
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "700 11px Inter, system-ui, sans-serif";
    ctx.fillText(planet.owner, planet.x, planet.y - planet.radius - 13);
  }
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
  const hoverDistance = Math.hypot(pointer.x - star.x, pointer.y - star.y);

  ctx.beginPath();
  ctx.arc(star.x, star.y, star.radius * (hoverDistance < 14 ? 2.4 : 1), 0, Math.PI * 2);
  ctx.fillStyle = star.color;
  ctx.globalAlpha = Math.max(0.25, twinkle);
  ctx.shadowColor = star.color;
  ctx.shadowBlur = hoverDistance < 14 ? 22 : 10;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  if (hoverDistance < 14) {
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
  drawBackground(now);

  planets.forEach(drawOrbit);

  if (!paused) {
    planets.forEach((planet) => {
      if (planet.isMain) return;
      planet.angle += planet.speed * delta;
      updatePlanetPosition(planet);
    });
  }

  contributionStars.forEach((star) => drawContributionStar(star, now));
  sparks.forEach((spark) => drawSpark(spark, paused ? 0 : delta));
  planets.forEach(drawPlanet);

  requestAnimationFrame(animate);
}

profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadProfile(usernameInput.value);
});

demoButton.addEventListener("click", loadDemo);

modeButton.addEventListener("click", () => {
  searchMode = searchMode === "single" ? "multi" : "single";
  const isMulti = searchMode === "multi";
  modeButton.textContent = isMulti ? "Multi-user search" : "Single user search";
  usernameLabel.textContent = isMulti ? "GitHub usernames" : "GitHub username";
  usernameInput.placeholder = isMulti ? "octocat, torvalds, gaearon" : "octocat";
  usernameInput.setAttribute("aria-label", isMulti ? "GitHub usernames separated by commas" : "GitHub username");
  setStatus(isMulti ? "Enter GitHub usernames separated by commas." : "Enter one GitHub username to launch.");
});

pauseButton.addEventListener("click", () => {
  paused = !paused;
  pauseButton.textContent = paused ? "Play" : "Pause";
});

shuffleButton.addEventListener("click", () => {
  planets.forEach((planet) => {
    if (planet.isMain) return;
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
});

canvas.addEventListener("pointerleave", () => {
  pointer = { x: -9999, y: -9999 };
});

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
loadDemo();
requestAnimationFrame(animate);
