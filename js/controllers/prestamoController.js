import { agregarPrestamo } from "../services/prestamoService.js";
import { obtenerHerramientas } from "../services/herramientaService.js";
import { obtenerAreas, agregarArea } from "../services/areaService.js";
import { obtenerTiposArea } from "../services/tipoAreaService.js";
import { obtenerEstadosPrestamo } from "../services/estadoPrestamoService.js";
import { agregarDetallePrestamoHerramienta } from "../services/detallePrestamoHerramientaService.js";
import { agregarDetallePrestamoArea } from "../services/detallePrestamoAreaService.js";

let listaHerramientas = [];
let listaAreas = [];
let listaEstados = [];
let listaTiposArea = [];

function obtenerIdUsuarioActual() {
    return Number(localStorage.getItem("siptec-usuario-id")) || 1;
}

function resolverPorNombre(texto, lista, campoNombre) {
    if (!texto) return null;
    const textoBusqueda = texto.trim().toLowerCase();
    return lista.find((item) => item[campoNombre].toLowerCase().includes(textoBusqueda));
}

function fechasSonValidas(valorFechaInicio, valorFechaEsperada) {
    const inicio = new Date(valorFechaInicio);
    const esperada = new Date(valorFechaEsperada);

    if (esperada <= inicio) {
        return { valido: false, mensaje: "La fecha esperada debe ser posterior a la fecha de inicio." };
    }

    const unMesDespues = new Date(inicio);
    unMesDespues.setMonth(unMesDespues.getMonth() + 1);

    if (esperada > unMesDespues) {
        return { valido: false, mensaje: "El préstamo no puede exceder 1 mes desde el inicio." };
    }

    return { valido: true };
}

export function initPrestamoController() {
    const tipoHerramienta = document.getElementById("tipoHerramienta");
    const fechaInicio = document.getElementById("fechaInicio");
    const fechaEsperada = document.getElementById("fechaEsperada");
    const cantidadSolicitada = document.getElementById("cantidadSolicitada");
    const buscarHerramienta = document.getElementById("buscarHerramienta");
    const idHerramientaSeleccionada = document.getElementById("idHerramientaSeleccionada");
    const avisoHerramienta = document.getElementById("avisoHerramienta");
    const buscarArea = document.getElementById("buscarArea");
    const idAreaSeleccionada = document.getElementById("idAreaSeleccionada");
    const avisoArea = document.getElementById("avisoArea");
    const btnRegistrarPrestamo = document.getElementById("btnRegistrarPrestamo");
    const observaciones = document.getElementById("observacionesPrestamo");

    if (!btnRegistrarPrestamo) return;

    const hoy = new Date().toISOString().split("T")[0];
    fechaInicio.min = hoy;

    function limpiarFormulario() {
        tipoHerramienta.checked = true;
        buscarHerramienta.value = "";
        idHerramientaSeleccionada.value = "";
        avisoHerramienta.textContent = "";
        cantidadSolicitada.value = 1;
        buscarArea.value = "";
        idAreaSeleccionada.value = "";
        avisoArea.textContent = "";
        fechaInicio.value = "";
        fechaEsperada.value = "";
        if (observaciones) {
            observaciones.value = "";
            const contador = document.getElementById("c1");
            if (contador) contador.innerText = "0";
        }
    }

    function validarFormularioPrestamo() {
        if (!fechaInicio.value || !fechaEsperada.value) {
            return { valido: false, mensaje: "Selecciona la fecha de inicio y la esperada." };
        }

        const validacionFechas = fechasSonValidas(fechaInicio.value, fechaEsperada.value);
        if (!validacionFechas.valido) {
            return validacionFechas;
        }

        if (tipoHerramienta.checked) {
            if (!idHerramientaSeleccionada.value) {
                return { valido: false, mensaje: "Busca y selecciona un equipo válido de la lista." };
            }

            const herramienta = listaHerramientas.find((item) => item.idHerramienta === Number(idHerramientaSeleccionada.value));
            const cantidad = Number(cantidadSolicitada.value);

            if (!cantidad || cantidad < 1) {
                return { valido: false, mensaje: "La cantidad debe ser al menos 1." };
            }

            if (herramienta && cantidad > herramienta.stock) {
                return { valido: false, mensaje: "La cantidad solicitada supera el stock disponible (" + herramienta.stock + ")." };
            }
        } else if (!idAreaSeleccionada.value) {
            return { valido: false, mensaje: "Busca y selecciona un área válida de la lista." };
        }

        return { valido: true };
    }

    async function registrarPrestamo() {
        const validacion = validarFormularioPrestamo();
        if (!validacion.valido) {
            Swal.fire({ icon: "warning", title: "Datos incompletos", text: validacion.mensaje });
            return;
        }

        const estadoPendiente = listaEstados.find((estado) => estado.nombreEstado === "PENDIENTE");
        if (!estadoPendiente) {
            Swal.fire({ icon: "error", title: "No se pudo registrar el préstamo", text: "No se encontró el estado PENDIENTE." });
            return;
        }

        try {
            const nuevoPrestamo = await agregarPrestamo({
                usuario: obtenerIdUsuarioActual(),
                fechaInicio: fechaInicio.value,
                fechaEsperada: fechaEsperada.value,
                fechaDevolucion: null,
                estado: estadoPendiente.id,
            });

            if (tipoHerramienta.checked) {
                await agregarDetallePrestamoHerramienta({
                    prestamo: nuevoPrestamo.id,
                    herramienta: Number(idHerramientaSeleccionada.value),
                    cantidad: Number(cantidadSolicitada.value),
                });
            } else {
                await agregarDetallePrestamoArea({
                    prestamoIdPrestamo: nuevoPrestamo.id,
                    areasIdArea: Number(idAreaSeleccionada.value),
                });
            }

            Swal.fire({ icon: "success", title: "¡Préstamo registrado!", confirmButtonColor: "#001f3d" });
            limpiarFormulario();

        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: "error",
                title: "No se pudo registrar el préstamo",
                text: "Ocurrió un error al conectar con el servidor. Intenta de nuevo.",
                confirmButtonColor: "#dc3545",
            });
        }
    }

    function conectarBuscadorHerramienta() {
        buscarHerramienta.addEventListener("change", () => {
            const encontrada = resolverPorNombre(buscarHerramienta.value, listaHerramientas, "nombreHerramienta");
            if (encontrada) {
                idHerramientaSeleccionada.value = encontrada.idHerramienta;
                buscarHerramienta.value = encontrada.nombreHerramienta;
                avisoHerramienta.textContent = "Stock disponible: " + encontrada.stock;
                cantidadSolicitada.max = encontrada.stock;
            } else {
                idHerramientaSeleccionada.value = "";
                avisoHerramienta.textContent = "No se encontró ese equipo. Revisa el nombre o agrégalo como nuevo.";
            }
        });
    }

    function rellenarListaAreas() {
        const datalist = document.getElementById("listaAreasDatalist");
        if (!datalist) return;
        datalist.innerHTML = "";
        listaAreas.forEach((area) => {
            const opcion = document.createElement("option");
            opcion.value = area.nombreArea;
            datalist.appendChild(opcion);
        });
    }

    async function crearAreaNueva(nombre) {
        const opciones = {};
        listaTiposArea.forEach((tipo) => {
            opciones[tipo.id] = tipo.nombreTipoArea;
        });

        const { value: idTipoElegido } = await Swal.fire({
            title: `La ubicación "${nombre}" no existe`,
            text: "¿Qué tipo de lugar es?",
            input: "radio",
            inputOptions: opciones,
            confirmButtonText: "Agregar ubicación",
            confirmButtonColor: "#001f3d",
            inputValidator: (value) => !value && "Selecciona una opción para continuar.",
        });

        if (!idTipoElegido) return null;

        const nuevaArea = await agregarArea({
            nombreArea: nombre,
            tipoArea: Number(idTipoElegido),
        });

        listaAreas.push(nuevaArea);
        rellenarListaAreas();
        return nuevaArea;
    }

    function conectarBuscadorArea() {
        buscarArea.addEventListener("change", async () => {
            const textoBuscado = buscarArea.value.trim();
            const encontrada = resolverPorNombre(textoBuscado, listaAreas, "nombreArea");

            if (encontrada) {
                idAreaSeleccionada.value = encontrada.id;
                buscarArea.value = encontrada.nombreArea;
                avisoArea.textContent = "";
                return;
            }

            if (!textoBuscado) {
                idAreaSeleccionada.value = "";
                avisoArea.textContent = "";
                return;
            }

            try {
                const areaCreada = await crearAreaNueva(textoBuscado);
                if (areaCreada) {
                    idAreaSeleccionada.value = areaCreada.id;
                    buscarArea.value = areaCreada.nombreArea;
                    avisoArea.textContent = "Ubicación agregada.";
                } else {
                    idAreaSeleccionada.value = "";
                    avisoArea.textContent = "No se encontró esa área.";
                }
            } catch (error) {
                console.error(error);
                idAreaSeleccionada.value = "";
                Swal.fire({ icon: "error", title: "No se pudo agregar la ubicación", text: "Ocurrió un error al conectar con el servidor." });
            }
        });
    }

    function conectarFechas() {
        fechaInicio.addEventListener("change", () => {
            fechaEsperada.min = fechaInicio.value;
        });
    }

    if (observaciones) {
        observaciones.addEventListener("input", () => {
            const contador = document.getElementById("c1");
            if (contador) contador.innerText = observaciones.value.length;
        });
    }

    (async function cargarCatalogos() {
        try {
            listaHerramientas = await obtenerHerramientas();
            listaAreas = await obtenerAreas();
            listaEstados = await obtenerEstadosPrestamo();
            listaTiposArea = await obtenerTiposArea();
            rellenarListaAreas();
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: "error", title: "No se pudieron cargar los catálogos", text: "Revisa tu conexión con el servidor." });
        }
    })();

    conectarBuscadorHerramienta();
    conectarBuscadorArea();
    conectarFechas();
    btnRegistrarPrestamo.addEventListener("click", registrarPrestamo);
}
