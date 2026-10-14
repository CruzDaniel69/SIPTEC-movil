import { colorVencimiento, formatearFechaHora as formatearFecha } from "../utils/fechas.js";
import { usuarioActual } from "../utils/sesion.js";
import { obtenerPrestamosPagina } from "../services/prestamoService.js";
import { obtenerResumenDashboard } from "../services/dashboardService.js";
import { pintarPaginador } from "../utils/paginacion.js";
import { esqueletoFilas, marcarNumerosCargando, quitarNumerosCargando } from "../utils/esqueleto.js";

const CLASE_VENCIMIENTO = { rojo: "due-red", amarillo: "due-yellow", verde: "due-green" };

// Rojo si ya venció (contando la hora), amarillo si faltan 3 días o menos, verde el resto
function calcularEstadoFecha(fechaEsperada) {
    return CLASE_VENCIMIENTO[colorVencimiento(fechaEsperada)];
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

    marcarNumerosCargando();
    if (listaPrestamosActivos) listaPrestamosActivos.innerHTML = esqueletoFilas(3);

    const titulo = document.getElementById("tituloBienvenida");
    const nombre = (usuarioActual() || {}).nombreUsuario;
    if (titulo && nombre) titulo.textContent = `¡Bienvenido, ${nombre}!`;

    function pintarActivos(prestamos) {
        if (!listaPrestamosActivos) return;
        listaPrestamosActivos.innerHTML = "";

        if (prestamos.length === 0) {
            listaPrestamosActivos.innerHTML = '<div class="estado-vacio"><i class="fa-regular fa-circle-check"></i><p>No hay préstamos activos por el momento.</p></div>';
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
            if (listaPrestamosActivos) listaPrestamosActivos.innerHTML = "";
        } finally {
            quitarNumerosCargando();
        }
    })();
}
