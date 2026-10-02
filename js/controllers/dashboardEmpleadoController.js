import { obtenerPrestamos } from "../services/prestamoService.js";
import { obtenerEstadosPrestamo } from "../services/estadoPrestamoService.js";
import { obtenerHerramientas } from "../services/herramientaService.js";
import { obtenerDetallePrestamoHerramientas } from "../services/detallePrestamoHerramientaService.js";
import { obtenerAreas } from "../services/areaService.js";
import { obtenerDetallePrestamoAreas } from "../services/detallePrestamoAreaService.js";

function idUsuarioActual() {
    return Number(localStorage.getItem("siptec-usuario-id")) || 0;
}

function diasRestantes(fechaEsperada) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((new Date(fechaEsperada) - hoy) / 86400000);
}

function claseFecha(fechaEsperada) {
    const dias = diasRestantes(fechaEsperada);
    if (dias < 0) return "due-red";
    if (dias <= 3) return "due-yellow";
    return "due-green";
}

function formatearFecha(fechaISO) {
    const fecha = new Date(fechaISO + "T00:00:00");
    return fecha.toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric" });
}

export function initDashboardEmpleadoController() {
    const statActivos = document.getElementById("statMisActivos");
    if (!statActivos) return;

    const titulo = document.getElementById("tituloBienvenida");
    const nombre = localStorage.getItem("siptec-usuario-nombre");
    if (titulo && nombre) titulo.textContent = `¡Bienvenido, ${nombre}!`;

    const lista = document.getElementById("listaPrestamosActivos");

    (async function cargarResumen() {
        try {
            const [prestamos, estados, herramientas, detallesHerramienta, areas, detallesArea] = await Promise.all([
                obtenerPrestamos(),
                obtenerEstadosPrestamo(),
                obtenerHerramientas(),
                obtenerDetallePrestamoHerramientas(),
                obtenerAreas().catch(() => []),
                obtenerDetallePrestamoAreas().catch(() => []),
            ]);

            const nombreEstado = (id) => (estados.find((e) => e.id === id) || {}).nombreEstado;
            const misPrestamos = prestamos.filter((p) => p.usuario === idUsuarioActual());

            const activos = misPrestamos.filter((p) => !p.fechaDevolucion && ["APROBADO", "ENTREGADO"].includes(nombreEstado(p.estado)));
            const pendientes = misPrestamos.filter((p) => nombreEstado(p.estado) === "PENDIENTE");
            const porVencer = activos.filter((p) => p.fechaEsperada && diasRestantes(p.fechaEsperada) <= 3);

            statActivos.textContent = activos.length;
            document.getElementById("statPorVencer").textContent = porVencer.length;
            document.getElementById("statMisPendientes").textContent = pendientes.length;

            if (activos.length === 0) {
                lista.innerHTML = '<p style="padding:8px 0;color:var(--ink-soft);font-size:12px;">No tienes préstamos activos.</p>';
                return;
            }

            lista.innerHTML = "";
            activos
                .sort((a, b) => new Date(a.fechaEsperada) - new Date(b.fechaEsperada))
                .slice(0, 5)
                .forEach((prestamo) => {
                    const lineas = detallesHerramienta.filter((d) => d.prestamo === prestamo.id);
                    const detalleArea = detallesArea.find((d) => d.prestamoIdPrestamo === prestamo.id);

                    let recurso = "Préstamo #" + prestamo.id;
                    if (lineas.length > 0) {
                        const herramienta = herramientas.find((h) => h.idHerramienta === lineas[0].herramienta);
                        const piezas = lineas.reduce((suma, d) => suma + (d.cantidad || 1), 0);
                        recurso = (herramienta ? herramienta.nombreHerramienta : "Equipo") + ` (x${piezas})`;
                    } else if (detalleArea) {
                        const area = areas.find((a) => a.id === detalleArea.areasIdArea);
                        recurso = area ? area.nombreArea : "Área";
                    }

                    const clase = claseFecha(prestamo.fechaEsperada);
                    const fila = document.createElement("div");
                    fila.className = "fila-elemento";
                    fila.style.cursor = "default";
                    fila.innerHTML = `
                        <i class="fa-solid fa-toolbox icono-elemento"></i>
                        <div class="info-elemento">
                            <div class="titulo-elemento">${recurso}</div>
                            <div class="subtitulo-elemento">Préstamo #${prestamo.id}</div>
                        </div>
                        <div class="vencimiento-elemento">
                            Devolver antes de
                            <div class="fecha-elemento ${clase}">${formatearFecha(prestamo.fechaEsperada)} <span class="punto punto-${clase === "due-red" ? "rojo" : clase === "due-yellow" ? "amarillo" : "verde"}"></span></div>
                        </div>
                    `;
                    lista.appendChild(fila);
                });
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: "error", title: "No se pudo cargar el resumen", text: "Revisa tu conexión con el servidor." });
        }
    })();
}
