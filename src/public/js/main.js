/**
 * ModoFit - JavaScript Principal
 */

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar carrito desde localStorage
    initCarrito();
    
    // Inicializar estado del usuario
    initUserState();
    
    // Navbar scroll effect
    initNavbarScroll();
    
    // Smooth scroll para enlaces internos
    initSmoothScroll();
    
    // Formulario de contacto
    initContactForm();
});

/**
 * Inicializar estado del usuario en el navbar
 */
async function initUserState() {
    try {
        const response = await fetch('/auth/api/me');
        const data = await response.json();
        
        const userMenu = document.getElementById('user-menu');
        const loginBtn = document.getElementById('login-btn');
        const registerBtn = document.getElementById('register-btn');
        const userName = document.getElementById('user-name');
        
        if (data.success && data.user) {
            // Usuario logueado
            if (userMenu) userMenu.style.display = 'block';
            if (loginBtn) loginBtn.style.display = 'none';
            if (registerBtn) registerBtn.style.display = 'none';
            if (userName) userName.textContent = data.user.nomcli;
        } else {
            // Usuario no logueado
            if (userMenu) userMenu.style.display = 'none';
            if (loginBtn) loginBtn.style.display = 'block';
            if (registerBtn) registerBtn.style.display = 'block';
        }
    } catch (error) {
        console.log('No se pudo verificar el estado del usuario');
    }
}

/**
 * Inicializar contador del carrito
 */
function initCarrito() {
    const carrito = JSON.parse(localStorage.getItem('modofit_carrito')) || [];
    actualizarContadorCarrito(carrito);
}

/**
 * Actualizar contador del carrito en el navbar
 */
function actualizarContadorCarrito(carrito) {
    const items = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    
    document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = items;
        el.style.display = items > 0 ? 'inline' : 'none';
    });
}

/**
 * Efecto de navbar al hacer scroll
 */
function initNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    
    if (navbar) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 50) {
                navbar.classList.add('shadow-lg');
                navbar.style.backgroundColor = '#1a1a2e';
            } else {
                navbar.classList.remove('shadow-lg');
            }
        });
    }
}

/**
 * Smooth scroll para enlaces internos
 */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

/**
 * Manejo del formulario de contacto
 */
function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const data = Object.fromEntries(formData);
            
            Swal.fire({
                title: 'Enviando...',
                text: 'Por favor espera',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });
            
            // Simular envío (aquí iría la lógica real de envío)
            setTimeout(() => {
                Swal.fire({
                    icon: 'success',
                    title: '¡Mensaje Enviado!',
                    text: 'Nos pondremos en contacto contigo pronto',
                    confirmButtonText: 'Aceptar'
                });
                contactForm.reset();
            }, 1500);
        });
    }
}

/**
 * Función global para mostrar mensajes
 */
function mostrarMensaje(tipo, titulo, texto) {
    Swal.fire({
        icon: tipo,
        title: titulo,
        text: texto,
        confirmButtonColor: '#0d6efd'
    });
}

/**
 * Función global para confirmar acciones
 */
async function confirmarAccion(titulo, texto) {
    const result = await Swal.fire({
        title: titulo,
        text: texto,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#0d6efd',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, continuar',
        cancelButtonText: 'Cancelar'
    });
    
    return result.isConfirmed;
}

/**
 * Formatear moneda
 */
function formatCurrency(amount) {
    return 'S/ ' + parseFloat(amount).toFixed(2);
}

/**
 * Formatear fecha
 */
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('es-PE', options);
}
