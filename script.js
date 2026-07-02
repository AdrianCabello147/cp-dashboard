const SHEET_ID = "1AMM7oRC82gH9SDEQqtZj0mWWBRQT-_j0cIRxpLEEwbM";
const SHEET_NAME = "CP";

const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;

let datosGlobales = [];

fetch(url)
  .then(response => response.text())
  .then(text => {
    const json = JSON.parse(text.substring(47).slice(0, -2));
    const rows = json.table.rows;

    datosGlobales = rows
      .map(row => ({
        asociado: row.c[0]?.v || "",
        cp: row.c[1]?.v || "",
        descripcion: row.c[2]?.v || "",
        renovacion: row.c[3]?.f || row.c[3]?.v || "",
        pdf: row.c[4]?.v || ""
      }))
      .filter(item => item.asociado && item.cp);

    mostrarPorPersona(datosGlobales);
    activarBuscador();
  });

function obtenerEstado(fechaTexto) {
  if (!fechaTexto || fechaTexto.toString().trim() === "") {
    return {
      texto: "Sin vencimiento",
      clase: "vigente",
      icono: "🟢",
      dias: 99999
    };
  }

  const partes = fechaTexto.toString().split("/");

  if (partes.length !== 3) {
    return {
      texto: "Fecha no definida",
      clase: "vigente",
      icono: "🟢",
      dias: 99999
    };
  }

  let dia = parseInt(partes[0], 10);
  let mes = parseInt(partes[1], 10);
  let anio = parseInt(partes[2], 10);

  if (anio < 100) {
    anio = 2000 + anio;
  }

  const fecha = new Date(anio, mes - 1, dia);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const diferenciaMs = fecha - hoy;
  const dias = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24));

  if (dias < 0) return { texto: "Vencido", clase: "vencido", icono: "🔴", dias };
  if (dias <= 30) return { texto: "Vence urgente", clase: "urgente", icono: "🟠", dias };
  if (dias <= 90) return { texto: "Próximo a vencer", clase: "proximo", icono: "🟡", dias };

  return { texto: "Vigente", clase: "vigente", icono: "🟢", dias };
}

function obtenerPrioridad(clase) {
  return {
    vencido: 4,
    urgente: 3,
    proximo: 2,
    vigente: 1
  }[clase] || 0;
}

function obtenerEstadoGeneral(certificaciones) {
  let peorEstado = { clase: "vigente", texto: "Vigente", icono: "🟢" };

  certificaciones.forEach(item => {
    const estado = obtenerEstado(item.renovacion);

    if (obtenerPrioridad(estado.clase) > obtenerPrioridad(peorEstado.clase)) {
      peorEstado = estado;
    }
  });

  if (peorEstado.clase === "vencido") {
    return { ...peorEstado, texto: "Atención requerida" };
  }

  return peorEstado;
}

function textoDias(dias) {
  if (dias === 99999) return "Sin vencimiento definido";
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} días`;
  if (dias === 0) return "Vence hoy";
  return `Vence en ${dias} días`;
}

function obtenerItemCritico(certificaciones) {
  const certificacionesConEstado = certificaciones.map(item => ({
    ...item,
    estado: obtenerEstado(item.renovacion)
  }));

  const vencidas = certificacionesConEstado.filter(item => item.estado.clase === "vencido");

  if (vencidas.length > 0) {
    return vencidas.sort((a, b) => a.estado.dias - b.estado.dias)[0];
  }

  const conFecha = certificacionesConEstado.filter(item => item.estado.dias !== 99999);

  if (conFecha.length > 0) {
    return conFecha.sort((a, b) => a.estado.dias - b.estado.dias)[0];
  }

  return certificacionesConEstado[0];
}

function mostrarResumen(datos) {
  const resumen = document.getElementById("resumen");

  const conteo = {
    vigente: 0,
    proximo: 0,
    urgente: 0,
    vencido: 0
  };

  datos.forEach(item => {
    const estado = obtenerEstado(item.renovacion);
    conteo[estado.clase]++;
  });

  resumen.innerHTML = `
    <div class="resumen-card">
      <span>🟢 Vigentes</span>
      <strong>${conteo.vigente}</strong>
    </div>

    <div class="resumen-card">
      <span>🟡 Próximas</span>
      <strong>${conteo.proximo}</strong>
    </div>

    <div class="resumen-card">
      <span>🟠 Urgentes</span>
      <strong>${conteo.urgente}</strong>
    </div>

    <div class="resumen-card">
      <span>🔴 Vencidas</span>
      <strong>${conteo.vencido}</strong>
    </div>
  `;
}

function mostrarPorPersona(datos) {
  mostrarResumen(datos);

  const contenedor = document.getElementById("personas");
  const personas = {};

  datos.forEach(item => {
    if (!personas[item.asociado]) {
      personas[item.asociado] = [];
    }

    personas[item.asociado].push(item);
  });

  const personasOrdenadas = Object.keys(personas).sort((a, b) => {
    const estadoA = obtenerEstadoGeneral(personas[a]);
    const estadoB = obtenerEstadoGeneral(personas[b]);

    return obtenerPrioridad(estadoB.clase) - obtenerPrioridad(estadoA.clase);
  });

  if (personasOrdenadas.length === 0) {
    contenedor.innerHTML = `
      <div class="sin-resultados">
        No se encontraron resultados para la búsqueda.
      </div>
    `;
    return;
  }

  contenedor.innerHTML = personasOrdenadas.map(nombre => {
    const certificaciones = personas[nombre];
    const estadoGeneral = obtenerEstadoGeneral(certificaciones);
    const itemCritico = obtenerItemCritico(certificaciones);

    const conteoPersona = {
      vigente: 0,
      proximo: 0,
      urgente: 0,
      vencido: 0
    };

    certificaciones.forEach(item => {
      const estado = obtenerEstado(item.renovacion);
      conteoPersona[estado.clase]++;
    });

    return `
      <article class="tarjeta persona-card ${estadoGeneral.clase}">
        <div class="persona-header">
          <div>
            <h2>${nombre}</h2>
            <p>${certificaciones.length} certificaciones registradas</p>
          </div>

          <span class="estado-general ${estadoGeneral.clase}">
            ${estadoGeneral.icono} ${estadoGeneral.texto}
          </span>
        </div>

        <div class="mini-resumen">
          <span>🟢 ${conteoPersona.vigente} Vig.</span>
          <span>🟡 ${conteoPersona.proximo} Próx.</span>
          <span>🟠 ${conteoPersona.urgente} Urg.</span>
          <span>🔴 ${conteoPersona.vencido} Venc.</span>
        </div>

        <div class="accion-card ${itemCritico.estado.clase}">
          <span>Acción relevante</span>
          <strong>${itemCritico.cp}</strong>
          <p>${itemCritico.descripcion}</p>
          <small>${itemCritico.renovacion || "Sin fecha"} · ${textoDias(itemCritico.estado.dias)}</small>
        </div>

        <button class="detalle-btn" onclick="toggleDetalle(this)">
          ▼ Ver certificaciones
        </button>

        <div class="detalle-certificaciones">
          ${certificaciones.map(item => {
            const estado = obtenerEstado(item.renovacion);

            return `
              <div class="certificacion ${estado.clase}">
                <strong>${item.cp}</strong>
                <p>${item.descripcion}</p>
                <small>Renovación: ${item.renovacion || "Sin fecha"} · ${textoDias(estado.dias)}</small>

                <div class="certificacion-footer">
                  <span>${estado.icono} ${estado.texto}</span>

                  ${item.pdf ? `
                    <a href="${item.pdf}" target="_blank" class="btn-pdf">
                      📄 Ver Certificado
                    </a>
                  ` : ""}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function activarBuscador() {
  const inputBusqueda = document.getElementById("busqueda");

  inputBusqueda.addEventListener("input", () => {
    const texto = inputBusqueda.value.toLowerCase().trim();

    const datosFiltrados = datosGlobales.filter(item => {
      return (
        item.asociado.toLowerCase().includes(texto) ||
        item.cp.toLowerCase().includes(texto) ||
        item.descripcion.toLowerCase().includes(texto)
      );
    });

    mostrarPorPersona(datosFiltrados);
  });
}

function toggleDetalle(boton) {
  const detalle = boton.nextElementSibling;

  detalle.classList.toggle("activo");

  if (detalle.classList.contains("activo")) {
    boton.textContent = "▲ Ocultar certificaciones";
  } else {
    boton.textContent = "▼ Ver certificaciones";
  }
}