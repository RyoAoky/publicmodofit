module.exports = {
    // Helper para comparar valores
    eq: function (a, b) {
        return a === b;
    },
    
    // Helper para formatear fechas
    formatDate: function (date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('es-PE');
    },
    
    // Helper para formatear moneda
    formatCurrency: function (amount) {
        if (!amount) return 'S/ 0.00';
        return 'S/ ' + parseFloat(amount).toFixed(2);
    },
    
    // Helper condicional
    ifCond: function (v1, operator, v2, options) {
        switch (operator) {
            case '==':
                return (v1 == v2) ? options.fn(this) : options.inverse(this);
            case '===':
                return (v1 === v2) ? options.fn(this) : options.inverse(this);
            case '!=':
                return (v1 != v2) ? options.fn(this) : options.inverse(this);
            case '!==':
                return (v1 !== v2) ? options.fn(this) : options.inverse(this);
            case '<':
                return (v1 < v2) ? options.fn(this) : options.inverse(this);
            case '<=':
                return (v1 <= v2) ? options.fn(this) : options.inverse(this);
            case '>':
                return (v1 > v2) ? options.fn(this) : options.inverse(this);
            case '>=':
                return (v1 >= v2) ? options.fn(this) : options.inverse(this);
            case '&&':
                return (v1 && v2) ? options.fn(this) : options.inverse(this);
            case '||':
                return (v1 || v2) ? options.fn(this) : options.inverse(this);
            default:
                return options.inverse(this);
        }
    },

    // Helper para JSON
    json: function (context) {
        return JSON.stringify(context);
    }
};
