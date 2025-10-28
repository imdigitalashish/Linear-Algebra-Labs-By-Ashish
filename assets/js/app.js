const manifestPath = "course/course-manifest.json";

const workshopListEl = document.getElementById("workshopList");
const sidebarListEl = document.getElementById("sidebarList");
const viewerSection = document.getElementById("viewer");
const sidebarToggleBtn = document.getElementById("sidebarToggle");
const viewerSidebar = document.getElementById("viewerSidebar");
const closeSidebarBtn = document.getElementById("closeSidebar");
const frameEl = document.getElementById("moduleFrame");

const state = {
  modules: [],
  activeId: null,
  sidebarOpen: false,
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
    renderWorkshopList(state.modules);
    renderSidebarList(state.modules);
    applyLocation();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load workshops.";
    displayError(message);
  }

  sidebarToggleBtn?.addEventListener("click", () => setSidebarOpen(!state.sidebarOpen));
  closeSidebarBtn?.addEventListener("click", () => setSidebarOpen(false));

  document.addEventListener("keydown", handleKeyDown);
  window.addEventListener("popstate", () => {
    applyLocation({ pushState: false });
  });

  setSidebarOpen(false);
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

function renderWorkshopList(modules) {
  if (!workshopListEl) {
    return;
  }

  workshopListEl.innerHTML = "";
  modules.forEach((module) => {
    const li = document.createElement("li");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "workshop-link";
    button.dataset.moduleId = module.id;
    button.innerHTML = `
      <strong>${escapeHtml(module.title)}</strong>
      <small>${escapeHtml(buildSummary(module))}</small>
    `;
    button.title = module.summary ? module.summary : FALLBACK_SUMMARY;

    button.addEventListener("click", () => loadModule(module.id));
    li.appendChild(button);
    workshopListEl.appendChild(li);
  });
}

function renderSidebarList(modules) {
  if (!sidebarListEl) {
    return;
  }

  sidebarListEl.innerHTML = "";
  modules.forEach((module) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sidebar-button";
    button.dataset.moduleId = module.id;
    button.textContent = module.title;
    button.title = module.summary ? module.summary : FALLBACK_SUMMARY;

    button.addEventListener("click", () => {
      loadModule(module.id);
      setSidebarOpen(false);
    });

    li.appendChild(button);
    sidebarListEl.appendChild(li);
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

function loadModule(moduleId, { pushState = true } = {}) {
  const module = state.modules.find((item) => item.id === moduleId);
  if (!module) {
    return;
  }

  state.activeId = module.id;
  showViewer();
  updateActiveUI(module.id);

  if (frameEl) {
    const currentSrc = frameEl.getAttribute("src");
    if (currentSrc !== module.path) {
      frameEl.setAttribute("src", module.path);
    }
  }

  if (pushState) {
    const url = new URL(window.location.href);
    url.searchParams.set("module", module.id);
    const query = url.searchParams.toString();
    const nextUrl = `${url.pathname}${query ? `?${query}` : ""}`;
    window.history.pushState({ moduleId: module.id }, "", nextUrl);
  }
}

function showViewer() {
  if (!viewerSection) {
    return;
  }

  viewerSection.hidden = false;
  document.body.classList.add("viewer-active");
  setSidebarOpen(false);
}

function updateActiveUI(activeId) {
  const nodes = document.querySelectorAll("[data-module-id]");
  nodes.forEach((node) => {
    const isActive = node.dataset.moduleId === activeId;

    if (node.classList.contains("sidebar-button")) {
      if (isActive) {
        node.setAttribute("aria-current", "page");
      } else {
        node.removeAttribute("aria-current");
      }
    }

    if (isActive) {
      node.classList.add("is-active");
    } else {
      node.classList.remove("is-active");
    }
  });
}

function setSidebarOpen(open) {
  state.sidebarOpen = open;
  document.body.classList.toggle("sidebar-open", open);

  if (sidebarToggleBtn) {
    sidebarToggleBtn.setAttribute("aria-expanded", String(open));
  }
  if (viewerSidebar) {
    viewerSidebar.setAttribute("aria-hidden", String(!open));
  }
}

function showSummary({ pushState = true } = {}) {
  state.activeId = null;
  document.body.classList.remove("viewer-active", "sidebar-open");
  setSidebarOpen(false);

  if (viewerSection) {
    viewerSection.hidden = true;
  }
  if (frameEl) {
    frameEl.removeAttribute("src");
  }

  updateActiveUI("");

  if (pushState) {
    const url = new URL(window.location.href);
    if (url.searchParams.has("module")) {
      url.searchParams.delete("module");
      const query = url.searchParams.toString();
      const nextUrl = `${url.pathname}${query ? `?${query}` : ""}`;
      window.history.pushState({}, "", nextUrl);
    }
  }
}

function applyLocation({ pushState = false } = {}) {
  const params = new URLSearchParams(window.location.search);
  const moduleId = params.get("module");

  if (moduleId && hasModule(moduleId)) {
    loadModule(moduleId, { pushState });
  } else {
    showSummary({ pushState: false });
  }
}

function hasModule(moduleId) {
  return state.modules.some((module) => module.id === moduleId);
}

function displayError(message) {
  const target = workshopListEl?.parentElement ?? document.body;
  const errorEl = document.createElement("div");
  errorEl.className = "error-state";
  errorEl.textContent = message;
  target.appendChild(errorEl);
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

function handleKeyDown(event) {
  if (event.key !== "Escape") {
    return;
  }

  if (state.sidebarOpen) {
    setSidebarOpen(false);
    event.preventDefault();
    return;
  }

  if (document.body.classList.contains("viewer-active")) {
    showSummary();
    event.preventDefault();
  }
}
