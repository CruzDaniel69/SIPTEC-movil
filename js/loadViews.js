import { initPrestamoController } from "./controllers/prestamoController.js";
import { initAprobarPrestamosController } from "./controllers/aprobarPrestamosController.js";
import { initDashboardController } from "./controllers/dashboardController.js";
import { initReportesController, initReporteDetalleController, initModalGenerarReporte } from "./controllers/reportesController.js";
import { initDevolucionController } from "./controllers/devolucionController.js";
import { initImplementoController } from "./controllers/implementoController.js";

const viewRoot = document.getElementById("viewRoot");
const btnNavInicio = document.getElementById("btnNavInicio");
const btnNavPrestamos = document.getElementById("btnNavPrestamos");
const btnNavReportes = document.getElementById("btnNavReportes");
const btnNavDevolucion = document.getElementById("btnNavDevolucion");


const botonesNav = [btnNavInicio, btnNavPrestamos, btnNavReportes, btnNavDevolucion];


async function loadView(viewName, checkId, fillId, fillValue) {
    if (!viewRoot) return;

    try {
        const rol = (localStorage.getItem("siptec-role") || "EMPLEADO").toUpperCase();
        const esAdminOIT = rol === "ADMINISTRADOR" || rol === "IT";
        const archivoReal = (viewName === "loans" && esAdminOIT) ? "aprobar-prestamos" : viewName;

        const respuesta = await fetch(`${archivoReal}.html?t=${Date.now()}`);

        if (!respuesta.ok) {
            throw new Error("No se pudo cargar la vista: " + viewName);
        }

        const html = await respuesta.text();
        viewRoot.innerHTML = html;

        if (checkId) {
            const radio = document.getElementById(checkId);
            if (radio) radio.checked = true;
        }

        if (fillId && fillValue) {
            const campo = document.getElementById(fillId);
            if (campo) campo.value = fillValue;
        }

        marcarBotonActivo(viewName);
        mostrarNombreUsuario();

        if (viewName === "dashboard") {
            initDashboardController();
        } else if (viewName === "loans") {
            if (archivoReal === "aprobar-prestamos") {
                initAprobarPrestamosController();
            } else {
                initPrestamoController();
            }
        } else if (viewName === "reports") {
            initReportesController();
        } else if (viewName === "reporte-detalle") {
            initReporteDetalleController();
        } else if (viewName === "devolucion") {
            initDevolucionController();
        } else if (viewName === "agregar-implemento") {
            initImplementoController();
        }

    } catch (error) {
        console.error("Lo sentimos, hubo un error al cargar la pagina: " + error);
        viewRoot.innerHTML = '<p style="padding:20px;color:#dc3545;">Error al cargar la página.</p>';
    }
}

function mostrarNombreUsuario() {
    const nombreTopbar = document.getElementById("nombreUsuarioTopbar");
    if (!nombreTopbar) return;

    const nombre = localStorage.getItem("siptec-usuario-nombre") || "";
    const apellido = localStorage.getItem("siptec-usuario-apellido") || "";
    nombreTopbar.textContent = `${nombre} ${apellido}`.trim();
}

function initPanelPerfil() {
    const panel = document.getElementById("panelPerfil");
    if (!panel) return;

    const btnCerrarPerfil = document.getElementById("btnCerrarPerfil");
    const btnCerrarSesion = document.getElementById("btnCerrarSesion");

    function abrirPanel() {
        const nombre = localStorage.getItem("siptec-usuario-nombre") || "";
        const apellido = localStorage.getItem("siptec-usuario-apellido") || "";
        document.getElementById("nombreUsuarioPerfil").textContent = `${nombre} ${apellido}`.trim();
        document.getElementById("correoUsuarioPerfil").textContent = localStorage.getItem("siptec-usuario-correo") || "";
        panel.classList.remove("oculto");
    }

    function cerrarPanel() {
        panel.classList.add("oculto");
    }

    document.addEventListener("click", (evento) => {
        if (evento.target.closest("#btnAbrirPerfil")) abrirPanel();
    });

    if (btnCerrarPerfil) btnCerrarPerfil.addEventListener("click", cerrarPanel);

    panel.addEventListener("click", (evento) => {
        if (evento.target === panel) cerrarPanel();
    });

    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener("click", () => {
            localStorage.removeItem("siptec-usuario-id");
            localStorage.removeItem("siptec-usuario-nombre");
            localStorage.removeItem("siptec-usuario-apellido");
            localStorage.removeItem("siptec-usuario-correo");
            localStorage.removeItem("siptec-role");
            window.location.href = "../index.html";
        });
    }
}

function marcarBotonActivo(viewName) {
    botonesNav.forEach((boton) => boton.classList.remove("activo"));

    if (viewName === "dashboard") btnNavInicio.classList.add("activo");
    if (viewName === "loans") btnNavPrestamos.classList.add("activo");
    if (viewName === "reports" || viewName === "reporte-detalle") btnNavReportes.classList.add("activo");
    if (viewName === "devolucion") btnNavDevolucion.classList.add("activo");
}

btnNavInicio.addEventListener("click", () => loadView("dashboard"));
btnNavPrestamos.addEventListener("click", () => loadView("loans"));
btnNavReportes.addEventListener("click", () => loadView("reports"));
btnNavDevolucion.addEventListener("click", () => loadView("devolucion"));

window.loadView = loadView;

initModalGenerarReporte();
initPanelPerfil();

loadView("dashboard");