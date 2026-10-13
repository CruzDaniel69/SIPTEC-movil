import { colorVencimiento, formatearFechaHora as formatearFecha } from "../utils/fechas.js";
import { usuarioActual, idUsuarioActual } from "../utils/sesion.js";
import { obtenerPrestamosPagina } from "../services/prestamoService.js";
import { pintarPaginador } from "../utils/paginacion.js";

const CLASE_VENCIMIENTO = { rojo: "due-red", amarillo: "due-yellow", verde: "due-green" };

// Rojo si ya venció (contando la hora), amarillo si faltan 3 días o menos, verde el resto
function claseFecha(fechaEsperada) {
    return CLASE_VENCIMIENTO[colorVencimiento(fechaEsperada)];
}

const TAMANO_LISTA = 5;





function fechaLocalISO(fecha) {
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function consultaActivos(extra = {}) {
    return obtenerPrestamosPagina({
        estados: ["APROBADO", "ENTREGADO"],
        usuario: idUsuarioActual(),
        sinDevolucion: true,
        orden: "vencimiento",
        ...extra,
    });
}

export function initDashboardEmpleadoController() {
    const statActivos = document.getElementById("statMisActivos");
    if (!statActivos) return;

    const titulo = document.getElementById("tituloBienvenida");
    const nombre = (usuarioActual() || {}).nombreUsuario;
    if (titulo && nombre) titulo.textContent = `¡Bienvenido, ${nombre}!`;

    const lista = document.getElementById("listaPrestamosActivos");

    function pintarActivos(prestamos) {
        if (prestamos.length === 0) {
            lista.innerHTML = '<div class="estado-vacio"><i class="fa-regular fa-circle-check"></i><p>No tienes préstamos activos.</p></div>';
            return;
        }

        lista.innerHTML = "";
        prestamos.forEach((prestamo) => {
            let recurso = prestamo.nombreProducto;
            if (prestamo.tipo === "Herramienta" && prestamo.idHerramienta) {
                recurso += ` (x${prestamo.cantidad})`;
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
    }

    async function cargarActivos(pagina) {
        const datos = await consultaActivos({ page: pagina, size: TAMANO_LISTA });

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
            const limite = new Date();
            limite.setDate(limite.getDate() + 3);

            const [activos, porVencer, pendientes] = await Promise.all([
                cargarActivos(0),
                consultaActivos({ size: 5, vencenAntesDe: fechaLocalISO(limite) }),
                obtenerPrestamosPagina({ size: 5, estados: ["PENDIENTE"], usuario: idUsuarioActual() }),
            ]);

            statActivos.textContent = activos.totalElements;
            document.getElementById("statPorVencer").textContent = porVencer.totalElements;
            document.getElementById("statMisPendientes").textContent = pendientes.totalElements;
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: "error", title: "No se pudo cargar el resumen", text: "Revisa tu conexión con el servidor." });
        }
    })();
}
