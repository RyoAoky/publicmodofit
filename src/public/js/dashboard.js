/**
 * ModoFit - JavaScript del Dashboard
 */

document.addEventListener('DOMContentLoaded', function() {
    // Toggle sidebar
    initSidebarToggle();
    
    // Active link highlighting
    initActiveLinks();
});

/**
 * Toggle del sidebar
 */
function initSidebarToggle() {
    const menuToggle = document.getElementById('menu-toggle');
    const wrapper = document.getElementById('wrapper');
    
    if (menuToggle && wrapper) {
        menuToggle.addEventListener('click', function(e) {
            e.preventDefault();
            wrapper.classList.toggle('toggled');
        });
    }
}

/**
 * Resaltar enlace activo en el sidebar
 */
function initActiveLinks() {
    const currentPath = window.location.pathname;
    const sidebarLinks = document.querySelectorAll('#sidebar-wrapper .list-group-item');
    
    sidebarLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

/**
 * Confirmación para eliminar cuenta
 */
async function confirmarEliminarCuenta() {
    const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: 'Esta acción eliminará tu cuenta permanentemente',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar cuenta',
        cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
        // Aquí iría la lógica para eliminar la cuenta
        Swal.fire({
            icon: 'info',
            title: 'Función en desarrollo',
            text: 'Esta funcionalidad estará disponible próximamente'
        });
    }
}
