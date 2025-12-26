/**
 * ModoFit - JavaScript de Autenticación
 */

document.addEventListener('DOMContentLoaded', function() {
    // Toggle password visibility
    initPasswordToggle();
    
    // Validación de formulario de registro
    initRegistroValidation();
});

/**
 * Toggle para mostrar/ocultar contraseña
 */
function initPasswordToggle() {
    const toggleButtons = document.querySelectorAll('#togglePassword');
    
    toggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const input = this.closest('.input-group').querySelector('input');
            const icon = this.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('bi-eye');
                icon.classList.add('bi-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('bi-eye-slash');
                icon.classList.add('bi-eye');
            }
        });
    });
}

/**
 * Validación del formulario de registro
 */
function initRegistroValidation() {
    const registroForm = document.getElementById('registroForm');
    
    if (registroForm) {
        registroForm.addEventListener('submit', function(e) {
            const password = document.getElementById('password');
            const confirmPassword = document.getElementById('confirmPassword');
            
            if (password && confirmPassword) {
                if (password.value !== confirmPassword.value) {
                    e.preventDefault();
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Las contraseñas no coinciden'
                    });
                    confirmPassword.focus();
                    return false;
                }
                
                if (password.value.length < 6) {
                    e.preventDefault();
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'La contraseña debe tener al menos 6 caracteres'
                    });
                    password.focus();
                    return false;
                }
            }
        });
    }
}
