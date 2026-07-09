const APP_MODULES = {
  certificaciones: {
    sectionId: "certificacionesModule",
    title: "PSI Operations Platform",
    subtitle: "Seguimiento automático de certificaciones, planificación y gestión PSI."
  },
  planificacion: {
    sectionId: "planificacionModule",
    title: "Planificación",
    subtitle: "Planificación semanal de actividades PSI por responsable."
  }
};

function actualizarHeader(titulo, subtitulo) {
  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");

  pageTitle.textContent = titulo;

  pageSubtitle.textContent = subtitulo;
}

function activateModule(moduleName) {
  const config = APP_MODULES[moduleName];

  if (!config) return;

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

function initAppNavigation() {
  const tabs = document.querySelectorAll(".module-tab");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      activateModule(tab.dataset.module);
    });
  });

  const savedModule = localStorage.getItem("activeModule") || "certificaciones";
  activateModule(savedModule);
}

document.addEventListener("DOMContentLoaded", initAppNavigation);
