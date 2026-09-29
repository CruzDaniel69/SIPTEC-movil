import { obtenerPrestamos } from "../services/prestamoService.js";
import { obtenerEstadosPrestamo } from "../services/estadoPrestamoService.js";
import { obtenerDetallePrestamoHerramientas } from "../services/detallePrestamoHerramientaService.js";
import { obtenerDetallePrestamoAreas } from "../services/detallePrestamoAreaService.js";
import { obtenerHerramientas } from "../services/herramientaService.js";
import { obtenerDetallesHerramienta } from "../services/detalleHerramientaService.js";
import { obtenerEstadosHerramienta } from "../services/estadoHerramientaService.js";
import { obtenerAreas } from "../services/areaService.js";
import { obtenerUsuarios } from "../services/usuarioService.js";

const TITULOS_REPORTE = {
    activos: { titulo: "Préstamos activos", subtitulo: "Equipos actualmente prestados", vacio: "No hay préstamos activos por el momento." },
    historial: { titulo: "Historial de préstamos", subtitulo: "Todos los préstamos realizados", vacio: "Aún no hay préstamos registrados." },
    devoluciones: { titulo: "Devoluciones", subtitulo: "Historial de devoluciones", vacio: "Aún no hay devoluciones registradas." },
    danados: { titulo: "Equipos con daño", subtitulo: "Equipos reportados con daño", vacio: "No hay equipos dañados reportados." },
};

function formatearFecha(fechaISO) {
    if (!fechaISO) return "-";
    const fecha = new Date(fechaISO + "T00:00:00");
    return fecha.toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric" });
}

function dentroDeRango(fechaISO, inicio, fin) {
    if (!inicio || !fin) return true;
    if (!fechaISO) return false;
    return fechaISO >= inicio && fechaISO <= fin;
}

async function construirDatosReporte(tipo, inicio, fin) {
    if (tipo === "danados") {
        const [detalles, estadosHerramienta, herramientas] = await Promise.all([
            obtenerDetallesHerramienta(),
            obtenerEstadosHerramienta(),
            obtenerHerramientas(),
        ]);

        const idDanado = (estadosHerramienta.find((e) => e.nombreEstadoHerramienta === "DAÑADO") || {}).id;

        return detalles
            .filter((detalle) => detalle.idEstadoHerramienta === idDanado)
            .map((detalle) => {
                const herramienta = herramientas.find((h) => h.idHerramienta === detalle.idHerramienta);
                return {
                    icono: "fa-triangle-exclamation",
                    titulo: herramienta ? herramienta.nombreHerramienta : "Equipo",
                    subtitulo: "Código: " + detalle.codInv,
                };
            });
    }

    const [prestamos, estadosPrestamo, detallesHerramienta, detallesArea, herramientas, areas, usuarios] = await Promise.all([
        obtenerPrestamos(),
        obtenerEstadosPrestamo(),
        obtenerDetallePrestamoHerramientas(),
        obtenerDetallePrestamoAreas().catch(() => []),
        obtenerHerramientas(),
        obtenerAreas().catch(() => []),
        obtenerUsuarios(),
    ]);

    let filtrados = prestamos;

    if (tipo === "activos") {
        filtrados = prestamos.filter((p) => !p.fechaDevolucion && dentroDeRango(p.fechaInicio, inicio, fin));
    } else if (tipo === "historial") {
        filtrados = prestamos.filter((p) => dentroDeRango(p.fechaInicio, inicio, fin));
    } else if (tipo === "devoluciones") {
        filtrados = prestamos.filter((p) => p.fechaDevolucion && dentroDeRango(p.fechaDevolucion, inicio, fin));
    }

    return filtrados.map((prestamo) => {
        const usuario = usuarios.find((u) => u.id === prestamo.usuario);
        const estado = estadosPrestamo.find((e) => e.id === prestamo.estado);
        const detalleHerramienta = detallesHerramienta.find((d) => d.prestamo === prestamo.id);
        const detalleArea = detallesArea.find((d) => d.prestamoIdPrestamo === prestamo.id);

        let icono = "fa-toolbox";
        let recurso = "Préstamo #" + prestamo.id;

        if (detalleHerramienta) {
            const herramienta = herramientas.find((h) => h.idHerramienta === detalleHerramienta.herramienta);
            recurso = herramienta ? herramienta.nombreHerramienta : recurso;
        } else if (detalleArea) {
            icono = "fa-door-open";
            const area = areas.find((a) => a.id === detalleArea.areasIdArea);
            recurso = area ? area.nombreArea : recurso;
        }

        const nombreUsuario = usuario ? `${usuario.nombreUsuario} ${usuario.apellidoUsuario}` : "Usuario";
        const nombreEstado = estado ? estado.nombreEstado : "";

        let subtitulo = `${nombreUsuario} · ${formatearFecha(prestamo.fechaInicio)}`;
        if (tipo === "devoluciones") {
            subtitulo = `${nombreUsuario} · Devuelto: ${formatearFecha(prestamo.fechaDevolucion)}`;
        } else if (tipo === "historial") {
            subtitulo = `${nombreUsuario} · ${nombreEstado} · ${formatearFecha(prestamo.fechaInicio)}` +
                (prestamo.fechaDevolucion ? ` → ${formatearFecha(prestamo.fechaDevolucion)}` : "");
        } else if (tipo === "activos") {
            subtitulo = `${nombreUsuario} · Vence: ${formatearFecha(prestamo.fechaEsperada)}`;
        }

        return { icono, titulo: recurso, subtitulo };
    });
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

    document.getElementById("tituloReporteDetalle").textContent = info.titulo;
    document.getElementById("subtituloReporteDetalle").textContent = info.subtitulo;

    const btnVolver = document.getElementById("btnVolverReportes");
    if (btnVolver) btnVolver.addEventListener("click", () => window.loadView("reports"));

    try {
        const filas = await construirDatosReporte(tipo, null, null);
        pintarFilas(lista, filas, info.vacio);
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
                const info = TITULOS_REPORTE[tipo];
                const filas = await construirDatosReporte(tipo, inicio, fin);
                resultados.classList.remove("oculto");
                pintarFilas(resultados, filas, info.vacio);
            } catch (error) {
                console.error(error);
                Swal.fire({ icon: "error", title: "No se pudo generar el reporte", text: "Ocurrió un error al conectar con el servidor. Intenta de nuevo.", confirmButtonColor: "#dc3545" });
            }
        });
    }
}
