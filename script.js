const SHEET_ID = "1AMM7oRC82gH9SDEQqtZj0mWWBRQT-_j0cIRxpLEEwbM";
const SHEET_NAME = "CP";

const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;

fetch(url)
  .then(response => response.text())
  .then(text => {
    const json = JSON.parse(text.substring(47).slice(0, -2));
    console.log(json);
    document.body.innerHTML += "<p>Datos conectados correctamente ✅</p>";
  })
  .catch(error => {
    console.error("Error al cargar datos:", error);
    document.body.innerHTML += "<p>Error al conectar con Google Sheets ❌</p>";
  });
