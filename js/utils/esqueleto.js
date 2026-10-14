// Marcadores de carga: formas grises que ocupan el lugar del contenido mientras llega de la API

/** Filas de lista (icono + dos líneas de texto). */
export function esqueletoFilas(cantidad = 3) {
    const fila = `
        <div class="esqueleto-fila" aria-hidden="true">
            <span class="esqueleto esqueleto-icono"></span>
            <span class="esqueleto-textos">
                <span class="esqueleto esqueleto-linea"></span>
                <span class="esqueleto esqueleto-linea corta"></span>
            </span>
        </div>`;
    return `<div role="status" aria-label="Cargando">${fila.repeat(cantidad)}</div>`;
}

/** Tarjetas completas, como las de la lista de devoluciones. */
export function esqueletoTarjetas(cantidad = 3) {
    return `<div role="status" aria-label="Cargando">${'<div class="esqueleto esqueleto-tarjeta" aria-hidden="true"></div>'.repeat(cantidad)}</div>`;
}

/** Los números de las estadísticas muestran una barra gris hasta tener su valor. */
export function marcarNumerosCargando() {
    document.querySelectorAll(".tarjeta-estadistica .number").forEach((numero) => numero.classList.add("cargando"));
}

export function quitarNumerosCargando() {
    document.querySelectorAll(".tarjeta-estadistica .number").forEach((numero) => numero.classList.remove("cargando"));
}
