import { formatearFechaHora as formatearFecha, aValorInput } from "../utils/fechas.js";
import { obtenerPrestamosPagina } from "../services/prestamoService.js";
import { obtenerPiezasPagina } from "../services/inventarioService.js";
import { pintarPaginador } from "../utils/paginacion.js";
import { esqueletoFilas } from "../utils/esqueleto.js";

const TAMANO_PAGINA_DETALLE = 10;
const TAMANO_LOTE_MODAL = 25;

const ESTADOS_TODOS = ["PENDIENTE", "APROBADO", "ENTREGADO", "DEVUELTO", "RECHAZADO"];

const TITULOS_REPORTE = {
    activos: { titulo: "Préstamos activos", subtitulo: "Equipos actualmente prestados", vacio: "No hay préstamos activos por el momento." },
    historial: { titulo: "Historial de préstamos", subtitulo: "Préstamos realizados", vacio: "Aún no hay préstamos registrados." },
    devoluciones: { titulo: "Devoluciones", subtitulo: "Historial de devoluciones", vacio: "Aún no hay devoluciones registradas." },
    danados: { titulo: "Equipos con daño", subtitulo: "Equipos reportados con daño", vacio: "No hay equipos dañados reportados." },
};


function pedirPagina(tipo, inicio, fin, pagina, tamano) {
    if (tipo === "danados") {
        return obtenerPiezasPagina({ page: pagina, size: tamano, estado: "DAÑADO" });
    }

    const base = { page: pagina, size: tamano };

    if (tipo === "activos") {
        return obtenerPrestamosPagina({ ...base, estados: ["PENDIENTE", "APROBADO", "ENTREGADO"], sinDevolucion: true, desde: inicio || "", hasta: fin || "" });
    }
    if (tipo === "historial") {
        return obtenerPrestamosPagina({ ...base, estados: ESTADOS_TODOS, desde: inicio || "", hasta: fin || "" });
    }

    return obtenerPrestamosPagina({ ...base, estados: inicio && fin ? ESTADOS_TODOS : ["DEVUELTO"], desde: inicio || "", hasta: fin || "", campoFecha: "devolucion" });
}

function convertirFila(tipo, elemento) {
    if (tipo === "danados") {
        return {
            icono: "fa-triangle-exclamation",
            titulo: elemento.nombreHerramienta || "Equipo",
            subtitulo: "Código: " + elemento.codInv,
        };
    }

    const nombreUsuario = elemento.nombreUsuario || "Usuario";
    const icono = elemento.tipo === "Área" ? "fa-door-open" : "fa-toolbox";

    let subtitulo = `${nombreUsuario} · ${formatearFecha(elemento.fechaInicio)}`;
    if (tipo === "devoluciones") {
        subtitulo = `${nombreUsuario} · Devuelto: ${formatearFecha(elemento.fechaDevolucion)}`;
    } else if (tipo === "historial") {
        subtitulo = `${nombreUsuario} · ${elemento.nombreEstado} · ${formatearFecha(elemento.fechaInicio)}` +
            (elemento.fechaDevolucion ? ` → ${formatearFecha(elemento.fechaDevolucion)}` : "");
    } else if (tipo === "activos") {
        subtitulo = `${nombreUsuario} · Vence: ${formatearFecha(elemento.fechaEsperada)}`;
    }

    return { icono, titulo: elemento.nombreProducto, subtitulo };
}

function pintarFilas(contenedor, filas, mensajeVacio) {
    if (!contenedor) return;

    if (filas.length === 0) {
        contenedor.innerHTML = `<p style="font-size:11px;color:var(--ink-soft);padding:8px 0;">${mensajeVacio}</p>`;
        return;
    }

    contenedor.innerHTML = filas.map((fila) => `
        <div class="fila-elemento">
            <i class="fa-solid ${fila.icono} icono-elemento"></i>
            <div class="info-elemento">
                <div class="titulo-elemento">${fila.titulo}</div>
                <div class="subtitulo-elemento">${fila.subtitulo}</div>
            </div>
        </div>
    `).join("");
}

export function initReportesController() {
    document.querySelectorAll("[data-ver-reporte]").forEach((boton) => {
        boton.addEventListener("click", () => {
            window.loadView("reporte-detalle", null, "tipoReporteDetalle", boton.dataset.verReporte);
        });
    });
}

export async function initReporteDetalleController() {
    const tipoInput = document.getElementById("tipoReporteDetalle");
    const lista = document.getElementById("listaReporteDetalle");
    if (!tipoInput || !lista) return;

    const tipo = tipoInput.value || "activos";
    const info = TITULOS_REPORTE[tipo] || TITULOS_REPORTE.activos;

    lista.innerHTML = esqueletoFilas(4);
    document.getElementById("tituloReporteDetalle").textContent = info.titulo;
    document.getElementById("subtituloReporteDetalle").textContent = info.subtitulo;

    const btnVolver = document.getElementById("btnVolverReportes");
    if (btnVolver) btnVolver.addEventListener("click", () => window.loadView("reports"));

    // El historial se puede filtrar por estado y por periodo; por defecto muestra los últimos 30 días
    const filtros = { estado: "todos", periodo: "30" };
    const contenedorFiltros = document.getElementById("filtrosReporte");

    function pintarFiltros() {
        const chip = (grupo, valor, texto) =>
            `<button type="button" class="chip-filtro ${filtros[grupo] === valor ? "activo" : ""}" data-grupo="${grupo}" data-valor="${valor}">${texto}</button>`;

        contenedorFiltros.innerHTML = `
            <div class="grupo-chips">${chip("estado", "todos", "Todos")}${chip("estado", "DEVUELTO", "Devueltos")}${chip("estado", "RECHAZADO", "Rechazados")}</div>
            <div class="grupo-chips">${chip("periodo", "30", "Últimos 30 días")}${chip("periodo", "todo", "Todo")}</div>`;
    }

    function pedirHistorial(pagina) {
        const estados = filtros.estado === "todos" ? ESTADOS_TODOS : [filtros.estado];
        let desde = "";
        let hasta = "";

        if (filtros.periodo === "30") {
            const hoy = new Date();
            const inicio = new Date(hoy);
            inicio.setDate(hoy.getDate() - 29);
            const fin = new Date(hoy);
            fin.setDate(hoy.getDate() + 365); // incluye préstamos que empiezan más adelante
            desde = aValorInput(inicio).slice(0, 10);
            hasta = aValorInput(fin).slice(0, 10);
        }

        return obtenerPrestamosPagina({ page: pagina, size: TAMANO_PAGINA_DETALLE, estados, desde, hasta });
    }

    if (tipo === "historial" && contenedorFiltros) {
        pintarFiltros();
        contenedorFiltros.classList.remove("oculto");
        contenedorFiltros.addEventListener("click", async (evento) => {
            const chip = evento.target.closest("[data-grupo]");
            if (!chip) return;
            filtros[chip.dataset.grupo] = chip.dataset.valor;
            pintarFiltros();
            try {
                await cargarPagina(0);
            } catch (error) {
                console.error(error);
                Swal.fire({ icon: "error", title: "No se pudo cargar el reporte", text: "Revisa tu conexión con el servidor." });
            }
        });
    }

    async function cargarPagina(pagina) {
        const datos = tipo === "historial"
            ? await pedirHistorial(pagina)
            : await pedirPagina(tipo, null, null, pagina, TAMANO_PAGINA_DETALLE);
        pintarFilas(lista, datos.content.map((elemento) => convertirFila(tipo, elemento)), info.vacio);
        pintarPaginador(document.getElementById("paginadorReporteDetalle"), datos, async (destino) => {
            try {
                await cargarPagina(destino);
            } catch (error) {
                console.error(error);
                Swal.fire({ icon: "error", title: "No se pudo cargar la página", text: "Revisa tu conexión con el servidor." });
            }
        });
    }

    try {
        await cargarPagina(0);
    } catch (error) {
        console.error(error);
        lista.innerHTML = '<p style="font-size:11px;color:var(--red);">No se pudo cargar el reporte. Revisa tu conexión con el servidor.</p>';
    }
}

export function initModalGenerarReporte() {
    const modal = document.getElementById("modalGenerarReporte");
    if (!modal) return;

    const btnCerrar = document.getElementById("btnCerrarModalReporte");
    const btnGenerar = document.getElementById("btnGenerarReporteModal");
    const selectTipo = document.getElementById("modalTipoReporte");
    const fechaInicio = document.getElementById("modalFechaInicio");
    const fechaFin = document.getElementById("modalFechaFin");
    const resultados = document.getElementById("modalResultadosReporte");

    function abrirModal() {
        modal.classList.remove("oculto");
        resultados.classList.add("oculto");
        resultados.innerHTML = "";
    }

    function cerrarModal() {
        modal.classList.add("oculto");
    }

    document.addEventListener("click", (evento) => {
        if (evento.target.closest("#btnGenerarReporte")) {
            abrirModal();
        }
    });

    if (btnCerrar) btnCerrar.addEventListener("click", cerrarModal);

    modal.addEventListener("click", (evento) => {
        if (evento.target === modal) cerrarModal();
    });

    async function mostrarPagina(tipo, inicio, fin, pagina) {
        const info = TITULOS_REPORTE[tipo];
        const datos = await pedirPagina(tipo, inicio, fin, pagina, TAMANO_LOTE_MODAL);

        resultados.classList.remove("oculto");
        resultados.innerHTML = '<div data-filas-reporte></div><div class="paginador" data-paginador-reporte></div>';

        pintarFilas(resultados.querySelector("[data-filas-reporte]"), datos.content.map((elemento) => convertirFila(tipo, elemento)), info.vacio);
        pintarPaginador(resultados.querySelector("[data-paginador-reporte]"), datos, async (destino) => {
            try {
                await mostrarPagina(tipo, inicio, fin, destino);
            } catch (error) {
                console.error(error);
                Swal.fire({ icon: "error", title: "No se pudo cargar la página", text: "Revisa tu conexión con el servidor." });
            }
        });
    }

    if (btnGenerar) {
        btnGenerar.addEventListener("click", async () => {
            const tipo = selectTipo.value;
            const inicio = fechaInicio.value;
            const fin = fechaFin.value;

            if (tipo !== "danados" && (!inicio || !fin)) {
                Swal.fire({ icon: "warning", title: "Selecciona el rango de fechas", text: "Elige la fecha de inicio y la fecha final del reporte." });
                return;
            }
            if (inicio && fin && fin < inicio) {
                Swal.fire({ icon: "warning", title: "Rango inválido", text: "La fecha final no puede ser anterior a la fecha de inicio." });
                return;
            }

            try {
                await mostrarPagina(tipo, inicio, fin, 0);
            } catch (error) {
                console.error(error);
                Swal.fire({ icon: "error", title: "No se pudo generar el reporte", text: "Ocurrió un error al conectar con el servidor. Intenta de nuevo.", confirmButtonColor: "#dc3545" });
            }
        });
    }
}
