// Helpers personalizados de Handlebars
module.exports = {
    // Formatear precio con 2 decimales
    formatPrecio: function(precio) {
        if (!precio) return '0.00';
        return parseFloat(precio).toFixed(2);
    },

    // Convertir frecuencia a texto legible
    frecuenciaTexto: function(num, unidad) {
        const unidades = {
            'day': { singular: 'día', plural: 'días' },
            'week': { singular: 'semana', plural: 'semanas' },
            'month': { singular: 'mes', plural: 'meses' },
            'year': { singular: 'año', plural: 'años' }
        };
        
        const u = unidades[unidad] || { singular: unidad, plural: unidad };
        return num === 1 ? u.singular : `${num} ${u.plural}`;
    },

    // Comparar igualdad
    eq: function(a, b) {
        return a === b;
    },

    // Comparar mayor que
    gt: function(a, b) {
        return a > b;
    },

    // Comparar menor que
    lt: function(a, b) {
        return a < b;
    },

    // Operador OR
    or: function(a, b) {
        return a || b;
    },

    // Operador AND
    and: function(a, b) {
        return a && b;
    },

    // Formatear fecha
    formatFecha: function(fecha) {
        if (!fecha) return '-';
        const d = new Date(fecha);
        return d.toLocaleDateString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    // JSON stringify para pasar datos a JavaScript
    json: function(context) {
        return JSON.stringify(context);
    }
};
