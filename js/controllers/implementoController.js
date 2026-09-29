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
    const marcaTexto = document.getElementById("marcaTexto");
    const categoriaTexto = document.getElementById("categoriaTexto");
    const listaMarcasDatalist = document.getElementById("listaMarcas");
    const listaCategoriasDatalist = document.getElementById("listaCategorias");
    const descripcionEquipo = document.getElementById("descripcionEquipo");
    const btnGuardarImplemento = document.getElementById("btnGuardarImplemento");

    if (!btnGuardarImplemento) return;

    const patronCodigo = /^[A-Za-z0-9-]+$/;

    function limpiarFormulario() {
        nombreEquipo.value = "";
        codigoInventario.value = "";
        marcaTexto.value = "";
        categoriaTexto.value = "";
        if (descripcionEquipo) {
            descripcionEquipo.value = "";
            const contador = document.getElementById("c3");
            if (contador) contador.innerText = "0";
        }
    }

    function validarFormulario() {
        if (!nombreEquipo.value.trim()) {
            return { valido: false, mensaje: "Escribe el nombre del equipo." };
        }
        if (!codigoInventario.value.trim() || !patronCodigo.test(codigoInventario.value.trim())) {
            return { valido: false, mensaje: "El código de inventario solo admite letras, números y guiones." };
        }
        if (!marcaTexto.value.trim()) {
            return { valido: false, mensaje: "Escribe una marca." };
        }
        if (!categoriaTexto.value.trim()) {
            return { valido: false, mensaje: "Escribe una categoría." };
        }
        return { valido: true };
    }

    async function obtenerOCrearMarca(nombre) {
        const nombreNormalizado = nombre.trim();
        const existente = listaMarcas.find((item) => item.nombreMarca.toLowerCase() === nombreNormalizado.toLowerCase());
        if (existente) return existente.id;

        const creada = await agregarMarca({ nombreMarca: nombreNormalizado });
        listaMarcas.push(creada);
        return creada.id;
    }

    async function obtenerOCrearCategoria(nombre) {
        const nombreNormalizado = nombre.trim();
        const existente = listaCategorias.find((item) => item.nombreCategoria.toLowerCase() === nombreNormalizado.toLowerCase());
        if (existente) return existente.id;

        const creada = await agregarCategoria({ nombreCategoria: nombreNormalizado });
        listaCategorias.push(creada);
        return creada.id;
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
            const [idMarca, idCategoria] = await Promise.all([
                obtenerOCrearMarca(marcaTexto.value),
                obtenerOCrearCategoria(categoriaTexto.value),
            ]);

            const nuevaHerramienta = await agregarHerramienta({
                nombreHerramienta: nombreEquipo.value.trim(),
                descripcionHerramienta: descripcionEquipo.value.trim(),
                stock: 1,
            });

            await agregarDetalleHerramienta({
                idHerramienta: nuevaHerramienta.idHerramienta,
                idMarca: idMarca,
                idEstadoHerramienta: estadoDisponible.id,
                codInv: codigoInventario.value.trim(),
            });

            await agregarHerramientaCategoria({
                idCategoria: idCategoria,
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

            marcas.forEach((marca) => {
                const opcion = document.createElement("option");
                opcion.value = marca.nombreMarca;
                listaMarcasDatalist.appendChild(opcion);
            });

            categorias.forEach((categoria) => {
                const opcion = document.createElement("option");
                opcion.value = categoria.nombreCategoria;
                listaCategoriasDatalist.appendChild(opcion);
            });

        } catch (error) {
            console.error(error);
            Swal.fire({ icon: "error", title: "No se pudieron cargar los catálogos", text: "Revisa tu conexión con el servidor." });
        }
    })();

    btnGuardarImplemento.addEventListener("click", guardarImplemento);
}
