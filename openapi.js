const stationIdParam = {
    name: 'id',
    in: 'path',
    required: true,
    description: 'Identificador de la estación (solo alfanumérico, guiones o guiones bajos, máx. 20 caracteres).',
    schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,20}$' },
    example: 'EA013',
};

const typeParam = {
    name: 'type',
    in: 'path',
    required: true,
    description: 'Tipo de medición.',
    schema: { type: 'string', enum: ['nivel', 'caudal', 'temperatura', 'pluviometria'] },
    example: 'nivel',
};

const errorResponse = (description) => ({
    description,
    content: {
        'application/json': {
            schema: {
                type: 'object',
                properties: { error: { type: 'string' } },
            },
        },
    },
});

export const openapiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'CHD API',
        version: '1.0.0',
        description:
            'API REST para consultar datos de la Confederación Hidrográfica del Duero (CHD) desde el portal SAIH Duero.',
        contact: { name: 'Guillermo López', url: 'https://github.com/arandadeduero/chd-api' },
        license: { name: 'ISC' },
    },
    externalDocs: {
        description: 'Repositorio en GitHub',
        url: 'https://github.com/arandadeduero/chd-api',
    },
    tags: [
        { name: 'Sistema', description: 'Estado del servicio' },
        { name: 'Estaciones', description: 'Datos de estaciones de aforo (JSON)' },
    ],
    paths: {
        '/health': {
            get: {
                tags: ['Sistema'],
                summary: 'Estado del servidor',
                responses: {
                    200: {
                        description: 'El servidor está operativo.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', example: 'ok' },
                                        uptime: { type: 'number', example: 123.456 },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/station/aforo/all': {
            get: {
                tags: ['Estaciones'],
                summary: 'Listar todas las estaciones de aforo',
                responses: {
                    200: {
                        description: 'Listado de estaciones de tipo "Aforo".',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            Tipo: { type: 'string', example: 'Aforo' },
                                            name: { type: 'string', example: 'Aforos SAIH CHD' },
                                            stationId: { type: 'string', example: 'EA013' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    500: errorResponse('SAIH no respondió a tiempo.'),
                },
            },
        },
        '/station/aforo/{id}': {
            get: {
                tags: ['Estaciones'],
                summary: 'Tipos de medición disponibles para una estación',
                parameters: [stationIdParam],
                responses: {
                    200: {
                        description: 'Tipos de medición disponibles para la estación.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            type: { type: 'string', example: 'nivel' },
                                            url: { type: 'string', format: 'uri' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: errorResponse('Identificador de estación inválido.'),
                    404: errorResponse('La estación no existe.'),
                    500: errorResponse('SAIH no respondió a tiempo.'),
                },
            },
        },
        '/station/aforo/{id}/{type}': {
            get: {
                tags: ['Estaciones'],
                summary: 'Histórico de mediciones de un tipo para una estación',
                parameters: [stationIdParam, typeParam],
                responses: {
                    200: {
                        description: 'Serie histórica de mediciones.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            d: { type: 'string', example: '20/11/2025 00:00', description: 'Fecha/hora en Europe/Madrid' },
                                            v: { type: 'number', example: 1.18, description: 'Valor de la medición' },
                                            '@timestamp': { type: 'string', format: 'date-time', description: 'Fecha/hora en UTC (ISO 8601)' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: errorResponse('Identificador de estación o tipo inválido.'),
                    404: errorResponse('La estación o el tipo de medición no existe.'),
                    500: errorResponse('SAIH no respondió a tiempo.'),
                },
            },
        },
        '/station/aforo/{id}/{type}/graph': {
            get: {
                tags: ['Estaciones'],
                summary: 'Gráfico interactivo del histórico de una medición',
                description: 'Devuelve una página HTML con un gráfico Chart.js interactivo (no JSON).',
                parameters: [stationIdParam, typeParam],
                responses: {
                    200: { description: 'Página HTML con el gráfico.', content: { 'text/html': { schema: { type: 'string' } } } },
                    400: errorResponse('Identificador de estación o tipo inválido.'),
                    404: errorResponse('La estación o el tipo de medición no existe.'),
                    500: errorResponse('SAIH no respondió a tiempo.'),
                },
            },
        },
    },
};
