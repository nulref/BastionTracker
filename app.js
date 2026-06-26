(function () {
  "use strict";

  const DATA_URL = "data/bastion.json";
  const STORAGE_KEY = "bastion-tracker:v1";
  const FACILITY_COUNT = 6;
  const BASIC_COUNT = 12;

  const form = document.getElementById("trackerForm");
  const basicContainer = document.getElementById("basicFacilities");
  const facilityContainer = document.getElementById("specialFacilities");
  const saveState = document.getElementById("saveState");
  const importInput = document.getElementById("jsonImport");
  const basicTemplate = document.getElementById("basicLineTemplate");
  const facilityTemplate = document.getElementById("facilityTemplate");

  let state = blankState();
  let repoState = blankState();
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

    document.querySelector("[data-action='repo']").addEventListener("click", loadRepoState);
    document.querySelector("[data-action='save']").addEventListener("click", saveLocal);
    document.querySelector("[data-action='export']").addEventListener("click", exportJson);
    document.querySelector("[data-action='import']").addEventListener("click", () => importInput.click());
    document.querySelector("[data-action='print']").addEventListener("click", () => window.print());

    importInput.addEventListener("change", importJson);
  }

  async function loadInitialState() {
    try {
      repoState = await fetchRepoState();
      const local = readLocalState();
      state = local || repoState;
      render();
      setStatus(local ? "Local autosave" : "Repo JSON loaded");
    } catch (error) {
      const local = readLocalState();
      state = local || blankState();
      render();
      setStatus(local ? "Local autosave" : "Blank tracker");
    }
  }

  async function fetchRepoState() {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load ${DATA_URL}`);
    }
    return normalizeState(await response.json());
  }

  async function loadRepoState() {
    try {
      repoState = await fetchRepoState();
      state = normalizeState(repoState);
      render();
      saveLocal("Repo JSON loaded");
    } catch (error) {
      setStatus("Repo JSON unavailable");
    }
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

  function exportJson() {
    const exportState = normalizeState(state);
    exportState.meta.updatedAt = new Date().toISOString();

    const blob = new Blob([JSON.stringify(exportState, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const baseName = slugify(exportState.bastionName || exportState.characterName || "bastion");

    anchor.href = url;
    anchor.download = `${baseName}-tracker.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus("JSON exported");
  }

  function importJson() {
    const file = importInput.files && importInput.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        state = normalizeState(JSON.parse(String(reader.result || "{}")));
        render();
        saveLocal("JSON imported");
      } catch (error) {
        setStatus("Import failed");
      } finally {
        importInput.value = "";
      }
    });
    reader.readAsText(file);
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

  function slugify(value) {
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "bastion";
  }
}());
