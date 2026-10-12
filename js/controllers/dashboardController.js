import { usuarioActual } from "../utils/sesion.js";
import { obtenerPrestamosPagina } from "../services/prestamoService.js";
import { obtenerResumenDashboard } from "../services/dashboardService.js";
import { pintarPaginador } from "../utils/paginacion.js";

function calcularEstadoFecha(fechaEsperada) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const esperada = new Date(fechaEsperada);

    const diasRestantes = Math.round((esperada - hoy) / 86400000);

    if (diasRestantes < 0) return "due-red";
    if (diasRestantes <= 3) return "due-yellow";
    return "due-green";
}

function formatearFecha(fechaISO) {
    const fecha = new Date(fechaISO + "T00:00:00");
    return fecha.toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric" });
}

function fechaLocalISO(fecha) {
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${fecha.getFullYear()}-${mes}-${dia}`;
}

const TAMANO_LISTA = 5;

export function initDashboardController() {
    const statPrestados = document.getElementById("statEquiposPrestados");
    const statPendientes = document.getElementById("statDevolucionesPendientes");
    const statDanados = document.getElementById("statEquiposDanados");
    const statDisponibles = document.getElementById("statEquiposDisponibles");
    const listaPrestamosActivos = document.getElementById("listaPrestamosActivos");

    if (!statPrestados) return;

    const titulo = document.getElementById("tituloBienvenida");
    const nombre = (usuarioActual() || {}).nombreUsuario;
    if (titulo && nombre) titulo.textContent = `¡Bienvenido, ${nombre}!`;

    function pintarActivos(prestamos) {
        if (!listaPrestamosActivos) return;
        listaPrestamosActivos.innerHTML = "";

        if (prestamos.length === 0) {
            listaPrestamosActivos.innerHTML = '<p style="padding:8px 0;color:var(--ink-soft);font-size:12px;">No hay préstamos activos por el momento.</p>';
            return;
        }

        prestamos.forEach((prestamo) => {
            const claseFecha = calcularEstadoFecha(prestamo.fechaEsperada);

            const fila = document.createElement("div");
            fila.className = "fila-elemento";
            fila.innerHTML = `
                <i class="fa-solid fa-toolbox icono-elemento"></i>
                <div class="info-elemento">
                    <div class="titulo-elemento">${prestamo.nombreProducto}</div>
                    <div class="subtitulo-elemento">Préstamo #${prestamo.id}</div>
                </div>
                <div class="vencimiento-elemento">
                    Devolver antes de
                    <div class="fecha-elemento ${claseFecha}">${formatearFecha(prestamo.fechaEsperada)} <span class="punto punto-${claseFecha === "due-red" ? "rojo" : claseFecha === "due-yellow" ? "amarillo" : "verde"}"></span></div>
                </div>
            `;
            fila.addEventListener("click", () => loadView("devolucion"));
            listaPrestamosActivos.appendChild(fila);
        });
    }

    async function cargarActivos(pagina) {
        const datos = await obtenerPrestamosPagina({
            page: pagina,
            size: TAMANO_LISTA,
            estados: ["APROBADO", "ENTREGADO"],
            sinDevolucion: true,
            orden: "vencimiento",
        });

        pintarActivos(datos.content);
        pintarPaginador(document.getElementById("paginadorActivos"), datos, async (destino) => {
            try {
                await cargarActivos(destino);
            } catch (error) {
                console.error(error);
                Swal.fire({ icon: "error", title: "No se pudo cargar la página", text: "Revisa tu conexión con el servidor." });
            }
        });
        return datos;
    }

    (async function cargarResumen() {
        try {
            const [resumen, activos] = await Promise.all([
                obtenerResumenDashboard(fechaLocalISO(new Date())),
                cargarActivos(0),
            ]);

            statPrestados.textContent = resumen.prestados;
            statDanados.textContent = resumen.danados;
            statDisponibles.textContent = resumen.disponibles;
            statPendientes.textContent = activos.totalElements;
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: "error", title: "No se pudo cargar el resumen", text: "Revisa tu conexión con el servidor." });
        }
    })();
}
