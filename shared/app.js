import { FEATURES } from "./features.js?v=2026-07-13-planning-unassigned-pool-v1";

const APP_VERSION = window.APP_VERSION || "2026-07-13-planning-unassigned-pool-v1";
const PRODUCTION_ALLOWED_USERS = ["acabello@alte.cl"];

function isProductionUserAllowed() {
  const email = window.currentUserProfile?.email?.trim().toLowerCase();
  const role = window.currentUserProfile?.role;

  return role === "admin" || Boolean(email && PRODUCTION_ALLOWED_USERS.includes(email));
}

window.isProductionUserAllowed = isProductionUserAllowed;

const APP_MODULES = {
  certificaciones: {
    feature: "certifications",
    sectionId: "certificacionesModule",
    title: "PSI Operations Platform",
    subtitle: "Seguimiento automático de certificaciones, planificación y gestión PSI.",
    label: "Certificaciones"
  },
  planificacion: {
    feature: "planning",
    sectionId: "planificacionModule",
    title: "Planificación",
    subtitle: "Planificación semanal de actividades PSI por responsable.",
    label: "Planificación"
  },
  produccion: {
    feature: "production",
    sectionId: "produccionModule",
    title: "Producción",
    subtitle: "Control local de órdenes de trabajo PSI por estado de fabricación.",
    label: "Producción",
    scripts: [
      "modules/production/production-engine.js",
      "modules/production/production-services.js",
      "modules/production/production-ui.js",
      "modules/production/production.js"
    ]
  }
};

function actualizarHeader(titulo, subtitulo) {
  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");

  pageTitle.textContent = titulo;
  pageSubtitle.textContent = subtitulo;
}

function isFeatureEnabled(moduleConfig) {
  return FEATURES[moduleConfig.feature] === true
    && (moduleConfig.feature !== "production" || isProductionUserAllowed());
}

function getEnabledModuleEntries() {
  return Object.entries(APP_MODULES).filter(([, config]) => isFeatureEnabled(config));
}

function renderModuleTabs() {
  const nav = document.querySelector(".module-tabs");

  if (!nav) return;

  nav.innerHTML = getEnabledModuleEntries().map(([moduleName, config]) => `
    <button class="module-tab" data-module="${moduleName}">
      ${config.label}
    </button>
  `).join("");
}

async function loadModuleScripts(config) {
  if (!config.scripts || config.scriptsLoaded) return;

  for (const src of config.scripts) {
    await loadScript(src);
  }

  config.scriptsLoaded = true;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const versionedSrc = getVersionedLocalAsset(src);
    const existingScript = Array.from(document.scripts).find(script =>
      script.getAttribute("src") === versionedSrc ||
      script.getAttribute("src") === src
    );

    if (existingScript) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = versionedSrc;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

function getVersionedLocalAsset(src) {
  if (!src || src.startsWith("http") || src.includes("?v=")) {
    return src;
  }

  return `${src}?v=${APP_VERSION}`;
}

async function activateModule(moduleName) {
  const config = APP_MODULES[moduleName];

  if (!config) return;
  if (!isFeatureEnabled(config)) {
    if (moduleName === "produccion") renderProductionRestricted();
    return;
  }

  await loadModuleScripts(config);

  document.querySelectorAll(".module-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.module === moduleName);
  });

  document.querySelectorAll(".module-section").forEach(section => {
    section.classList.remove("active");
  });

  const targetSection = document.getElementById(config.sectionId);

  if (targetSection) {
    targetSection.classList.add("active");
  }

  actualizarHeader(config.title, config.subtitle);
  localStorage.setItem("activeModule", moduleName);
}

function renderProductionRestricted() {
  const container = document.getElementById("produccionModule");
  if (container) {
    document.querySelectorAll(".module-section").forEach(section => section.classList.remove("active"));
    container.classList.add("active");
    container.innerHTML = `<section class="planning-weekly"><div class="comments-empty">Acceso restringido</div></section>`;
  }
}

function getInitialModule() {
  const savedModule = localStorage.getItem("activeModule");
  const enabledModules = getEnabledModuleEntries().map(([moduleName]) => moduleName);

  if (savedModule && enabledModules.includes(savedModule)) {
    return savedModule;
  }

  return enabledModules[0] || "";
}

function initAppNavigation() {
  if (window.location.pathname.startsWith("/production/")) {
    if (!isProductionUserAllowed()) {
      renderProductionRestricted();
      return;
    }
    activateModule("produccion");
    return;
  }
  renderModuleTabs();

  const tabs = document.querySelectorAll(".module-tab");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      activateModule(tab.dataset.module);
    });
  });

  activateModule(getInitialModule());
}

document.addEventListener("DOMContentLoaded", initAppNavigation);
document.addEventListener("user-profile-loaded", initAppNavigation);
