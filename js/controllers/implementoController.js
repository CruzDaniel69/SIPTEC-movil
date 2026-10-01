import { agregarHerramienta } from "../services/herramientaService.js";
import { obtenerMarcas, agregarMarca } from "../services/marcaService.js";
import { obtenerCategorias, agregarCategoria } from "../services/categoriaService.js";
import { obtenerEstadosHerramienta } from "../services/estadoHerramientaService.js";
import { agregarDetalleHerramienta } from "../services/detalleHerramientaService.js";
import { agregarHerramientaCategoria } from "../services/herramientaCategoriaService.js";

let listaEstadosHerramienta = [];
let listaMarcas = [];
let listaCategorias = [];

export function initImplementoController() {
    const nombreEquipo = document.getElementById("nombreEquipo");
    const codigoInventario = document.getElementById("codigoInventario");
    const marcaSelect = document.getElementById("marcaTexto");
    const categoriaSelect = document.getElementById("categoriaTexto");
    const descripcionEquipo = document.getElementById("descripcionEquipo");
    const btnGuardarImplemento = document.getElementById("btnGuardarImplemento");

    if (!btnGuardarImplemento) return;

    const patronCodigo = /^[A-Za-z0-9-]+$/;
    const patronTexto = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9.,()\-\s]+$/;

    function limpiarFormulario() {
        nombreEquipo.value = "";
        codigoInventario.value = "";
        poblarSelect(marcaSelect, listaMarcas, "nombreMarca", "");
        poblarSelect(categoriaSelect, listaCategorias, "nombreCategoria", "");
        if (descripcionEquipo) {
            descripcionEquipo.value = "";
            const contador = document.getElementById("c3");
            if (contador) contador.innerText = "0";
        }
    }

    function poblarSelect(select, lista, campoNombre, valorSeleccionado) {
        if (!select) return;
        const opciones = lista.map((item) =>
            `<option value="${item.id}" ${String(item.id) === String(valorSeleccionado) ? "selected" : ""}>${item[campoNombre]}</option>`
        ).join("");
        select.innerHTML = '<option value="" disabled' + (valorSeleccionado ? "" : " selected") + '>Selecciona una opción</option>' +
            opciones +
            '<option value="__nuevo__">+ Agregar nueva opción</option>';
    }

    async function manejarAgregarNuevaOpcion(titulo, placeholder, crear) {
        const { value: nombre } = await Swal.fire({
            title: titulo,
            input: "text",
            inputPlaceholder: placeholder,
            showCancelButton: true,
            confirmButtonText: "Agregar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#8a4fd6",
            inputValidator: (value) => {
                const texto = (value || "").trim();
                if (!texto) return "Escribe un nombre.";
                if (!patronTexto.test(texto)) return "Ese nombre tiene símbolos no permitidos.";
                return null;
            },
        });

        if (!nombre) return null;

        try {
            return await crear(nombre.trim());
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: "error", title: "No se pudo agregar", text: "Ocurrió un error al conectar con el servidor." });
            return null;
        }
    }

    marcaSelect.addEventListener("change", async () => {
        if (marcaSelect.value !== "__nuevo__") return;
        const creada = await manejarAgregarNuevaOpcion("Nueva marca", "Nombre de la marca", async (nombre) => {
            const creada = await agregarMarca({ nombreMarca: nombre });
            listaMarcas.push(creada);
            return creada;
        });
        poblarSelect(marcaSelect, listaMarcas, "nombreMarca", creada ? creada.id : "");
    });

    categoriaSelect.addEventListener("change", async () => {
        if (categoriaSelect.value !== "__nuevo__") return;
        const creada = await manejarAgregarNuevaOpcion("Nueva categoría", "Nombre de la categoría", async (nombre) => {
            const creada = await agregarCategoria({ nombreCategoria: nombre });
            listaCategorias.push(creada);
            return creada;
        });
        poblarSelect(categoriaSelect, listaCategorias, "nombreCategoria", creada ? creada.id : "");
    });

    function validarFormulario() {
        if (!nombreEquipo.value.trim()) {
            return { valido: false, mensaje: "Escribe el nombre del equipo." };
        }
        if (!patronTexto.test(nombreEquipo.value.trim())) {
            return { valido: false, mensaje: "El nombre del equipo tiene símbolos no permitidos." };
        }
        if (!codigoInventario.value.trim() || !patronCodigo.test(codigoInventario.value.trim())) {
            return { valido: false, mensaje: "El código de inventario solo admite letras, números y guiones." };
        }
        if (!marcaSelect.value || marcaSelect.value === "__nuevo__") {
            return { valido: false, mensaje: "Selecciona una marca." };
        }
        if (!categoriaSelect.value || categoriaSelect.value === "__nuevo__") {
            return { valido: false, mensaje: "Selecciona una categoría." };
        }
        if (descripcionEquipo && descripcionEquipo.value.trim() && !patronTexto.test(descripcionEquipo.value.trim())) {
            return { valido: false, mensaje: "La descripción tiene símbolos no permitidos." };
        }
        return { valido: true };
    }

    async function guardarImplemento() {
        const validacion = validarFormulario();
        if (!validacion.valido) {
            Swal.fire({ icon: "warning", title: "Datos incompletos", text: validacion.mensaje });
            return;
        }

        const estadoDisponible = listaEstadosHerramienta.find((item) => item.nombreEstadoHerramienta === "DISPONIBLE");
        if (!estadoDisponible) {
            Swal.fire({ icon: "error", title: "No se pudo guardar", text: "No se encontró el estado DISPONIBLE." });
            return;
        }

        try {
            const nuevaHerramienta = await agregarHerramienta({
                nombreHerramienta: nombreEquipo.value.trim(),
                descripcionHerramienta: descripcionEquipo.value.trim(),
                stock: 1,
            });

            await agregarDetalleHerramienta({
                idHerramienta: nuevaHerramienta.idHerramienta,
                idMarca: Number(marcaSelect.value),
                idEstadoHerramienta: estadoDisponible.id,
                codInv: codigoInventario.value.trim(),
            });

            await agregarHerramientaCategoria({
                idCategoria: Number(categoriaSelect.value),
                idHerramienta: nuevaHerramienta.idHerramienta,
            });

            Swal.fire({
                icon: "success",
                title: "¡Implemento guardado!",
                text: "Se agregó correctamente al inventario.",
                confirmButtonColor: "#8a4fd6",
            });
            limpiarFormulario();

        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: "error",
                title: "No se pudo guardar el implemento",
                text: "Ocurrió un error al conectar con el servidor. Intenta de nuevo.",
                confirmButtonColor: "#dc3545",
            });
        }
    }

    if (descripcionEquipo) {
        descripcionEquipo.addEventListener("input", () => {
            const contador = document.getElementById("c3");
            if (contador) contador.innerText = descripcionEquipo.value.length;
        });
    }

    (async function cargarCatalogos() {
        try {
            const [marcas, categorias, estadosHerramienta] = await Promise.all([
                obtenerMarcas(),
                obtenerCategorias(),
                obtenerEstadosHerramienta(),
            ]);

            listaEstadosHerramienta = estadosHerramienta;
            listaMarcas = marcas;
            listaCategorias = categorias;

            poblarSelect(marcaSelect, listaMarcas, "nombreMarca", "");
            poblarSelect(categoriaSelect, listaCategorias, "nombreCategoria", "");

        } catch (error) {
            console.error(error);
            Swal.fire({ icon: "error", title: "No se pudieron cargar los catálogos", text: "Revisa tu conexión con el servidor." });
        }
    })();

    btnGuardarImplemento.addEventListener("click", guardarImplemento);
}
