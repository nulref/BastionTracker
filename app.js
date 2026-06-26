(function () {
  "use strict";

  const DATA_URL = "data/bastion.json";
  const STORAGE_KEY = "bastion-tracker:v1";
  const GITHUB_CONFIG_KEY = "bastion-tracker:github-config:v1";
  const GITHUB_TOKEN_SESSION_KEY = "bastion-tracker:github-token:session";
  const GITHUB_TOKEN_LOCAL_KEY = "bastion-tracker:github-token:local";
  const GITHUB_API_VERSION = "2022-11-28";
  const FACILITY_COUNT = 6;
  const BASIC_COUNT = 12;
  const DEFAULT_GITHUB_CONFIG = {
    owner: "nulref",
    repo: "BastionTracker",
    branch: "main",
    path: "data/bastion.json",
    tokenStorage: "session",
    committerName: "",
    committerEmail: ""
  };

  const form = document.getElementById("trackerForm");
  const basicContainer = document.getElementById("basicFacilities");
  const facilityContainer = document.getElementById("specialFacilities");
  const saveState = document.getElementById("saveState");
  const menuButton = document.querySelector("[data-action='menu-toggle']");
  const actionMenu = document.getElementById("actionMenu");
  const githubDialog = document.getElementById("githubDialog");
  const githubForm = document.getElementById("githubForm");
  const githubStatus = document.getElementById("githubStatus");
  const basicTemplate = document.getElementById("basicLineTemplate");
  const facilityTemplate = document.getElementById("facilityTemplate");

  let state = blankState();
  let repoState = blankState();
  let githubConfig = loadGithubConfig();
  let remoteJsonSha = "";
  let autosaveTimer = 0;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    buildBasicFacilities();
    buildSpecialFacilities();
    bindEvents();
    await loadInitialState();
  }

  function blankState() {
    return {
      meta: {
        version: 1,
        updatedAt: ""
      },
      bastionName: "",
      characterName: "",
      level: "",
      basicFacilities: Array.from({ length: BASIC_COUNT }, () => ""),
      bastionDefenders: "",
      specialFacilities: Array.from({ length: FACILITY_COUNT }, () => ({
        name: "",
        space: "",
        order: "",
        hirelings: "",
        notes: ""
      }))
    };
  }

  function normalizeState(value) {
    const next = blankState();
    const source = value && typeof value === "object" ? value : {};

    next.meta = {
      version: Number(source.meta && source.meta.version) || 1,
      updatedAt: String((source.meta && source.meta.updatedAt) || "")
    };
    next.bastionName = String(source.bastionName || "");
    next.characterName = String(source.characterName || "");
    next.level = String(source.level || "");
    next.bastionDefenders = String(source.bastionDefenders || "");

    if (Array.isArray(source.basicFacilities)) {
      source.basicFacilities.slice(0, BASIC_COUNT).forEach((item, index) => {
        next.basicFacilities[index] = String(item || "");
      });
    }

    if (Array.isArray(source.specialFacilities)) {
      source.specialFacilities.slice(0, FACILITY_COUNT).forEach((item, index) => {
        const facility = item && typeof item === "object" ? item : {};
        next.specialFacilities[index] = {
          name: String(facility.name || ""),
          space: String(facility.space || ""),
          order: String(facility.order || ""),
          hirelings: String(facility.hirelings || ""),
          notes: String(facility.notes || "")
        };
      });
    }

    return next;
  }

  function buildBasicFacilities() {
    basicContainer.innerHTML = "";
    for (let index = 0; index < BASIC_COUNT; index += 1) {
      const fragment = basicTemplate.content.cloneNode(true);
      const label = fragment.querySelector("label");
      const hiddenLabel = fragment.querySelector("span");
      const input = fragment.querySelector("input");

      label.classList.add(index % 2 === 0 ? "line-field--left" : "line-field--right");
      hiddenLabel.textContent = `Basic facility ${index + 1}`;
      input.dataset.field = `basicFacilities.${index}`;
      input.setAttribute("aria-label", `Basic facility ${index + 1}`);

      basicContainer.appendChild(fragment);
    }
  }

  function buildSpecialFacilities() {
    facilityContainer.innerHTML = "";
    for (let index = 0; index < FACILITY_COUNT; index += 1) {
      const fragment = facilityTemplate.content.cloneNode(true);
      const article = fragment.querySelector(".facility-card");
      const name = fragment.querySelector(".facility-name input");
      const space = fragment.querySelector(".compact-field--space input");
      const order = fragment.querySelector(".compact-field--order input");
      const hirelings = fragment.querySelector(".compact-field--hirelings input");
      const notes = fragment.querySelector(".notes-field textarea");

      article.setAttribute("aria-label", `Special facility ${index + 1}`);
      name.dataset.field = `specialFacilities.${index}.name`;
      space.dataset.field = `specialFacilities.${index}.space`;
      order.dataset.field = `specialFacilities.${index}.order`;
      hirelings.dataset.field = `specialFacilities.${index}.hirelings`;
      notes.dataset.field = `specialFacilities.${index}.notes`;

      name.setAttribute("aria-label", `Special facility ${index + 1} name`);
      space.setAttribute("aria-label", `Special facility ${index + 1} space`);
      order.setAttribute("aria-label", `Special facility ${index + 1} order`);
      hirelings.setAttribute("aria-label", `Special facility ${index + 1} hirelings`);
      notes.setAttribute("aria-label", `Special facility ${index + 1} notes`);

      facilityContainer.appendChild(fragment);
    }
  }

  function bindEvents() {
    form.addEventListener("input", (event) => {
      const field = event.target.closest("[data-field]");
      if (!field) {
        return;
      }

      setByPath(state, field.dataset.field, field.value);
      scheduleAutosave();
    });

    menuButton.addEventListener("click", toggleActionMenu);
    document.addEventListener("click", closeMenuOnOutsideClick);
    document.addEventListener("keydown", closeMenuOnEscape);
    actionMenu.addEventListener("click", closeMenuAfterAction);
    document.querySelector("[data-action='github-pull']").addEventListener("click", pullFromGitHub);
    document.querySelector("[data-action='github-push']").addEventListener("click", pushToGitHub);
    document.querySelector("[data-action='github-settings']").addEventListener("click", openGithubSettings);
    document.querySelector("[data-action='print']").addEventListener("click", () => window.print());
    document.querySelector("[data-action='github-close']").addEventListener("click", closeGithubSettings);
    document.querySelector("[data-action='github-save-settings']").addEventListener("click", saveGithubSettings);
    document.querySelector("[data-action='github-disconnect']").addEventListener("click", disconnectGithub);
    document.querySelector("[data-action='github-refresh-branches']").addEventListener("click", refreshGithubBranches);
  }

  function toggleActionMenu() {
    const isOpen = !actionMenu.hidden;
    setActionMenuOpen(!isOpen);
  }

  function setActionMenuOpen(isOpen) {
    actionMenu.hidden = !isOpen;
    menuButton.setAttribute("aria-expanded", String(isOpen));
  }

  function closeMenuOnOutsideClick(event) {
    if (actionMenu.hidden || event.target.closest(".toolbar")) {
      return;
    }

    setActionMenuOpen(false);
  }

  function closeMenuOnEscape(event) {
    if (event.key !== "Escape" || actionMenu.hidden) {
      return;
    }

    setActionMenuOpen(false);
    menuButton.focus();
  }

  function closeMenuAfterAction(event) {
    if (event.target.closest("[role='menuitem']")) {
      setActionMenuOpen(false);
    }
  }

  async function loadInitialState() {
    setStatus("Loading");

    try {
      const remote = await fetchLatestGithubJson();
      state = remote.state;
      remoteJsonSha = remote.sha;
      render();
      cacheLocal("Loaded");
      return;
    } catch (error) {
      setGithubStatus(error.message);
    }

    try {
      repoState = await fetchRepoState();
      state = repoState;
      render();
      cacheLocal("Loaded");
      return;
    } catch (error) {
      const local = readLocalState();
      state = local || blankState();
    }

    render();
    setStatus(readLocalState() ? "Local autosave" : "Blank tracker");
  }

  async function fetchRepoState() {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load ${DATA_URL}`);
    }
    return normalizeState(await response.json());
  }

  function loadGithubConfig() {
    try {
      return normalizeGithubConfig(JSON.parse(localStorage.getItem(GITHUB_CONFIG_KEY) || "{}"));
    } catch (error) {
      return normalizeGithubConfig({});
    }
  }

  function normalizeGithubConfig(value) {
    const source = value && typeof value === "object" ? value : {};
    const tokenStorage = source.tokenStorage === "local" ? "local" : "session";

    return {
      owner: String(source.owner || DEFAULT_GITHUB_CONFIG.owner),
      repo: String(source.repo || DEFAULT_GITHUB_CONFIG.repo),
      branch: String(source.branch || DEFAULT_GITHUB_CONFIG.branch),
      path: String(source.path || DEFAULT_GITHUB_CONFIG.path),
      tokenStorage,
      committerName: String(source.committerName || ""),
      committerEmail: String(source.committerEmail || "")
    };
  }

  function openGithubSettings() {
    renderGithubSettings();
    setGithubStatus(getGithubToken() ? "Connected" : "Token needed for push");
    if (typeof githubDialog.showModal === "function") {
      githubDialog.showModal();
    } else {
      githubDialog.setAttribute("open", "");
    }
    refreshGithubBranches();
  }

  function closeGithubSettings() {
    if (typeof githubDialog.close === "function") {
      githubDialog.close();
    } else {
      githubDialog.removeAttribute("open");
    }
  }

  function renderGithubSettings() {
    githubForm.elements.owner.value = githubConfig.owner;
    githubForm.elements.repo.value = githubConfig.repo;
    setBranchOptions([githubConfig.branch], githubConfig.branch);
    githubForm.elements.path.value = githubConfig.path;
    githubForm.elements.token.value = getGithubToken();
    githubForm.elements.tokenStorage.value = githubConfig.tokenStorage;
    githubForm.elements.committerName.value = githubConfig.committerName;
    githubForm.elements.committerEmail.value = githubConfig.committerEmail;
  }

  function saveGithubSettings() {
    const formData = new FormData(githubForm);
    githubConfig = normalizeGithubConfig({
      owner: formData.get("owner"),
      repo: formData.get("repo"),
      branch: formData.get("branch"),
      path: formData.get("path"),
      tokenStorage: formData.get("tokenStorage"),
      committerName: formData.get("committerName"),
      committerEmail: formData.get("committerEmail")
    });

    const token = String(formData.get("token") || "").trim();
    localStorage.setItem(GITHUB_CONFIG_KEY, JSON.stringify(githubConfig));
    saveGithubToken(token, githubConfig.tokenStorage);
    setGithubStatus(token ? "Settings saved" : "Settings saved without token");
    setStatus("GitHub settings saved");
  }

  function disconnectGithub() {
    remoteJsonSha = "";
    localStorage.removeItem(GITHUB_CONFIG_KEY);
    localStorage.removeItem(GITHUB_TOKEN_LOCAL_KEY);
    sessionStorage.removeItem(GITHUB_TOKEN_SESSION_KEY);
    githubConfig = normalizeGithubConfig({});
    renderGithubSettings();
    setGithubStatus("Disconnected");
    setStatus("GitHub disconnected");
  }

  async function refreshGithubBranches() {
    const config = currentGithubFormConfig();
    const token = currentGithubFormToken();

    try {
      setGithubStatus("Loading branches");
      const branches = await fetchGithubBranches(config, token);
      setBranchOptions(branches, config.branch);
      setGithubStatus(`${branches.length} branch${branches.length === 1 ? "" : "es"} loaded`);
    } catch (error) {
      setBranchOptions([config.branch], config.branch);
      setGithubStatus(error.message);
    }
  }

  function currentGithubFormConfig() {
    return normalizeGithubConfig({
      owner: githubForm.elements.owner.value,
      repo: githubForm.elements.repo.value,
      branch: githubForm.elements.branch.value,
      path: githubForm.elements.path.value,
      tokenStorage: githubForm.elements.tokenStorage.value,
      committerName: githubForm.elements.committerName.value,
      committerEmail: githubForm.elements.committerEmail.value
    });
  }

  function currentGithubFormToken() {
    return String(githubForm.elements.token.value || getGithubToken()).trim();
  }

  function setBranchOptions(branches, selectedBranch) {
    const select = githubForm.elements.branch;
    const names = Array.from(new Set(branches.filter(Boolean)));

    if (selectedBranch && !names.includes(selectedBranch)) {
      names.unshift(selectedBranch);
    }

    select.innerHTML = "";
    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });

    select.value = selectedBranch || names[0] || DEFAULT_GITHUB_CONFIG.branch;
  }

  function getGithubToken() {
    if (githubConfig.tokenStorage === "local") {
      return localStorage.getItem(GITHUB_TOKEN_LOCAL_KEY) || sessionStorage.getItem(GITHUB_TOKEN_SESSION_KEY) || "";
    }
    return sessionStorage.getItem(GITHUB_TOKEN_SESSION_KEY) || localStorage.getItem(GITHUB_TOKEN_LOCAL_KEY) || "";
  }

  function saveGithubToken(token, storage) {
    localStorage.removeItem(GITHUB_TOKEN_LOCAL_KEY);
    sessionStorage.removeItem(GITHUB_TOKEN_SESSION_KEY);
    if (!token) {
      return;
    }
    if (storage === "local") {
      localStorage.setItem(GITHUB_TOKEN_LOCAL_KEY, token);
    } else {
      sessionStorage.setItem(GITHUB_TOKEN_SESSION_KEY, token);
    }
  }

  async function pullFromGitHub() {
    try {
      setStatus("Loading");
      const remote = await fetchLatestGithubJson();
      state = remote.state;
      remoteJsonSha = remote.sha;
      render();
      cacheLocal("Loaded");
    } catch (error) {
      setStatus("Load failed");
      setGithubStatus(error.message);
      openGithubSettings();
    }
  }

  async function pushToGitHub() {
    const token = getGithubToken();
    if (!token) {
      setStatus("GitHub token needed");
      openGithubSettings();
      return;
    }

    try {
      setStatus("Saving");
      const remote = await fetchGithubJson(token);
      remoteJsonSha = remote.sha;

      const nextState = normalizeState(state);
      nextState.meta.updatedAt = new Date().toISOString();

      const body = {
        message: buildCommitMessage(nextState),
        content: toBase64(`${JSON.stringify(nextState, null, 2)}\n`),
        sha: remoteJsonSha,
        branch: githubConfig.branch
      };

      if (githubConfig.committerName && githubConfig.committerEmail) {
        body.committer = {
          name: githubConfig.committerName,
          email: githubConfig.committerEmail
        };
      }

      const response = await fetch(githubContentsUrl(), {
        method: "PUT",
        headers: githubHeaders(token),
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw await githubRequestError(response);
      }

      const payload = await response.json();
      remoteJsonSha = payload.content && payload.content.sha ? payload.content.sha : "";
      state = nextState;
      saveLocal("Saved");
      setGithubStatus("Saved");
    } catch (error) {
      setStatus("Save failed");
      setGithubStatus(error.message);
      openGithubSettings();
    }
  }

  async function fetchGithubJson(token) {
    const response = await fetch(`${githubContentsUrl()}?ref=${encodeURIComponent(githubConfig.branch)}`, {
      headers: githubHeaders(token)
    });

    if (!response.ok) {
      throw await githubRequestError(response);
    }

    const payload = await response.json();
    if (!payload.content || !payload.sha) {
      throw new Error("GitHub file response was incomplete.");
    }

    return {
      sha: payload.sha,
      state: normalizeState(JSON.parse(fromBase64(payload.content)))
    };
  }

  async function fetchLatestGithubJson() {
    const token = getGithubToken();

    try {
      return await fetchGithubJson(token);
    } catch (error) {
      if (!token) {
        throw error;
      }
      return fetchGithubJson();
    }
  }

  async function fetchGithubBranches(config, token) {
    const branches = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage && page <= 10) {
      const response = await fetch(githubBranchesUrl(config, page), {
        headers: githubHeaders(token)
      });

      if (!response.ok) {
        throw await githubRequestError(response);
      }

      const payload = await response.json();
      payload.forEach((branch) => {
        if (branch && branch.name) {
          branches.push(String(branch.name));
        }
      });

      hasNextPage = (response.headers.get("Link") || "").includes('rel="next"');
      page += 1;
    }

    if (!branches.length) {
      throw new Error("No branches found.");
    }

    return branches;
  }

  function githubContentsUrl() {
    return `https://api.github.com/repos/${encodeURIComponent(githubConfig.owner)}/${encodeURIComponent(githubConfig.repo)}/contents/${encodeGithubPath(githubConfig.path)}`;
  }

  function githubBranchesUrl(config, page) {
    return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/branches?per_page=100&page=${page}`;
  }

  function githubHeaders(token) {
    const headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": GITHUB_API_VERSION
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  async function githubRequestError(response) {
    try {
      const payload = await response.json();
      return new Error(payload.message || `GitHub returned ${response.status}.`);
    } catch (error) {
      return new Error(`GitHub returned ${response.status}.`);
    }
  }

  function encodeGithubPath(path) {
    return String(path)
      .split("/")
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join("/");
  }

  function buildCommitMessage(nextState) {
    const label = nextState.bastionName || nextState.characterName || "bastion tracker";
    return `Update ${label}`;
  }

  function setGithubStatus(message) {
    githubStatus.value = message;
  }

  function readLocalState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : null;
    } catch (error) {
      return null;
    }
  }

  function scheduleAutosave() {
    setStatus("Editing");
    window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => saveLocal(), 350);
  }

  function saveLocal(message) {
    state.meta.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setStatus(message || "Saved locally");
  }

  function cacheLocal(message) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setStatus(message || "Cached locally");
  }

  function render() {
    document.querySelectorAll("[data-field]").forEach((field) => {
      field.value = getByPath(state, field.dataset.field);
    });
  }

  function getByPath(source, path) {
    return path.split(".").reduce((target, part) => {
      if (target === undefined || target === null) {
        return "";
      }
      return target[part];
    }, source) || "";
  }

  function setByPath(target, path, value) {
    const parts = path.split(".");
    const last = parts.pop();
    const owner = parts.reduce((current, part) => current[part], target);
    owner[last] = value;
  }

  function setStatus(message) {
    saveState.value = message;
  }

  function toBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";

    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(index, index + 0x8000));
    }

    return btoa(binary);
  }

  function fromBase64(value) {
    const binary = atob(String(value).replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
}());
