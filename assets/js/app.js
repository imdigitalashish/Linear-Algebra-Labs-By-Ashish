const manifestPath = "course/course-manifest.json";
const moduleListEl = document.getElementById("moduleList");
const placeholderEl = document.getElementById("modulePlaceholder");
const frameEl = document.getElementById("moduleFrame");

const state = {
  modules: [],
  activeId: null,
};

const FALLBACK_SUMMARY =
  "Open the workshop to explore the walkthrough, examples, and practice material.";

document.addEventListener("DOMContentLoaded", () => {
  init();
});

async function init() {
  try {
    const modules = await fetchManifest();
    state.modules = sortModules(modules);
    renderModuleList(state.modules);

    const urlParams = new URLSearchParams(window.location.search);
    const requestedId = urlParams.get("module");
    const initialId = requestedId && hasModule(requestedId) ? requestedId : state.modules[0]?.id;

    if (initialId) {
      loadModuleById(initialId, { pushState: false });
    }
  } catch (error) {
    displayError(error instanceof Error ? error.message : "Unable to load workshops.");
  }

  frameEl.addEventListener("load", () => {
    frameEl.classList.add("is-visible");
    adjustFrameHeight();
  });

  window.addEventListener("popstate", () => {
    const params = new URLSearchParams(window.location.search);
    const moduleId = params.get("module");
    if (moduleId && hasModule(moduleId)) {
      loadModuleById(moduleId, { pushState: false });
    }
  });

  window.addEventListener("resize", debounce(adjustFrameHeight, 150));
}

async function fetchManifest() {
  const response = await fetch(manifestPath, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Manifest loading failed (${response.status})`);
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("No workshops found. Add HTML exports to the course directory.");
  }
  return data;
}

function sortModules(modules) {
  return [...modules].sort((a, b) => {
    const orderA = typeof a.order === "number" ? a.order : Number.POSITIVE_INFINITY;
    const orderB = typeof b.order === "number" ? b.order : Number.POSITIVE_INFINITY;
    if (orderA === orderB) {
      return (a.title || "").localeCompare(b.title || "");
    }
    return orderA - orderB;
  });
}

function renderModuleList(modules) {
  moduleListEl.innerHTML = "";
  modules.forEach((module) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "module-button";
    button.dataset.moduleId = module.id;
    button.setAttribute("role", "listitem");

    button.innerHTML = `
      <span class="module-button__eyebrow">Workshop</span>
      <div class="module-button__title">${escapeHtml(module.title)}</div>
      <p class="module-button__summary">${escapeHtml(buildSummary(module))}</p>
    `;

    button.addEventListener("click", () => loadModuleById(module.id));
    moduleListEl.appendChild(button);
  });
}

function buildSummary(module) {
  if (module.summary) {
    return module.summary;
  }
  if (module.title) {
    const [, subtitle] = module.title.split(" - ");
    if (subtitle) {
      return `Focus: ${subtitle.trim()}`;
    }
  }
  return FALLBACK_SUMMARY;
}

function loadModuleById(moduleId, { pushState = true } = {}) {
  if (state.activeId === moduleId) {
    return;
  }

  const module = state.modules.find((item) => item.id === moduleId);
  if (!module) {
    return;
  }

  const buttonNodes = moduleListEl.querySelectorAll(".module-button");
  buttonNodes.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.moduleId === moduleId);
  });

  state.activeId = module.id;

  placeholderEl.hidden = true;
  frameEl.classList.remove("is-visible");
  frameEl.setAttribute("title", `Workshop content: ${module.title}`);
  frameEl.src = module.path;

  if (pushState) {
    const url = new URL(window.location.href);
    url.searchParams.set("module", module.id);
    window.history.pushState({ moduleId: module.id }, "", url);
  }
}

function adjustFrameHeight() {
  if (!frameEl.classList.contains("is-visible")) {
    return;
  }
  try {
    const doc = frameEl.contentDocument || frameEl.contentWindow.document;
    if (!doc) {
      return;
    }
    const scrollHeight = Math.max(
      doc.documentElement?.scrollHeight ?? 0,
      doc.body?.scrollHeight ?? 0,
      720
    );
    frameEl.style.height = `${scrollHeight + 24}px`;
  } catch (error) {
    frameEl.style.height = "80vh";
  }
}

function displayError(message) {
  const errorEl = document.createElement("div");
  errorEl.className = "error-state";
  errorEl.textContent = message;
  placeholderEl.after(errorEl);
}

function hasModule(moduleId) {
  return state.modules.some((item) => item.id === moduleId);
}

function debounce(fn, wait = 150) {
  let timeout;
  return (...args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => fn(...args), wait);
  };
}

function escapeHtml(input) {
  if (typeof input !== "string") {
    return "";
  }
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
