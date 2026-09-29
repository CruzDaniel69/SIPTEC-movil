import { iniciarSesion } from "../services/authService.js";

export function initLoginController() {
    const formLogin = document.getElementById("login-form");
    const email = document.getElementById("email");
    const password = document.getElementById("password");

    if (!formLogin) return;

    formLogin.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const correo = email.value.trim();
        const clave = password.value;

        if (!correo || !clave) {
            Swal.fire({ icon: "warning", title: "Datos incompletos", text: "Ingresa tu correo y tu contraseña." });
            return;
        }

        try {
            const usuario = await iniciarSesion(correo, clave);

            if (!usuario) {
                Swal.fire({ icon: "error", title: "Credenciales inválidas", text: "Correo o contraseña incorrectos." });
                return;
            }

            localStorage.setItem("siptec-usuario-id", usuario.id);
            localStorage.setItem("siptec-usuario-nombre", usuario.nombreUsuario);
            localStorage.setItem("siptec-usuario-apellido", usuario.apellidoUsuario);
            localStorage.setItem("siptec-usuario-correo", usuario.correoUsuario);
            localStorage.setItem("siptec-role", usuario.nombreRol);

            window.location.href = "pages/loadViews.html";

        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: "error",
                title: "No se pudo iniciar sesión",
                text: "Ocurrió un error al conectar con el servidor. Intenta de nuevo.",
                confirmButtonColor: "#dc3545",
            });
        }
    });
}

initLoginController();
