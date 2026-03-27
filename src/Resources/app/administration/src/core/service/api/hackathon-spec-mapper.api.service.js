const ApiService = Shopware.Classes.ApiService;
const TRANSFORM_PRODUCTS_URL = 'https://csv-transformer-mvp.vercel.app/api/transform-products';

export default class HackathonSpecMapperApiService extends ApiService {
    constructor(httpClient, loginService) {
        super(httpClient, loginService, null, 'application/json');
        this.name = 'hackathonSpecMapperApiService';
    }

    async formatCsv(file) {
        const formData = new FormData();

        formData.append('file', file, file?.name || 'import.csv');

        try {
            const response = await fetch(TRANSFORM_PRODUCTS_URL, {
                method: 'POST',
                body: formData,
            });

            const responseText = await response.text();
            const payload = responseText ? JSON.parse(responseText) : null;

            if (!response.ok) {
                throw new Error(payload?.error || payload?.message || 'The CSV transformer API rejected the uploaded file.');
            }

            return payload;
        } catch (error) {
            if (error instanceof TypeError) {
                throw new Error(
                    'Direct browser upload is blocked by CORS. The transformer API must allow the origin http://shopware.test.',
                );
            }

            throw error;
        }
    }

    applyRows(rows, additionalHeaders = {}) {
        return this.httpClient.post(
            '/_action/hackathon-spec-mapper/apply',
            {
                rows,
            },
            {
                headers: this.getBasicHeaders(additionalHeaders),
            },
        ).then((response) => ApiService.handleResponse(response));
    }
}
