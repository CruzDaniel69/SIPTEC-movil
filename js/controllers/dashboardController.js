import { obtenerDetallesHerramienta } from "../services/detalleHerramientaService.js";
import { obtenerEstadosHerramienta } from "../services/estadoHerramientaService.js";
import { obtenerPrestamos } from "../services/prestamoService.js";
import { obtenerEstadosPrestamo } from "../services/estadoPrestamoService.js";
import { obtenerDetallePrestamoHerramientas } from "../services/detallePrestamoHerramientaService.js";
import { obtenerHerramientas } from "../services/herramientaService.js";

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

export function initDashboardController() {
    const statPrestados = document.getElementById("statEquiposPrestados");
    const statPendientes = document.getElementById("statDevolucionesPendientes");
    const statDanados = document.getElementById("statEquiposDanados");
    const statDisponibles = document.getElementById("statEquiposDisponibles");
    const listaPrestamosActivos = document.getElementById("listaPrestamosActivos");

    if (!statPrestados) return;

    (async function cargarResumen() {
        try {
            const [detalles, estadosHerramienta, prestamos, estadosPrestamo, detallesPrestamo, herramientas] = await Promise.all([
                obtenerDetallesHerramienta(),
                obtenerEstadosHerramienta(),
                obtenerPrestamos(),
                obtenerEstadosPrestamo(),
                obtenerDetallePrestamoHerramientas(),
                obtenerHerramientas(),
            ]);

            const idEstado = (nombre) => {
                const estado = estadosHerramienta.find((item) => item.nombreEstadoHerramienta === nombre);
                return estado ? estado.id : null;
            };

            const idDisponible = idEstado("DISPONIBLE");
            const idEnPrestamo = idEstado("EN PRESTAMO");
            const idDanado = idEstado("DAÑADO");

            statPrestados.textContent = detalles.filter((item) => item.idEstadoHerramienta === idEnPrestamo).length;
            statDanados.textContent = detalles.filter((item) => item.idEstadoHerramienta === idDanado).length;
            statDisponibles.textContent = detalles.filter((item) => item.idEstadoHerramienta === idDisponible).length;

            const estadosActivos = ["APROBADO", "ENTREGADO"];
            const prestamosActivos = prestamos.filter((prestamo) => {
                if (prestamo.fechaDevolucion) return false;
                const estado = estadosPrestamo.find((item) => item.id === prestamo.estado);
                return estado && estadosActivos.includes(estado.nombreEstado);
            });

            statPendientes.textContent = prestamosActivos.length;

            if (listaPrestamosActivos) {
                listaPrestamosActivos.innerHTML = "";

                if (prestamosActivos.length === 0) {
                    listaPrestamosActivos.innerHTML = '<p style="padding:8px 0;color:var(--ink-soft);font-size:12px;">No hay préstamos activos por el momento.</p>';
                } else {
                    prestamosActivos
                        .sort((a, b) => new Date(a.fechaEsperada) - new Date(b.fechaEsperada))
                        .slice(0, 5)
                        .forEach((prestamo) => {
                            const detalle = detallesPrestamo.find((item) => item.prestamo === prestamo.id);
                            const herramienta = detalle ? herramientas.find((item) => item.idHerramienta === detalle.herramienta) : null;
                            const nombreEquipo = herramienta ? herramienta.nombreHerramienta : "Área asignada";
                            const claseFecha = calcularEstadoFecha(prestamo.fechaEsperada);

                            const fila = document.createElement("div");
                            fila.className = "fila-elemento";
                            fila.innerHTML = `
                                <i class="fa-solid fa-toolbox icono-elemento"></i>
                                <div class="info-elemento">
                                    <div class="titulo-elemento">${nombreEquipo}</div>
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
            }
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: "error", title: "No se pudo cargar el resumen", text: "Revisa tu conexión con el servidor." });
        }
    })();
}
