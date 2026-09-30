export function obtenerRolActual() {
    return (localStorage.getItem("siptec-role") || "EMPLEADO").toUpperCase();
}

export function puedeGestionar(rolesPermitidos) {
    return rolesPermitidos.includes(obtenerRolActual());
}
